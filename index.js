const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");

const cors = require("cors");
const app = express();
require("dotenv").config();

const port = process.env.PORT || 5000;

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

async function connect() {
  try {
    const bookingCollection = client.db("Doctor_praxis").collection("bookings");
    const appointOptCollection = client
      .db("Doctor_praxis")
      .collection("AppointmentOptions");

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      console.log(date);
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
        console.log(bookedSlots);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(options);
    });
  } finally {
  }
}
connect().catch((er) => console.error(er.messgae));

app.get("/", async (req, res) => {
  res.send("Doctor_praxis_Server running");
});

app.listen(port, () => console.log("Doctor_praxis_Server running on ", port));
