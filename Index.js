const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const Stripe = require('stripe')
const stripe = Stripe(process.env.STRIPE_TOKEN)
const app = express();


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) =>{
  const authorization= req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true, message:'unauthorized access'})
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({error:true, message:'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dzmtgtr.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();
    const userCollection = client.db('bistroUser').collection('users')
    const menuCollection = client.db('bistroUser').collection('menu')
    const reviewCollection = client.db('bistroUser').collection('reviews')
    const cartCollection = client.db('bistroUser').collection('carts')
    
    app.post('/jwt', (req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'1h'})
      res.send({token})
    })

    const verifyAdmin = async(req, res, next)=>{
      const email = req.decoded.email;
      const query ={email:email}
      const user = await userCollection.findOne(query)
      if(user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden message'})
      }
      next()
    }

    // users collection
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) =>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async(req, res) =>{
      const user = req.body;
      const query = {email:user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
      return  res.send({message: 'user already exist'})
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
  
    app.get('/users/admin/:email', verifyJWT, async(req, res) =>{
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin:false})
      }
      const query = {email: email}
      const user= await userCollection.findOne(query)
      const result = {admin: user?.role === 'admin'}
      res.send(result)
    })
    app.patch('/users/admin/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

   app.delete('/users/:id', async(req, res) =>{
    const id =req.params.id;
    const query = {_id: new ObjectId(id)}
    const result= await userCollection.deleteOne(query)
    res.send(result)
   })
  
  
    // menu collection
    app.get('/menu', async(req, res) =>{
        const result = await menuCollection.find().toArray()
        res.send(result)
    })
    app.post('/menu', verifyJWT, verifyAdmin, async(req, res) =>{
      const img =req.body
      const result = await menuCollection.insertOne(img)
      res.send(result)
    })
    app.delete('/menu/:id',verifyJWT, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })

    // reviews collection
    app.get('/reviews', async(req, res) =>{
        const result = await reviewCollection.find().toArray()
        res.send(result)
    })

    // cart collection
    app.get('/carts', verifyJWT, async(req, res) =>{
      const email = req.query.email;
      
      if(!email){
        res.send([])
      }
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error:true, message:'forbidden access'})
      }
      const query = {email: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

   app.post('/carts', async(req, res)=>{
    const item = req.body
    console.log(item)
    const result = await cartCollection.insertOne(item)
    res.send(result)
   })
   app.delete('/carts/:id', async(req, res) =>{
    const id = req. params.id;
    const query = {_id: new ObjectId(id)}
    const result = await cartCollection.deleteOne(query)
    res.send(result)
   })

   app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
    const {price} = req.body;
    const amount =price * 100;
    console.log(price, amount)
    const paymentIntent =  await stripe.paymentIntents.create({
      amount: amount,
      currency:'usd',
      payment_method_types:['card']
    })
    res.send({
      clientSecret: paymentIntent.client_secret
    })
   })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) =>{
    res.send('boss is sitting')
})

app.listen(port, () =>{
    console.log(`bistro boss is siting on port : ${port}`)
})
