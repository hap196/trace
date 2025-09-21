const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { auth, requiresAuth } = require("express-openid-connect");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("./models/User");
const Location = require("./models/Location");

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

app.get("/api/locations", async (req, res) => {
  try {
    const locations = await Location.find({}).select("-__v");
    res.json({
      count: locations.length,
      locations: locations,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

app.get("/api/distributor/:zipcode", async (req, res) => {
  try {
    const { zipcode } = req.params;

    const quickbaseUrl = `https://cokecbs.quickbase.com/db/bj9gkzaia?act=API_GenResultsTable&apptoken=b65pay3cy963xcds84ppfnynrmd&query={%276%27.SW.%27${zipcode}%27}&clist=6.287.288.35.36&slist=6&options=sortorder-A.ned.nvw.nfg.&jsa=1`;

    const response = await fetch(quickbaseUrl, {
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.cokesolutions.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `QuickBase API responded with status: ${response.status}`
      );
    }

    const data = await response.text();

    try {
      const headingMatch = data.match(/qdb_heading\[(\d+)\] = "([^"]+)";/g);
      const headings = [];
      if (headingMatch) {
        headingMatch.forEach((match) => {
          const valueMatch = match.match(/qdb_heading\[\d+\] = "([^"]+)";/);
          if (valueMatch) headings.push(valueMatch[1]);
        });
      }

      const dataMatches = data.match(/qdb_data\[0\]\[(\d+)\] = "([^"]+)";/g);
      const rowData = [];
      if (dataMatches) {
        dataMatches.forEach((match) => {
          const valueMatch = match.match(/qdb_data\[0\]\[\d+\] = "([^"]+)";/);
          if (valueMatch) rowData.push(valueMatch[1]);
        });
      }

      if (headings.length > 0 && rowData.length > 0) {
        const distributor = {};
        headings.forEach((heading, index) => {
          distributor[heading] = rowData[index] || "";
        });

        const distributorInfo = {
          zipCode: distributor.ZipCode,
          bottlerOwner: distributor["pri Bottler Owner"],
          marketUnit: distributor["pri Market Unit"],
          salesCenter: distributor["pri Sales Center"],
          phone: distributor["pri Service"],
        };

        try {
          const salesCenterLocation = distributorInfo.salesCenter;
          const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            salesCenterLocation
          )}.json?access_token=${
            process.env.MAPBOX_ACCESS_TOKEN
          }&types=place&limit=1`;

          const geocodeResponse = await fetch(geocodeUrl);
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData.features && geocodeData.features.length > 0) {
              const feature = geocodeData.features[0];
              distributorInfo.fullAddress = feature.place_name;
              distributorInfo.coordinates = {
                lng: feature.center[0],
                lat: feature.center[1],
              };
              distributorInfo.geocoded = true;
            } else {
              distributorInfo.geocoded = false;
            }
          }
        } catch (geocodeError) {
          console.log("Geocoding failed:", geocodeError.message);
          distributorInfo.geocoded = false;
        }

        res.json({
          success: true,
          zipcode: zipcode,
          distributor: distributorInfo,
        });
      } else {
        res.json({
          success: false,
          message: "No distributor found for this zip code",
          zipcode: zipcode,
        });
      }
    } catch (parseError) {
      res.json({
        success: false,
        message: "Failed to parse distributor response",
        error: parseError.message,
        rawData: data.substring(0, 500),
      });
    }
  } catch (error) {
    console.error("Distributor lookup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to lookup distributor",
      message: error.message,
    });
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get("/api/water-sources/:bottlingCenter", async (req, res) => {
  try {
    const { bottlingCenter } = req.params;

    const coordsMatch = bottlingCenter.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    let locationQuery = bottlingCenter;

    if (coordsMatch) {
      const [, lat, lng] = coordsMatch;
      locationQuery = `latitude ${lat}, longitude ${lng}`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a JSON API. Given the bottling center location: ${locationQuery}
    
    Find the closest municipal water source and water treatment center.
    
    CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no code blocks.
    
    Required JSON format (replace values but keep exact structure):
    {
      "municipalWaterSource": {
        "name": "Name of the municipal water source",
        "address": "Full address or location description", 
        "distance": "5.2 km",
        "coordinates": {"lat": 40.7128, "lng": -74.0060}
      },
      "waterTreatmentCenter": {
        "name": "Name of the water treatment facility",
        "address": "Full address or location description",
        "distance": "3.1 km", 
        "coordinates": {"lat": 40.7589, "lng": -73.9851}
      }
    }
    
    Rules:
    - Distance must include "km" 
    - Coordinates must be decimal numbers
    - Use real facility names and addresses near the location
    - Return only the JSON object`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      let cleanText = text.trim();

      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      cleanText = cleanText.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");

      const startIndex = cleanText.indexOf("{");
      const lastIndex = cleanText.lastIndexOf("}");

      if (startIndex === -1 || lastIndex === -1 || startIndex >= lastIndex) {
        throw new Error("No valid JSON object found in response");
      }

      const jsonString = cleanText.substring(startIndex, lastIndex + 1);
      const waterSources = JSON.parse(jsonString);

      if (
        !waterSources.municipalWaterSource ||
        !waterSources.waterTreatmentCenter
      ) {
        throw new Error("Missing required water source data");
      }

      const validateSource = (source, type) => {
        if (
          !source.name ||
          !source.address ||
          !source.distance ||
          !source.coordinates
        ) {
          throw new Error(`Missing required fields in ${type}`);
        }
        if (
          typeof source.coordinates.lat !== "number" ||
          typeof source.coordinates.lng !== "number"
        ) {
          throw new Error(`Invalid coordinates in ${type}`);
        }
      };

      validateSource(waterSources.municipalWaterSource, "municipalWaterSource");
      validateSource(waterSources.waterTreatmentCenter, "waterTreatmentCenter");

      res.json({
        success: true,
        bottlingCenter: bottlingCenter,
        waterSources: waterSources,
      });
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", text);
      res.json({
        success: false,
        error: "Failed to parse water source information",
        details: parseError.message,
        rawResponse: text.substring(0, 500),
      });
    }
  } catch (error) {
    console.error("Water source lookup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to lookup water sources",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
