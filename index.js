const express = require('express');
const cors = require('cors')
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ifklbg0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const userCollection = client.db('bistroDB').collection('users')
        const menuCollection = client.db('bistroDB').collection('menu')
        const reviewCollection = client.db('bistroDB').collection('reviews')
        const cartCollection = client.db('bistroDB').collection('carts')
        // user related api
        app.get('/users', async(req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        // delete a user
        app.delete('/users/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })
        // make a user admin
        app.patch('/users/admin/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const updateDoc = {
                $set: {
                    rule: 'admin',
                }
            }
            const result = await userCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        app.post('/users', async(req, res) => {
            const userData = req.body;
            const query = {email: userData.email}
            const isExits = await userCollection.findOne(query);
            if(isExits){
                return res.send({message: "User already exists ", insertedId: null})
            }
            const result = await userCollection.insertOne(userData)
            res.send(result)
        })
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })
        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })
        // save the food on server as cart
        app.post('/carts', async(req, res) => {
            const foodItem = req.body;
            const result = await cartCollection.insertOne(foodItem)
            res.send(result)
        })
        // get the cart data
        app.get('/carts', async(req, res) => {
            const email = req.query.email;
            const query = {email: email}
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })
        // delete a cart item 
        app.delete('/carts/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    const result = "Hello from Bistro Boss server";
    res.send(result)
})
app.listen(port, () => {
    console.log(`Bistro Boss server is running on port: ${port}`);
})
