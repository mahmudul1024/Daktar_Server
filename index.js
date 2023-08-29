const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");

const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n9cwtsk.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  console.log("token inside Verifyjwt", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send("unauthorized access inside verify");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.TOKEN_ACCESS, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    console.log("suceess");
    console.log(req.decoded);
    next();
  });
}

async function connect() {
  try {
    const bookingCollection = client.db("Doctor_praxis").collection("bookings");
    const paymentsCollection = client
      .db("Doctor_praxis")
      .collection("payments");

    const usersCollection = client.db("Doctor_praxis").collection("users");
    const DoctorsCollection = client.db("Doctor_praxis").collection("doctors");
    const appointOptCollection = client
      .db("Doctor_praxis")
      .collection("AppointmentOptions");

    // make sure you use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access from put" });
      }
      next();
    };

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      console.log("booking len", bookings.length);
      res.send(bookings);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alreadyBooked = await bookingCollection.find(query).toArray();
      console.log(alreadyBooked);

      if (alreadyBooked.length) {
        const message = `you already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      // console.log(date);
      const query = {};
      const options = await appointOptCollection.find(query).toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingCollection
        .find(bookingQuery)
        .toArray();
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        // console.log(bookedSlots);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(options);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      console.log("backend /jwt", email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log("user ki pilam?", user);
      if (user) {
        const token = jwt.sign({ email }, process.env.TOKEN_ACCESS, {
          expiresIn: "30d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "nothing" });
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/appointmentSpeciality", async (req, res) => {
      const query = {};
      const result = await appointOptCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const options = { upsert: true };
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // app.get("/book", async (req, res) => {
    //   const filter = {};
    //   const updatedDoc = {
    //     $set: {
    //       price: 99,
    //     },
    //   };
    //   const options = { upsert: true };
    //   const result = await bookingCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      console.log("inside /doctor");
      const doctor = req.body;
      const result = await DoctorsCollection.insertOne(doctor);
      console.log("image server a chole gese");
      res.send(result);
    });

    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await DoctorsCollection.find(query).toArray();

      res.send(doctors);
    });

    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await DoctorsCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;
      const paymentIntents = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntents.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    // app.get("/v2/appointmentOptions", async (req, res) => {
    //   const date = req.query.date;
    //   const options = await appointOptCollection
    //     .aggregate([
    //       {
    //         $lookup: {
    //           from: "bookings",
    //           localField: "name",
    //           foreignField: "treatment",
    //           pipeline: [
    //             {
    //               $match: {
    //                 $expr: {
    //                   $eq: ["$appointmentDate", date],
    //                 },
    //               },
    //             },
    //           ],
    //           as: "booked",
    //         },
    //       },

    //       {
    //         $project: {
    //           name: 1,
    //           slots: 1,
    //           booked: {
    //             $map: {
    //               input: "$booked",
    //               as: "book",
    //               in: "$$book.slot",
    //             },
    //           },
    //         },
    //       },

    //       {
    //         $project: {
    //           name: 1,
    //           slots: {
    //             $setDefferance: ["$slots", "$booked"],
    //           },
    //         },
    //       },
    //     ])
    //     .toArray();
    //   res.send(options);
    // });
  } finally {
  }
}
connect().catch((er) => console.error(er.messgae));

app.get("/", async (req, res) => {
  res.send("Doctor_praxis_Server running");
});

app.listen(port, () => console.log("Doctor_praxis_Server running on ", port));
