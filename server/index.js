/*********************************
 * GLOBAL ERROR HANDLING
 *********************************/
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED PROMISE:", err);
});

/*********************************
 * INIT
 *********************************/
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

/*********************************
 * REQUEST LOGGER
 *********************************/
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

/*********************************
 * HEALTH CHECK
 *********************************/
app.get("/", (req, res) => {
  res.send("✅ Backend is running");
});

/*********************************
 * AUTH MIDDLEWARE
 *********************************/
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/*********************************
 * SIGNUP
 *********************************/
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existing = await pool.query(
      "SELECT id FROM auth_users WHERE email = $1",
      [email]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const userRes = await pool.query(
      "INSERT INTO auth_users (email) VALUES ($1) RETURNING id, email",
      [email]
    );

    const hashed = await argon2.hash(password);

    await pool.query(
      `
      INSERT INTO auth_accounts ("userId", provider, password)
      VALUES ($1,'credentials',$2)
      `,
      [userRes.rows[0].id, hashed]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ SIGNUP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/*********************************
 * LOGIN
 *********************************/
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRes = await pool.query(
      "SELECT * FROM auth_users WHERE email = $1",
      [email]
    );
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accRes = await pool.query(
      `SELECT * FROM auth_accounts WHERE "userId" = $1 AND provider = 'credentials'`,
      [userRes.rows[0].id]
    );

    const valid = await argon2.verify(accRes.rows[0].password, password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: userRes.rows[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/*********************************
 * CHECK IF PROFILE EXISTS ✅ FIXED
 *********************************/
/*********************************
 * CHECK IF PROFILE EXISTS
 *********************************/
/*********************************
 * CHECK IF PROFILE EXISTS + RETURN PROFILE ✅ FINAL
 *********************************/
app.get("/users/profile", authMiddleware, async (req, res) => {
  try {
    console.log("🔍 GET /users/profile for user:", req.user.id);

    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE "userId" = $1 LIMIT 1',
      [req.user.id]
    );

    const exists = result.rowCount > 0;
    console.log("📊 profile exists:", exists);

    return res.json({
      exists,
      profile: exists ? result.rows[0] : null,
    });
  } catch (err) {
    console.error("❌ PROFILE GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/*********************************
 * SAVE / UPDATE PROFILE ✅ FINAL
 *********************************/
app.put("/users/profile", authMiddleware, async (req, res) => {
  try {
    console.log("💾 PUT /users/profile for user:", req.user.id);
    console.log("📦 body:", req.body);

    const {
      gender,
      age,
      height,
      weight,
      activityLevel,
      fitnessGoal,
      trainingPerWeek,
    } = req.body;

    await pool.query(
      `
      INSERT INTO user_profiles (
        "userId", gender, age, height, weight,
        activity_level, fitness_goal, training_per_week
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT ("userId")
      DO UPDATE SET
        gender = EXCLUDED.gender,
        age = EXCLUDED.age,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        activity_level = EXCLUDED.activity_level,
        fitness_goal = EXCLUDED.fitness_goal,
        training_per_week = EXCLUDED.training_per_week
      `,
      [
        req.user.id,
        gender,
        age,
        height,
        weight,
        activityLevel,
        fitnessGoal,
        trainingPerWeek,
      ]
    );

    console.log("✅ PROFILE SAVED OK");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ PROFILE SAVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



/*********************************
 * START SERVER
 *********************************/
app.listen(4000, "0.0.0.0", () => {
  console.log("🚀 Backend running on http://0.0.0.0:4000");
});
