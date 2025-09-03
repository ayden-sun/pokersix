const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL, // Neon URL
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event) => {
  try {
    const { players, scores, mode } = JSON.parse(event.body);

    const result = await pool.query(
      `INSERT INTO games (players, scores, mode)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [JSON.stringify(players), JSON.stringify(scores), mode]
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    console.error("Error saving game:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
