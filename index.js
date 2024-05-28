const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const cors = require('cors')
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;
// middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://js.stripe.com']
}))
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
        const paymentCollection = client.db('bistroDB').collection('payments')
        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '2h' })
            res.send({ token })
        })
        // middle ware
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "Unauthorized access" })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: 'Forbidden access' })
                }
                req.decoded = decoded;
                next()
            })
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "Forbidden" })
            }
            next()
        }
        // cheek is admin 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })
        // user related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        // delete a user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })
        // make a user admin
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin',
                }
            }
            const result = await userCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        // add menu food on server 
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollection.insertOne(menu)
            res.send(result)
        })
        // delete a menu item 
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })
        // update a menu item 
        app.patch('/menu/update/:id', async (req, res) => {
            const id = req.params.id;
            const updateMenu = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    recipe: updateMenu.details,
                    name: updateMenu.recipeName,
                    price: updateMenu.price,
                    category: updateMenu.category
                }
            }
            const result = await menuCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // get a menu item data for update
        app.get('/menu/update/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.findOne(query)
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const userData = req.body;
            const query = { email: userData.email }
            const isExits = await userCollection.findOne(query);
            if (isExits) {
                return res.send({ message: "User already exists ", insertedId: null })
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
        app.post('/carts', async (req, res) => {
            const foodItem = req.body;
            const result = await cartCollection.insertOne(foodItem)
            res.send(result)
        })
        // get the cart data
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })
        // delete a cart item 
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })
        // payment related api
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment)
            //  carefully delete each item from the cart
            console.log('payment info', payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };
            const deleteResult = await cartCollection.deleteMany(query);
            res.send({ paymentResult, deleteResult });
        })
        // Get payment history
        app.get('/paymentHistory/:email', verifyToken,  async(req, res) => {
            const email = req.params.email;
            if(email !== req.decoded.email){
                return res.status(403).send({message: "Forbidden access"})
            }
            const result = await paymentCollection.find({email: email}).toArray()
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
