const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = 5000;

const app = express();
app.use(cors());
app.use(express.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");

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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0nyvlxc.mongodb.net/?appName=Cluster0`;

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
    // Send a ping to confirm a successful connection

    const database = client.db("assignment_11");
    const userCollections = database.collection("user");
    const requestCollections = database.collection("request");
    const fundingCollections = database.collection("fund");

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "donor";
      userInfo.status = "active";
      const result = await userCollections.insertOne(userInfo);
      res.send(result);
    });

    app.get("/requests", verifyFBToken, async (req, res) => {
      const result = await requestCollections.find().toArray();
      res.send(result);
    });

    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.status(200).send(result);
    });

    app.get("/dashboard/requests", async (req, res) => {
      try {
        const email = req.query.email;

        // if email exists => return only that user's requests
        if (email) {
          const result = await requestCollections
            .find({ requesterEmail: email })
            .sort({ _id: -1 })
            .toArray();
          return res.send(result);
        }

        const result = await requestCollections.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch requests" });
      }
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

    app.patch("/update/user/role", verifyFBToken, async (req, res) => {
      try {
        const { email, role } = req.query;

        if (!email || !role) {
          return res
            .status(400)
            .send({ message: "Email and role are required" });
        }

        const query = { email };

        const updaterole = {
          $set: {
            role: role,
          },
        };

        const result = await userCollections.updateOne(query, updaterole);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update user role" });
      }
    });

    app.patch("/update/request/status", verifyFBToken, async (req, res) => {
      try {
        const { id, status } = req.query;

        if (!id || !status) {
          return res
            .status(400)
            .send({ message: "ID and status are required" });
        }

        const query = { _id: new ObjectId(id) };
        const updateStatus = { $set: { status } };

        const result = await requestCollections.updateOne(query, updateStatus);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update request status" });
      }
    });

    app.get("/requests/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await requestCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Request not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch request" });
      }
    });

    app.patch("/requests/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;

        const {
          recipientName,
          bloodGroup,
          district,
          upazila,
          address,
          hospitalName,
          donationDate,
          donationTime,
          message,
        } = req.body;

        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            recipientName,
            bloodGroup,
            district,
            upazila,
            address,
            hospitalName,
            donationDate,
            donationTime,
            message: message || "",
          },
        };

        const result = await requestCollections.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Request not found" });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update request" });
      }
    });

    app.delete("/requests/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await requestCollections.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Request not found" });
        }

        res.send({ message: "Deleted successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to delete request" });
      }
    });

    app.get("/my-request", verifyFBToken, async (req, res) => {
      try {
        const email = req.decoded_email;

        const size = Number(req.query.size) || 10;
        const page = Number(req.query.page) || 0;

        const query = { requesterEmail: email };

        const requests = await requestCollections
          .find(query)
          .sort({ _id: -1 })
          .limit(size)
          .skip(size * page)
          .toArray();

        const totalRequest = await requestCollections.countDocuments(query);

        res.send({ request: requests, totalRequest });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to load my requests" });
      }
    });

    app.get("/all-request", verifyFBToken, async (req, res) => {
      try {
        const size = Number(req.query.size) || 10;
        const page = Number(req.query.page) || 0;

        const requests = await requestCollections
          .find({})
          .sort({ _id: -1 })
          .limit(size)
          .skip(size * page)
          .toArray();

        const totalRequest = await requestCollections.countDocuments({});

        res.send({ request: requests, totalRequest });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to load all requests" });
      }
    });

    app.post("/create-payment-checkout", async (req, res) => {
      try {
        const information = req.body;

        const amount = Number(information.donateAmount);
        if (!amount || amount < 1)
          return res.status(400).send({ message: "Invalid amount" });
        const amountInCents = Math.round(amount * 100);

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amountInCents,
                product_data: {
                  name: "Please Donate",
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            donorName: information?.donorName || "Anonymous",
          },
          customer_email: information.donorEmail,
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to create checkout session" });
      }
    });

    app.post("/funding-history", verifyFBToken, async (req, res) => {
      try {
        const fundingInfo = {
          donorName: req.body.donorName,
          donorEmail: req.decoded_email,
          donateAmount: Number(req.body.donateAmount),
          createdAt: new Date(),
        };

        const result = await fundingCollections.insertOne(fundingInfo);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to save funding history" });
      }
    });

    app.get("/funding-history", verifyFBToken, async (req, res) => {
      try {
        const email = req.decoded_email;

        const result = await fundingCollections
          .find({ donorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch funding history" });
      }
    });

    app.get("/donor-search", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;

        const query = {
          role: "donor",
          status: "active",
        };

        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const donors = await userCollections
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        res.send(donors);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to search donors" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollections.findOne({ email });

        if (!user) return res.status(404).send({ message: "User not found" });
        res.send(user);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to load user" });
      }
    });

    app.patch("/users/:email", verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;

        if (email !== req.decoded_email) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const { username, bloodGroup, district, upazila, imageUrl } = req.body;

        const updateDoc = {
          $set: {
            username,
            bloodGroup,
            district,
            upazila,
            ...(imageUrl ? { imageUrl } : {}),
          },
        };

        const result = await userCollections.updateOne({ email }, updateDoc);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to update profile" });
      }
    });

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
  res.send("Hello Developers");
});

module.exports = app;

// app.listen(port, () => {
//   console.log(`server is runnion on ${port}`);
// });
