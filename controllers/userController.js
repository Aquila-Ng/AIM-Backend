const userModel = require('../models/authModel');

async function getCurrentUser(req, res) {
  // The authenticateToken middleware already verified the token
  // and put the user payload in req.user ({ userId, email })
  if (!req.user || !req.user.userId) {
      // This shouldn't happen if authenticateToken is working, but good practice
      return res.status(401).json({ error: 'Authentication details not found.' });
  }

  try {
      // Fetch full (but non-sensitive) user details from DB using the ID from the token
      const userProfile = await userModel.findUserById(req.user.userId);

      if (!userProfile) {
          return res.status(404).json({ error: 'User profile not found.' });
      }

      // Remove sensitive data before sending
      delete userProfile.password;
      delete userProfile.salt;

      res.status(200).json(userProfile);

  } catch (error) {
      console.error("Error fetching current user profile:", error);
      res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
}

module.exports = {
  getCurrentUser,
  // Add other user-related controller functions here
};