const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { auth, requiresAuth } = require("express-openid-connect");
const User = require("./models/User");

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

app.use(auth(config));

app.use(async (req, res, next) => {
  if (req.oidc.isAuthenticated()) {
    try {
      const userInfo = req.oidc.user;

      await User.findOneAndUpdate(
        { auth0Id: userInfo.sub },
        {
          auth0Id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          nickname: userInfo.nickname,
          lastLogin: new Date(),
        },
        {
          upsert: true,
          new: true,
        }
      );
    } catch (error) {
      console.error("Error saving user:", error);
    }
  }
  next();
});

app.get("/", (req, res) => {
  res.redirect("http://localhost:3000");
});

app.get("/success", (req, res) => {
  res.redirect("http://localhost:3000");
});

app.get("/api/auth-status", (req, res) => {
  res.json({
    message: "Server is running!",
    timestamp: new Date().toISOString(),
    authenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user || null,
  });
});

app.get("/profile", requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}).select("-__v");
    res.json({
      count: users.length,
      users: users,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
