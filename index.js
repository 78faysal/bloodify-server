const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jq69c8i.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("Bloodify").collection("users");
    const donationRequestCollection = client
      .db("Bloodify")
      .collection("donation_requests");

    // users api
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      res.send(user);
    });

    app.get("/users", async (req, res) => {
      const queryEmail = req.query.email;
      if (queryEmail) {
        const filterQuery = { email: queryEmail };
        const user = await userCollection.findOne(filterQuery);
        if (user.role === "admin") {
          return res.send({ admin: true });
        } else {
          return res.send({ admin: false });
        }
      } else {
        const result = await userCollection.find().toArray();
        res.send(result);
      }
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedInfo = req.body;
      const { name, image, blood, division, district, password } = updatedInfo;
      // console.log(updatedInfo);
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          name,
          image,
          blood,
          division,
          district,
          password,
        },
      };
      const user = await userCollection.updateOne(filter, updatedDoc);
      res.send(user);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // donation requests api
    app.get("/donation_requests/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.findOne(filter);
      res.send(result);
    });

    app.get("/donation_requests", async (req, res) => {
      const status = req.query;
      const query = { status: status.status };
      // console.log(query);
      if (status) {
        const result = await donationRequestCollection.find(query).toArray();
        // console.log(result);
        res.send(result);
      } else {
        const result = await donationRequestCollection.find().toArray();
        res.send(result);
      }
    });

    app.patch("/donation_requests/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const {
        requester_name,
        requester_email,
        district,
        upazilla,
        recipient_name,
        hospital,
        adresss,
        date,
        time,
        description,
      } = req.body;
      const updatedDoc = {
        $set: {
          requester_name,
          requester_email,
          district,
          upazilla,
          recipient_name,
          hospital,
          adresss,
          date,
          time,
          description,
        },
      };
      const result = await donationRequestCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.post("/donation_requests", async (req, res) => {
      const reqestData = req.body;
      const result = await donationRequestCollection.insertOne(reqestData);
      res.send(result);
    });

    app.delete("/donation_requests/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.deleteOne(filter);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Blodify server is running");
});

app.listen(port, () => {
  console.log("Server running on port", port);
});
