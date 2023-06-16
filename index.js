require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;

// middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.hoz6vx5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db("AssignmentTwelve").collection("users");
    /*{
      * _id, class_name, class_image, available_seats, price, inst_name, inst_email
    }*/
    const classCollection = client.db("AssignmentTwelve").collection("class");
    const sClassCollection = client.db('AssignmentTwelve').collection("sclass");


    app.delete('/delete-class', async(req, res)=>{
      try{
        const {classId, userId} = req.query;
        const cls = await sClassCollection.findOneAndDelete({$and: [{classId: new ObjectId(classId)}, {userId: new ObjectId(userId)}]});
        if(cls) return res.json({message: "Selected class deleted"});
        return res.status(400).json({message: "Class not deleted!"});

      }catch(err){
        return res.status(500).json({message: 'Internal Server Error!'});
      }
    })

    app.post('/set-class', async(req, res)=>{
      try{
        const {classId, userId} = req.body;
        if(!userId) return res.status(400).json({message: "Please enter a valid userId"});
        const cls = await classCollection.findOne({_id: new ObjectId(classId)});
        if(cls){
          // await classCollection.updateOne({_id: new ObjectId(classId)}, {$set: {seats: cls.seats - 1}});
          const isSel = await sClassCollection.findOne({$and:[{userId: new ObjectId(userId)}, {classId: new ObjectId(classId)}]});
          if(!isSel){
            const scnew = await sClassCollection.insertOne({classId: new ObjectId(classId), userId: new ObjectId(userId)});
            return res.json({message: "Class added to list!"});
          }
          return res.status(400).json({message: "User already selected this class!"});
        }
        return res.status(401).json({message: "Class Not found or Seats not found!"})

      }catch(err){
        console.log(err);
        return res.status(500).json({message: "Internal Sever Error!"});
      }

    });

    app.get('/get-sclass', async (req, res)=>{
      try{
        const {userId} = req.query;
        const classes = await sClassCollection.aggregate([
          {$match: {userId: new ObjectId(userId)}},
          {
            $lookup: {
              from: "class",
              localField: "classId",
              foreignField: "_id",
              as: "classes"
            }
          },
        ]).toArray();
        return res.json(classes);
      }catch(err){
        return res.status(500).json({message: 'Internal Server Error!'});
      }
    });
    app.post('/add-class', async(req, res)=>{
      try{
        const {inst_email} = req.body;
        const user = await usersCollection.findOne({email: inst_email});
        if(!user) return res.status(401).json({message: "Please enter a valid email!"});
        if(user.role !== "instructors") return res.status(401).json({message: "User Doesn't have access to create a class!"});
        const property = {class_name: null, class_image: null, seats: 0, price: 0, inst_name:null, inst_email:null};
        Object.keys(property).forEach((k)=>{
          if(req.body[k]) property[k] = req.body[k];
        });
        const cls = await classCollection.insertOne({...property, status:'pending'});
        if(cls) return res.json({cls});
        return res.status(400).json({message: "Class could not be added!"});


      }catch(err){
        console.log(err);
        return res.status(500).json({message:"Internal Server Error!"});
      }
    });
    
    app.get('/update-class', async(req, res)=>{
      try{
        const {id, status} = req.query;
        const cls = await classCollection.updateOne({_id: new ObjectId(id)}, { $set: { status: status } });
        if(cls) return res.json(cls);
        return req.status(401).json({message:"update failed!"});
      }catch(err){
        console.log(err);
        return res.status(500).json({message: "Internal Sever error!"});
      }
    });

    app.get('/update-user', async(req, res)=>{
      try{
        const {id, role} = req.query;
        const cls = await usersCollection.updateOne({_id: new ObjectId(id)}, { $set: { role: role } });
        if(cls) return res.json(cls);
        return req.status(401).json({message:"update failed!"});
      }catch(err){
        console.log(err);
        return res.status(500).json({message: "Internal Sever error!"});
      }
    });

    app.get('/my-class', async(req, res)=>{
      try{
        const {email} = req.query;
        const classes = await classCollection.find({inst_email: email}).toArray();
        return res.json({data: classes});
      }catch(err){
        return res.status(500).json({message: "Internal server error!"});
      }
    });

    app.get('/all-class', async(req, res)=>{
      try{
        const classes = await classCollection.find({}).toArray();
        return res.json({data: classes});
      }catch(err){
        return res.status(500).json({message: "Internal server error!"});
      }
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/user', async (req, res)=>{
      try{
        const {email} = req.query;
        if(!email){
          const users = await usersCollection.find({}).toArray();
          if(users) return res.json({users});
          return res.status(400).json({message: "users not found!"});
        }
        const user = await usersCollection.findOne({email});
        if(user){
          return res.json({user: user});
        }
        return res.status(400).json({message: "User not found!"});
      }catch(err){
        return res.status(500).json({message: "Internal Server Error!"});
      }

    });

    app.get('/instructors', async(req, res)=>{
      try{
        const inst = await usersCollection.find({role: 'instructors'}).toArray();
        return res.json(inst);

      }catch(err){
        return res.status(500).json({message: "Internal Server Error!"});
      }
    });

    app.get('/students', async(req, res)=>{
      try{
        const inst = await usersCollection.find({role: 'students'}).toArray();
        return res.json(inst);

      }catch(err){
        return res.status(500).json({message: "Internal Server Error!"});
      }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Assignment 12 server running')
})

app.listen(port, () => {
  console.log(`Assignment 12 is running on port ${port}`);
})