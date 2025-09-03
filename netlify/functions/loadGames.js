const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL, // Neon URL
  ssl: { rejectUnauthorized: false },
});

exports.handler = async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM games ORDER BY played_at DESC LIMIT 10;`
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error("Error loading games:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
