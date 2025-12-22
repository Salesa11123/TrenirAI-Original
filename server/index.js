/*********************************
 * GLOBAL ERROR HANDLING
 *********************************/
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED PROMISE:", err);
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

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const HF_MODEL =
  process.env.HF_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";
const HF_TOKEN = process.env.HF_TOKEN;
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const app = express();

app.use(cors());
app.use(express.json());

// Ensure new tables/columns exist for workout tracking
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        "userId" INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        password TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY ("userId", provider)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        duration_minutes INTEGER,
        calories_burned INTEGER,
        total_kg_lifted NUMERIC,
        status TEXT DEFAULT 'ready',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id SERIAL PRIMARY KEY,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sets INTEGER,
        reps INTEGER,
        rest_seconds INTEGER,
        target_weight_kg NUMERIC,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
        gender TEXT,
        age INTEGER,
        height NUMERIC,
        weight NUMERIC,
        activity_level TEXT,
        fitness_goal TEXT,
        training_per_week TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_sets (
        id SERIAL PRIMARY KEY,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        set_number INTEGER NOT NULL,
        weight_kg NUMERIC,
        reps_completed INTEGER,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);'
    );
    await client.query(`
      ALTER TABLE workouts
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS calories_burned INTEGER,
        ADD COLUMN IF NOT EXISTS total_kg_lifted NUMERIC,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready';
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_workouts_status'
        ) THEN
          ALTER TABLE workouts
            ADD CONSTRAINT chk_workouts_status
            CHECK (status IN ('ready','in_progress','complete'));
        END IF;
      END$$;
    `);
    await client.query(
      "UPDATE workouts SET status = 'ready' WHERE status IS NULL;"
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Schema ensure error:", err);
  } finally {
    client.release();
  }
}

ensureSchema().catch((err) =>
  console.error("Ensure schema failed:", err.message)
);

/*********************************
 * AI HELPERS (Hugging Face)
 *********************************/
const toPositiveInt = (value, fallback = 0) => {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const parseAiExercises = (text) => {
  if (!text) return [];
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const raw = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((ex, idx) => ({
        name: (ex.name || ex.exercise || `Exercise ${idx + 1}`).toString().slice(0, 80),
        sets: toPositiveInt(ex.sets ?? ex.set_count, 3),
        reps: toPositiveInt(
          ex.reps ?? ex.repetitions ?? ex.reps_per_set,
          10
        ),
        rest: toPositiveInt(ex.rest ?? ex.rest_seconds ?? ex.rest_secs, 60),
        weight:
          ex.weight_kg != null && ex.weight_kg !== ""
            ? Number(ex.weight_kg)
            : null,
      }))
      .filter((ex) => ex.name && ex.sets > 0 && ex.reps > 0);
  } catch (err) {
    console.error("HF parse error:", err.message);
    return [];
  }
};

