const userModel = require('../models/userModel');

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

async function updateCurrentUserProfile(req, res) {
  try {
      const userId = req.user.userId; // From authenticateToken middleware
      const updateData = req.body;

      if (updateData.email && !/\S+@\S+\.\S+/.test(updateData.email)) {
          return res.status(400).json({ error: 'Invalid email format.' });
      }
      if (updateData.hasOwnProperty('height') && updateData.height !== null && (isNaN(parseFloat(updateData.height)) || parseFloat(updateData.height) <= 0)) {
          return res.status(400).json({ error: 'Invalid height value. Must be a positive number.' });
      }
      if (updateData.hasOwnProperty('weight') && updateData.weight !== null && (isNaN(parseFloat(updateData.weight)) || parseFloat(updateData.weight) <= 0)) {
          return res.status(400).json({ error: 'Invalid weight value. Must be a positive number.' });
      }

       // Ensure boolean fields are actually boolean
       ['blind_vision_difficulty', 'deaf_hearing_difficulty', 'difficulty_walking'].forEach(field => {
           if (updateData.hasOwnProperty(field) && typeof updateData[field] !== 'boolean') {
                // Attempt conversion or reject - simplest is to reject
                 return res.status(400).json({ error: `Invalid value for ${field}. Must be true or false.` });
           }
       });
       // Ensure non-editable fields are not passed or ignore them server-side
       delete updateData.first_name;
       delete updateData.last_name;
       delete updateData.age; // Age shouldn't be updated manually
       delete updateData.sex;

      if (updateData.email) {
          const existingUser = await userModel.findUserByEmail(updateData.email);
          if (existingUser && existingUser.id !== userId) {
               return res.status(409).json({ error: 'Email address is already in use by another account.' });
          }
      }

      const updatedUser = await userModel.updateUserProfile(userId, updateData);

      delete updatedUser.password;
      delete updatedUser.salt;
      delete updatedUser.created_at; // Optionally remove timestamps
      delete updatedUser.updated_at;

      res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });

  } 
  catch (error) {
      console.error(`Error updating profile for user ${req.user?.userId}:`, error);
      // Handle specific errors thrown by the model (like duplicate email if check moved there)
      if (error.message.includes("Email address is already in use")) {
           res.status(409).json({ error: error.message });
      } else if (error.message.includes("No valid fields")) {
           res.status(400).json({ error: error.message });
      }
      else {
           res.status(500).json({ error: 'Failed to update profile.' });
      }
  }
}

module.exports = {
  getCurrentUser,
  updateCurrentUserProfile
};