const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middlewares
app.use(cors());
app.use(express.json());

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
    const blogCollection = client.db("Bloodify").collection("blogs");
    const paymentCollection = client.db("Bloodify").collection("payments");

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log(req.headers);
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      const token = req.headers?.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send("Forbidden Access");
      }
      next();
    };

    const verifyAdminOrVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdminOrVolunteer =
        user?.role === "admin" || user?.role === "volunteer";
      if (!isAdminOrVolunteer) {
        return res.status(403).send("Forbidden Access");
      }
      next();
    };

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.JWT_SECRET_TOKEN, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // client secret for stripe payment and payment history
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price);
      if (!price || amount < 1) {
        return;
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    });

    // users api
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      res.send(user);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const query = { email: req.params?.email };
      // console.log(query);
      const user = await userCollection.findOne(query);
      if (user.role === "admin") {
        return res.send({ admin: true });
      } else {
        return res.send({ admin: false });
      }
    });

    app.get("/users/volunteer/:email", async (req, res) => {
      const query = { email: req.params?.email };
      const user = await userCollection.findOne(query);
      if (user.role === "volunteer") {
        return res.send({ volunteer: true });
      } else {
        return res.send({ volunteer: false });
      }
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const queryStatus = req.query;
      // console.log(queryStatus);
      if (queryStatus.status) {
        const filterUser = { status: queryStatus };
        const users = await userCollection.find(queryStatus).toArray();
        return res.send(users);
      }
      // const filter = JSON.parse(req.query.query);
      // console.log(filter);
      // const query = {blood: filter.blood, district: filter.district};
      // console.log(result);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/donor", async (req, res) => {
      console.log("inside ");
      console.log(req.query);
      // const filterData = req.query;
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedInfo = req.body;
      const filter = { email: email };
      // console.log(updatedInfo);
      if (updatedInfo.status) {
        const updatedDoc = {
          $set: {
            status: updatedInfo?.status,
          },
        };
        const user = await userCollection.updateOne(filter, updatedDoc);
        return res.send(user);
      } else if (updatedInfo.role) {
        const updatedDoc = {
          $set: {
            role: updatedInfo?.role,
          },
        };
        const user = await userCollection.updateOne(filter, updatedDoc);
        return res.send(user);
      }
      const { name, image, blood, division, district, password } = updatedInfo;
      // console.log(updatedInfo);
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
    app.get("/donation_requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.findOne(filter);
      // console.log(result);
      res.send(result);
    });

    app.get(
      "/donation_requests/filter/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        const status = req.query;
        // console.log(email, status);
        const query = { requester_email: email };
        const allRequests = await donationRequestCollection
          .find(query)
          .toArray();
        // console.log(allRequests);
        if (status.status === "all") {
          return res.send(allRequests);
        } else if (status.status) {
          const query = { status: status.status };
          const requestsOfStatus = await allRequests.filter(
            (request) => request.status === status.status
          );
          return res.send(requestsOfStatus);
        }
        res.send(allRequests);
      }
    );

    app.get("/donation_requests", async (req, res) => {
      const status = req.query;
      const query = { status: status.status };
      if (status.status) {
        const result = await donationRequestCollection.find(query).toArray();
        // console.log(result);
        return res.send(result);
      }
      const result = await donationRequestCollection.find().toArray();
      res.send(result);
    });

    app.get("/donation_requests/all", async (req, res) => {
      console.log("inside");
      const status = req.query;
      const query = { status: status.status };
      console.log("inside api");
      if (status.status === "all") {
        const allRequests = await donationRequestCollection.find().toArray();
        return res.send(allRequests);
      }
      if (status.status) {
        const result = await donationRequestCollection.find(query).toArray();
        // console.log(result);
        return res.send(result);
      }
      const result = await donationRequestCollection.find().toArray();
      res.send(result);
    });

    app.patch(
      "/donation_requests/:id",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id)
        const filter = { _id: new ObjectId(id) };
        const { donor_name, donor_email, status } = req.body;
        const { targetStatus } = req.body;
        if (targetStatus) {
          const updatedDoc = {
            $set: {
              status: targetStatus,
            },
          };
          const result = await donationRequestCollection.updateOne(
            filter,
            updatedDoc
          );
          return res.send(result);
        }
        if (status && donor_name && donor_email) {
          const updatedDoc = {
            $set: {
              donor_name,
              donor_email,
              status,
            },
          };
          const result = await donationRequestCollection.updateOne(
            filter,
            updatedDoc
          );
          return res.send(result);
        }

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
            donor_name,
            donor_email,
            status,
          },
        };
        const result = await donationRequestCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    app.post("/donation_requests", async (req, res) => {
      const reqestData = req.body;
      const result = await donationRequestCollection.insertOne(reqestData);
      res.send(result);
    });

    app.delete(
      "/donation_requests/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id)
        const filter = { _id: new ObjectId(id) };
        const result = await donationRequestCollection.deleteOne(filter);
        res.send(result);
      }
    );

    // content management api
    // DONE: check this api work perfectly
    app.get("/blogs", verifyToken, verifyAdminOrVolunteer, async (req, res) => {
      const status = req.query;
      if (status.status === "all") {
        const allBlogs = await blogCollection.find().toArray();
        return res.send(allBlogs);
      } else if (status.status) {
        const query = { status: status.status };
        const filteredBlogs = await blogCollection.find(query).toArray();
        return res.send(filteredBlogs);
      }
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    app.post(
      "/blogs",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const blog = req.body;
        const result = await blogCollection.insertOne(blog);
        res.send(result);
      }
    );

    // DONE: check thsi api work perfectly
    app.patch("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const status = req.query.status;
      console.log(status);
      const filter = { _id: new ObjectId(req.params.id) };
      if (status === "draft") {
        const updatedDoc = {
          $set: {
            status: "published",
          },
        };
        const result = await blogCollection.updateOne(filter, updatedDoc);
        return res.send(result);
      } else if (status === "published") {
        const updatedDoc = {
          $set: {
            status: "draft",
          },
        };
        const result = await blogCollection.updateOne(filter, updatedDoc);
        return res.send(result);
      }
    });

    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogCollection.deleteOne(query);
      res.send(result);
    });

    // statistics
    app.get("/statistics", async (req, res) => {
      const users = await userCollection.find().toArray();
      const donationRequests = await donationRequestCollection.find().toArray();
      const allPayments = await paymentCollection.find().toArray();

      const totalFundings = allPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );
      res.send({
        users: users.length,
        donationRequests: donationRequests.length,
        totalFundings,
      });
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