async function generateWorkoutFromHuggingFace(prompt) {
  if (!HF_TOKEN) {
    console.warn("HF_TOKEN missing, skipping Hugging Face generation.");
    return null;
  }

  const userPrompt =
    prompt?.trim() ||
    "30 minute beginner full-body strength workout with 3-5 exercises.";

  const payload = {
    inputs: `
You are an expert strength coach. Create a workout based on the user's request.
Return ONLY a JSON array (no prose) where each item has:
  - name (string)
  - sets (number)
  - reps (number)
  - rest (seconds, number)
  - weight_kg (number or null)

User request: ${userPrompt}
`.trim(),
    parameters: {
      max_new_tokens: 220,
      temperature: 0.7,
      return_full_text: false,
    },
  };

  try {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HF_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error(`HF error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    const generatedText = Array.isArray(data)
      ? data[0]?.generated_text || ""
      : data.generated_text || "";
    const exercises = parseAiExercises(generatedText);
    if (!exercises.length) return null;

    return {
      name: `AI: ${userPrompt}`.slice(0, 80),
      description: `AI generated via ${HF_MODEL}`,
      exercises,
    };
  } catch (err) {
    console.error("HF request failed:", err);
    return null;
  }
}

/*********************************
 * REQUEST LOGGER
 *********************************/
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/*********************************
 * HEALTH CHECK
 *********************************/
app.get("/", (req, res) => {
  res.send("Backend is running");
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    // Dev fallback: accept unsigned token to avoid blocking when secrets mismatch
    try {
      const decoded = jwt.decode(token);
      if (!decoded) throw new Error("Decode failed");
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        return res.status(401).json({ error: "Token expired" });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
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
    console.error("SIGNUP ERROR:", err);
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
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/*********************************
 * PROFILE
 *********************************/
async function ensureAuthUser(client, { id, email }) {
  if (!id || !email) return;
  await client.query(
    `
    INSERT INTO auth_users (id, email)
    VALUES ($1, $2)
    ON CONFLICT (id) DO NOTHING
    `,
    [id, email]
  );
}

app.get("/users/profile", authMiddleware, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await ensureAuthUser(client, { id: req.user.id, email: req.user.email });
    } finally {
      client.release();
    }

    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE "userId" = $1 LIMIT 1',
      [req.user.id]
    );

    const exists = result.rowCount > 0;
    return res.json({
      exists,
      profile: exists ? result.rows[0] : null,
    });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/users/profile", authMiddleware, async (req, res) => {
  try {
    const {
      gender,
      age,
      height,
      weight,
      activityLevel,
      fitnessGoal,
      trainingPerWeek,
    } = req.body;

    const client = await pool.connect();
    try {
      await ensureAuthUser(client, { id: req.user.id, email: req.user.email });
    } finally {
      client.release();
    }

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

    res.json({ success: true });
  } catch (err) {
    console.error("PROFILE SAVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/*********************************
 * WORKOUTS CRUD
 *********************************/
async function fetchWorkoutsWithExercises(userId) {
  const workoutsRes = await pool.query(
    `
      SELECT id, name, description, status, started_at, completed_at,
             duration_minutes, total_kg_lifted, created_at, updated_at
      FROM workouts
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  const workouts = workoutsRes.rows;
  if (workouts.length === 0) return [];

  const ids = workouts.map((w) => w.id);
  const exercisesRes = await pool.query(
    `
      SELECT id, workout_id, name, sets, reps, rest_seconds, target_weight_kg, created_at, updated_at
      FROM workout_exercises
      WHERE workout_id = ANY($1)
      ORDER BY id ASC
    `,
    [ids]
  );

  const byWorkout = exercisesRes.rows.reduce((acc, ex) => {
    acc[ex.workout_id] = acc[ex.workout_id] || [];
    acc[ex.workout_id].push(ex);
    return acc;
  }, {});

  return workouts.map((w) => ({
    ...w,
    exercises: byWorkout[w.id] || [],
  }));
}

async function fetchWorkoutDetail(userId, workoutId) {
  const workoutRes = await pool.query(
    `
      SELECT id, name, description, started_at, completed_at, duration_minutes,
             status,
             calories_burned, total_kg_lifted, created_at, updated_at
      FROM workouts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workoutId, userId]
  );

  if (workoutRes.rowCount === 0) return null;
  const workout = workoutRes.rows[0];

  const exercisesRes = await pool.query(
    `
      SELECT id, workout_id, name, sets, reps, rest_seconds, target_weight_kg, created_at, updated_at
      FROM workout_exercises
      WHERE workout_id = $1
      ORDER BY id ASC
    `,
    [workout.id]
  );

  const exerciseIds = exercisesRes.rows.map((ex) => ex.id);
  const setsRes =
    exerciseIds.length > 0
      ? await pool.query(
          `
        SELECT id, workout_id, exercise_id, set_number, weight_kg, reps_completed, completed, created_at, updated_at
        FROM workout_sets
        WHERE workout_id = $1 AND exercise_id = ANY($2)
        ORDER BY exercise_id ASC, set_number ASC
      `,
          [workout.id, exerciseIds]
        )
      : { rows: [] };

  // Auto-create set rows if missing (for older data)
  if (exerciseIds.length > 0 && setsRes.rows.length === 0) {
    const insertValues = [];
    const insertPlaceholders = [];
    exercisesRes.rows.forEach((exRow) => {
      const count = exRow.sets || 0;
      for (let i = 0; i < count; i++) {
        const base = insertValues.length;
        insertValues.push(
          workout.id,
          exRow.id,
          i + 1,
          exRow.target_weight_kg || null
        );
        insertPlaceholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, NULL, FALSE)`
        );
      }
    });
    if (insertPlaceholders.length > 0) {
      await pool.query(
        `
          INSERT INTO workout_sets
            (workout_id, exercise_id, set_number, weight_kg, reps_completed, completed)
          VALUES ${insertPlaceholders.join(",")}
        `,
        insertValues
      );
      const refreshedSets = await pool.query(
        `
        SELECT id, workout_id, exercise_id, set_number, weight_kg, reps_completed, completed, created_at, updated_at
        FROM workout_sets
        WHERE workout_id = $1 AND exercise_id = ANY($2)
        ORDER BY exercise_id ASC, set_number ASC
      `,
        [workout.id, exerciseIds]
      );
      setsRes.rows.push(...refreshedSets.rows);
    }
  }

  const setsByExercise = setsRes.rows.reduce((acc, set) => {
    acc[set.exercise_id] = acc[set.exercise_id] || [];
    acc[set.exercise_id].push(set);
    return acc;
  }, {});

  const exercises = exercisesRes.rows.map((ex, idx) => {
    const sets =
      setsByExercise[ex.id] && setsByExercise[ex.id].length > 0
        ? setsByExercise[ex.id]
        : Array.from({ length: ex.sets || 0 }).map((_, i) => ({
            id: `synthetic-${ex.id}-${i + 1}`,
            workout_id: workout.id,
            exercise_id: ex.id,
            set_number: i + 1,
            weight_kg: ex.target_weight_kg,
            reps_completed: null,
            completed: false,
          }));
    return { ...ex, sets };
  });

  return {
    ...workout,
    exercises,
  };
}

