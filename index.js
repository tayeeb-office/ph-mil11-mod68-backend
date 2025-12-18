const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = 5000;

const app = express();
app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

module.exports = verifyFBToken;

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://assignment_11:8zYDGilWnFnjPBl3@cluster0.0nyvlxc.mongodb.net/?appName=Cluster0";

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
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("assignment_11");
    const userCollections = database.collection("user");
    const requestCollections = database.collection("request");

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "donor";
      userInfo.status = "active";
      const result = await userCollections.insertOne(userInfo);
      res.send(result);
    });

    app.get("/dashboard/requests", async (req, res) => {
      const result = await requestCollections.find().toArray();
      res.status(200).send(result);
    });

    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.status(200).send(result);
    });

    app.get("/dashboard/requests", async (req, res) => {
      const email = req.query.email;

      if (!email)
        return res.status(400).send({ message: "email query required" });

      const result = await requestCollections
        .find({ requesterEmail: email })
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/users/role/:email", async (req, res) => {
      const { email } = req.params;

      const query = { email };
      const result = await userCollections.findOne(query);

      res.send(result);
    });

    app.post("/requests", verifyFBToken, async (req, res) => {
      const requestInfo = req.body;
      requestInfo.status = "pending";
      const result = await requestCollections.insertOne(requestInfo);
      res.send(result);
    });

    app.patch("/update/user/status", verifyFBToken, async (req, res) => {
      try {
        const { email, status } = req.query;

        if (!email || !status) {
          return res
            .status(400)
            .send({ message: "Email and status are required" });
        }

        const query = { email };

        const updateStatus = {
          $set: {
            status: status,
          },
        };

        const result = await userCollections.updateOne(query, updateStatus);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update user status" });
      }
    });

    await client.db("admin").command({ ping: 1 });
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
  res.send("Hello Developers");
});

app.listen(port, () => {
  console.log(`server is runnion on ${port}`);
});
