const { Pool } = require("pg");

console.log("🔌 Trying to connect to database...");
console.log("DATABASE_URL =", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// TEST CONNECTION
pool.connect()
  .then(client => {
    console.log("🍀 Connected to database successfully!");
    return client.query("SELECT NOW()")
      .then(res => {
        console.log("🕒 DB Time:", res.rows[0]);
        client.release();
      });
  })
  .catch(err => {
    console.error("❌ Database connection FAILED:", err.message);
  });

module.exports = pool;