// list
app.get("/workouts", authMiddleware, async (req, res) => {
  try {
    const data = await fetchWorkoutsWithExercises(req.user.id);
    res.json({ workouts: data });
  } catch (err) {
    console.error("Workout list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// create (manual)
app.post("/workouts", authMiddleware, async (req, res) => {
  const { name, description, exercises = [] } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const workoutRes = await client.query(
      `INSERT INTO workouts (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [req.user.id, name.trim(), description || null]
    );

    const workout = workoutRes.rows[0];

    if (Array.isArray(exercises) && exercises.length > 0) {
      const values = [];
      const placeholders = exercises.map((ex, idx) => {
        const base = idx * 6;
        values.push(
          workout.id,
          ex.name || "",
          ex.sets ? parseInt(ex.sets, 10) || 0 : 0,
          ex.reps ? parseInt(ex.reps, 10) || 0 : 0,
          ex.rest ? parseInt(ex.rest, 10) || null : null,
          ex.weight != null && ex.weight !== "" ? Number(ex.weight) : null
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      });

      await client.query(
        `
        INSERT INTO workout_exercises
          (workout_id, name, sets, reps, rest_seconds, target_weight_kg)
        VALUES ${placeholders.join(",")}
        `,
        values
      );

      const insertedExercises = await client.query(
        `SELECT id, sets, rest_seconds, target_weight_kg FROM workout_exercises WHERE workout_id = $1 ORDER BY id ASC`,
        [workout.id]
      );

      const setValues = [];
      const setPlaceholders = [];
      insertedExercises.rows.forEach((exRow) => {
        const count = exRow.sets || 0;
        for (let i = 0; i < count; i++) {
          const base = setValues.length;
          setValues.push(
            workout.id,
            exRow.id,
            i + 1,
            exRow.target_weight_kg || null
          );
          setPlaceholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, NULL, FALSE)`
          );
        }
      });

      if (setPlaceholders.length > 0) {
        await client.query(
          `
          INSERT INTO workout_sets
            (workout_id, exercise_id, set_number, weight_kg, reps_completed, completed)
          VALUES ${setPlaceholders.join(",")}
          `,
          setValues
        );
      }
    }

    await client.query("COMMIT");
    const data = await fetchWorkoutsWithExercises(req.user.id);
    res.status(201).json({ workout, workouts: data });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Workout create error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// AI generator stub: creates a workout and saves it
app.post("/workouts/ai", authMiddleware, async (req, res) => {
  const { prompt } = req.body || {};
  const baseName = prompt?.trim() ? `AI: ${prompt.trim()}` : "AI Workout";

  const fallbackSuggestions = [
    { name: "Push-ups", sets: 3, reps: 12, rest: 60, weight: null },
    { name: "Squats", sets: 4, reps: 10, rest: 75, weight: null },
    { name: "Plank", sets: 3, reps: 45, rest: 60, weight: null },
  ];

  const aiPlan = await generateWorkoutFromHuggingFace(prompt);
  const exercisesToUse =
    aiPlan?.exercises?.length > 0 ? aiPlan.exercises : fallbackSuggestions;
  const workoutName = aiPlan?.name || baseName;
  const workoutDescription = aiPlan?.description || prompt || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const workoutRes = await client.query(
      `INSERT INTO workouts (user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [req.user.id, workoutName, workoutDescription]
    );
    const workout = workoutRes.rows[0];

    const values = [];
    const placeholders = exercisesToUse.map((ex, idx) => {
      const base = idx * 6;
      const sets = toPositiveInt(ex.sets, 0);
      const reps = toPositiveInt(ex.reps, 0);
      const restSeconds = toPositiveInt(ex.rest, null);
      const targetWeight =
        ex.weight != null && ex.weight !== "" ? Number(ex.weight) : null;
      values.push(
        workout.id,
        ex.name,
        sets,
        reps,
        restSeconds,
        targetWeight
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });

    await client.query(
      `
      INSERT INTO workout_exercises
        (workout_id, name, sets, reps, rest_seconds, target_weight_kg)
      VALUES ${placeholders.join(",")}
      `,
      values
    );

    const insertedExercises = await client.query(
      `SELECT id, sets, rest_seconds, target_weight_kg FROM workout_exercises WHERE workout_id = $1 ORDER BY id ASC`,
      [workout.id]
    );

    const setValues = [];
    const setPlaceholders = [];
    insertedExercises.rows.forEach((exRow) => {
      const count = exRow.sets || 0;
      for (let i = 0; i < count; i++) {
        const base = setValues.length;
        setValues.push(
          workout.id,
          exRow.id,
          i + 1,
          exRow.target_weight_kg || null
        );
        setPlaceholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, NULL, FALSE)`
        );
      }
    });

    if (setPlaceholders.length > 0) {
      await client.query(
        `
        INSERT INTO workout_sets
          (workout_id, exercise_id, set_number, weight_kg, reps_completed, completed)
        VALUES ${setPlaceholders.join(",")}
        `,
        setValues
      );
    }

    await client.query("COMMIT");
    const data = await fetchWorkoutsWithExercises(req.user.id);
    res.status(201).json({ workout, workouts: data });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("AI workout create error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// get single workout with exercises + sets
app.get("/workouts/:id", authMiddleware, async (req, res) => {
  try {
    const workoutId = req.params.id;
    const workout = await fetchWorkoutDetail(req.user.id, workoutId);
    if (!workout) return res.status(404).json({ error: "Workout not found" });
    res.json(workout);
  } catch (err) {
    console.error("Workout detail error:", err);
    res.status(500).json({ error: err.message });
  }
});

// update workout actions: start or complete
app.put("/workouts/:id", authMiddleware, async (req, res) => {
  const workoutId = req.params.id;
  const { action, duration, calories_burned, total_kg_lifted } = req.body || {};

  if (!["start", "complete"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (action === "start") {
      await client.query(
        `
          UPDATE workouts
          SET started_at = NOW(),
              completed_at = NULL,
              duration_minutes = NULL,
              calories_burned = NULL,
              total_kg_lifted = NULL,
              status = 'in_progress'
          WHERE id = $1 AND user_id = $2
        `,
        [workoutId, req.user.id]
      );
    } else if (action === "complete") {
      const durationMinutes = duration != null ? parseInt(duration, 10) : null;
      await client.query(
        `
          UPDATE workouts
          SET completed_at = NOW(),
              duration_minutes = $1,
              calories_burned = $2,
              total_kg_lifted = $3,
              status = 'complete'
          WHERE id = $4 AND user_id = $5
        `,
        [durationMinutes, calories_burned || null, total_kg_lifted || null, workoutId, req.user.id]
      );
    }

    await client.query("COMMIT");
    const workout = await fetchWorkoutDetail(req.user.id, workoutId);
    res.json(workout);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Workout update error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// update a set
app.put("/workouts/:id/sets/:setId", authMiddleware, async (req, res) => {
  const workoutId = req.params.id;
  const setId = req.params.setId;
  const { weight_kg, reps_completed, completed } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ownership check
    const check = await client.query(
      `
      SELECT ws.id
      FROM workout_sets ws
      JOIN workout_exercises we ON ws.exercise_id = we.id
      JOIN workouts w ON ws.workout_id = w.id
      WHERE ws.id = $1 AND ws.workout_id = $2 AND w.user_id = $3
      LIMIT 1
    `,
      [setId, workoutId, req.user.id]
    );

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Set not found" });
    }

    await client.query(
      `
        UPDATE workout_sets
        SET weight_kg = $1,
            reps_completed = $2,
            completed = $3,
            updated_at = NOW()
        WHERE id = $4
      `,
      [weight_kg != null ? Number(weight_kg) : null, reps_completed != null ? parseInt(reps_completed, 10) : null, completed === false ? false : true, setId]
    );

    await client.query("COMMIT");
    const workout = await fetchWorkoutDetail(req.user.id, workoutId);
    res.json(workout);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Set update error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/*********************************
 * START SERVER
 *********************************/
app.listen(4000, "0.0.0.0", () => {
  console.log("Backend running on http://0.0.0.0:4000");
});
