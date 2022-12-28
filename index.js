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
    const appointOptCollection = client
      .db("Doctor_praxis")
      .collection("AppointmentOptions");

    app.get("/appointmentOptions", async (req, res) => {
      const query = {};
      const options = await appointOptCollection.find(query).toArray();
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
