const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { auth } = require("express-openid-connect");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// auth0
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  routes: {
    postLogoutRedirect: "http://localhost:3000",
  },
  authorizationParams: {
    response_type: "code",
    scope: "openid profile email",
  },
};

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

app.use(auth(config));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_SRV);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

connectDB();

app.get("/", (req, res) => {
  res.redirect("http://localhost:3000");
});

app.get("/success", (req, res) => {
  res.redirect("http://localhost:3000");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
