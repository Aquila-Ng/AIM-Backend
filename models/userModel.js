const { pool } = require("../config/db");
const crypto = require("crypto");

async function findUserById(userId) {
  const query = `
    SELECT
          id, email, first_name, last_name, age, sex, height, weight,
          blind_vision_difficulty,
          deaf_hearing_difficulty,
          difficulty_walking
          -- Add any other relevant fields from your 'users' table used for matching
          -- e.g., is_available_to_help (BOOLEAN), difficulty_errands (BOOLEAN)
      FROM users
      WHERE id = $1 LIMIT 1;`;
  const values = [userId];
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (err) {
    console.error(`Error finding user by ID (${userId}): \n`, err);
    throw err;
  }
}

async function findPotentialHelpers(requesterId) {
  const query = `
    SELECT
        id, email, first_name, last_name, age, sex, height, weight,
        blind_vision_difficulty,
        deaf_hearing_difficulty,
        difficulty_walking
        -- Add any other relevant fields, e.g., is_available_to_help
        -- Add difficulty_errands if it exists and is relevant to filtering helpers
    FROM users
    WHERE id != $1
    -- Add conditions to filter potential helpers if needed
    -- e.g., AND is_available_to_help = TRUE
    -- e.g., AND difficulty_errands = FALSE (if helpers with this difficulty cannot help)
    ;`;

  const values = [requesterId];
  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (err) {
    console.error("Error finding helpers: \n", err);
    throw err;
  }
}

module.exports = {
  findUserById,
  findPotentialHelpers,
};
