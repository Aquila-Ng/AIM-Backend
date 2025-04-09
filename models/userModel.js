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

async function findUserByEmail(email) {
  const query = `
    SELECT
          id, email, first_name, last_name, age, sex, height, weight,
          blind_vision_difficulty,
          deaf_hearing_difficulty,
          difficulty_walking
          -- Add any other relevant fields from your 'users' table used for matching
          -- e.g., is_available_to_help (BOOLEAN), difficulty_errands (BOOLEAN)
      FROM users
      WHERE email = $1 LIMIT 1;`;
  const values = [email];
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (err) {
    console.error(`Error finding user by Email (${email}): \n`, err);
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

async function updateUserProfile(userId, updateData) {
  const allowedFields = [
      'email', 'height', 'weight',
      'blind_vision_difficulty', 'deaf_hearing_difficulty', 'difficulty_walking'
  ];

  // Filter updateData to only include allowed fields
  const fieldsToUpdate = {};
  const values = [];
  let queryParamIndex = 1;

  for (const field of allowedFields) {
      if (updateData.hasOwnProperty(field)) {
          fieldsToUpdate[field] = updateData[field];
          values.push(updateData[field]);
      }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
      throw new Error("No valid fields provided for update.");
  }

  // Construct the SET part of the SQL query dynamically
  const setClauses = Object.keys(fieldsToUpdate)
      .map((field, index) => `"${field}" = $${index + 1}`) // Use index + 1 for parameter markers
      .join(', ');

  // Add the userId as the last parameter for the WHERE clause
  values.push(userId);
  const userIdIndex = values.length;

  const query = `
      UPDATE users
      SET ${setClauses}
      WHERE id = $${userIdIndex}
      RETURNING id, email, first_name, last_name, age, sex, height, weight,
                blind_vision_difficulty, deaf_hearing_difficulty, difficulty_walking; -- Return updated profile
  `;

  try {
      console.log("Updating User Details:", values);
      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
          throw new Error("User not found or no changes made.");
      }
      console.log("Update successful for user:", userId);
      return result.rows[0]; // Return the updated user object (without password/salt)
  } catch (err) {
      console.error(`Error updating profile for user ${userId}:`, err);
      // Check for specific errors like unique constraint violation on email
      if (err.code === '23505' && err.constraint === 'users_email_key') { // Adjust constraint name if needed
          throw new Error("Email address is already in use by another account.");
      }
      throw err; // Re-throw other errors
  }
}


module.exports = {
  findUserById,
  findUserByEmail,
  findPotentialHelpers,
  updateUserProfile
};
