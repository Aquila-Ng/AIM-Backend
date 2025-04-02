const userModel = require('../models/userModel');
const requestModel = require('../models/requestModel');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path : path.join(__dirname, '../.env')});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not found in environment variables. LLM features will be disabled.");
}

// --- Configuration for Matching Logic ---
const AGE_PRIORITY_BONUS = 3; // Score bonus for helpers aged 18-35
const NEED_MATCH_SCORE = 2;   // Score for matching a need
const SEX_MATCH_SCORE = 1;    // Score for matching sex
const NEED_FIELDS = [
    'blind_vision_difficulty',
    'deaf_hearing_difficulty',
    'difficulty_walking',
    // Add other fields representing a need (e.g., 'difficulty_dressing_bathing')
];

/**
 * Calculates compatibility score between requester and helper profiles.
 * Uses native boolean and integer types directly from database objects.
 * @param {object} requesterProfile - User object for the requester.
 * @param {object} helperProfile - User object for the potential helper.
 * @param {number | null} geoDistanceKm - Geographic distance (optional).
 * @returns {number} - Compatibility score. Returns -Infinity if helper is disqualified.
 */
function calculateCompatibilityScore(requesterProfile, helperProfile, geoDistanceKm = null) {
    let score = 0;
    console.log(requesterProfile);
    console.log(helperProfile);

    // --- Optional: Check for disqualifying factors in helper ---
    // Example: If a helper has difficulty with errands, they might be disqualified
    // if (DISQUALIFYING_HELPER_FIELDS.some(field => helperProfile[field] === true)) {
    //     console.log(`Helper ${helperProfile.id} disqualified due to field checks.`);
    //     return -Infinity; // Use -Infinity to ensure they are ranked last
    // }

    // --- Need Matching (Requester Need = true, Helper Capability = false) ---
    NEED_FIELDS.forEach(field => {
        if (requesterProfile[field] === true && helperProfile[field] === false) {
            score += NEED_MATCH_SCORE;
        }
        // Optional: Penalize if helper has the *same* difficulty?
        // else if (requesterProfile[field] === true && helperProfile[field] === true) {
        //     score -= 1; // Adjust penalty as needed
        // }
    });

    // --- Sex Matching ---
    if (requesterProfile.sex && helperProfile.sex && requesterProfile.sex === helperProfile.sex) {
        score += SEX_MATCH_SCORE;
    }

    // --- Age Priority Scoring ---
    if (helperProfile.age && helperProfile.age >= 18 && helperProfile.age <= 35) {
        score += AGE_PRIORITY_BONUS;
    }
    // Optional: Add smaller bonus/penalty for other age ranges if desired

    // --- Geo-Proximity Bonus (Conceptual) ---
    if (geoDistanceKm !== null) {
        if (geoDistanceKm <= 5) score += 1;
        else if (geoDistanceKm <= 10) score += 0.5;
    }

    return score;
}


/**
 * Uses Gemini to generate a description of an ideal helper based on request.
 * @param {object} requesterProfile - User object for the requester.
 * @param {string} taskType - The type of task requested.
 * @param {string} comments - Additional comments from the requester.
 * @returns {Promise<string | null>} - The generated text description or null/error message.
 */
async function generateIdealHelperProfile(requesterProfile, taskType, comments) {
    if (!genAI) {
        console.log("Skipping LLM profile generation - API key missing or SDK not initialized.");
        return null;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" }); // Or your preferred model

    // Construct the prompt using template literals and native data
    const prompt = `
        Analyze the following help request and requester profile to determine the ideal characteristics of a helper who could best fulfill this request.  

        Focus on relevant skills, capabilities, personality traits, and demographic factors suggested by the request. Ensure the response strictly follows the specified format.  

        Requester Profile:  
        - Age: ${requesterProfile.age || 'N/A'}  
        - Sex: ${requesterProfile.sex || 'N/A'}  
        - Vision Difficulty: ${requesterProfile.blind_vision_difficulty ? 'Yes' : 'No'}  
        - Hearing Difficulty: ${requesterProfile.deaf_hearing_difficulty ? 'Yes' : 'No'}  
        - Walking Difficulty: ${requesterProfile.difficulty_walking ? 'Yes' : 'No'}  

        Request Details:  
        - Task Type: ${taskType}  
        - Requester Comments: ${comments}  

        **Respond with the Ideal Helper Characteristics Profile in the following format:**  
        •	Age: [Male/Female]
        •	Sex: [Male/Female]
        •	Vision Difficulty: [True/False]
        •	Hearing Difficulty: [True/False]
        •	Walking Difficulty: [True/False]
        `;

    try {
        console.log("Generating ideal helper profile with Gemini...");
        const result = await model.generateContent(prompt);
        const response = result.response; // Access the response object

        // Basic safety check (using response.promptFeedback)
        if (response.promptFeedback?.blockReason) {
            const reason = response.promptFeedback.blockReason;
            console.warn(`LLM generation blocked: ${reason}`);
            return `Could not generate profile due to safety settings (${reason}).`;
        }

        const generatedText = response.text().trim();
        console.log("--- Gemini Generated Profile ---");
        console.log(generatedText);
        console.log("------------------------------");
        return generatedText;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return `Error occurred during LLM profile generation.`; // Return error message
    }
}

/**
 * Orchestrates the matching process for a given help request.
 * Fetches data, runs R&R scoring, optionally calls LLM, and updates the request status.
 * This function runs asynchronously and doesn't block the initial request creation.
 * @param {number} requestId - The ID of the help_requests row.
 */
async function findAndAssignMatch(requestId) {
    console.log(`Starting matching process for request ID: ${requestId}`);
    let status = 'matching_failed'; // Default status if errors occur early
    let llmProfile = null;
    let topMatchId = null;

    try {
        // 1. Fetch Request Details
        const request = await requestModel.findRequestById(requestId);
        if (!request) {
            console.error(`Matching Error: Request ID ${requestId} not found.\n`);
            // No request to update, just log and exit
            return;
        }
        if (request.status !== 'open') {
             console.log(`Request ${requestId} is not in 'open' state (current: ${request.status}). Skipping matching.`);
             return; // Avoid rematching
        }

        // 2. Fetch Requester Profile
        const requesterProfile = await userModel.findUserById(request.req_user_id);
        if (!requesterProfile) {
            console.error(`Matching Error: Requester profile not found for user ID ${request.req_user_id} (Request ID: ${requestId}).`);
            await requestModel.updateRequestMatchDetails(requestId, 'matching_failed', null, "Requester profile not found.");
            return;
        }

        // 3. Fetch Potential Helpers
        const potentialHelpers = await userModel.findPotentialHelpers(request.req_user_id);
        if (!potentialHelpers || potentialHelpers.length === 0) {
            console.log(`No potential helpers found for request ID: ${requestId}.`);
            status = 'no_helpers_found';
            await requestModel.updateRequestMatchDetails(requestId, status);
            return;
        }
        console.log(`Found ${potentialHelpers.length} potential helpers for request ${requestId}.`);


        // 4. Generate LLM Profile (if comments exist)
        if (request.comments && request.comments.trim()) {
            llmProfile = await generateIdealHelperProfile(requesterProfile, request.task_type, request.comments);
            // Store the LLM profile regardless of whether it's an error message or valid text
        } else {
             console.log(`No comments for request ${requestId}, skipping LLM profile generation.`);
        }

        // 5. Perform Rank & Retrieval Scoring
        console.log(`Scoring potential helpers for request ${requestId}...`);
        const scoredHelpers = potentialHelpers.map(helper => {
            // Pass profiles and potentially geoDistance (if available/calculated)
            const score = calculateCompatibilityScore(requesterProfile, helper, null); // Pass null for geoDistance for now
            return { ...helper, score: score };
        })
        .filter(helper => helper.score > -Infinity); // Remove disqualified helpers

        if (scoredHelpers.length === 0) {
            console.log(`No suitable helpers found after scoring for request ${requestId}.`);
            status = 'no_matches_found';
            await requestModel.updateRequestMatchDetails(requestId, status, null, llmProfile);
            return;
        }

        // 6. Sort by Score (Descending)
        scoredHelpers.sort((a, b) => b.score - a.score); // Highest score first

        // 7. Select Top Match
        topMatchId = scoredHelpers[0].id;
        status = 'matched'; // Or 'awaiting_confirmation' if needed
        console.log(`Top match for request ${requestId}: Helper ID ${topMatchId} (Score: ${scoredHelpers[0].score})`);

        // 8. Update Request in DB
        await requestModel.updateRequestMatchDetails(requestId, status, topMatchId, llmProfile);
        console.log(`Matching process completed successfully for request ${requestId}.`);

    } catch (error) {
        console.error(`Unhandled error during matching process for request ID ${requestId}:`, error);
        // Attempt to update the status to failed, even if some steps succeeded before the error
        try {
            // Use the 'status' variable which might hold an intermediate failure state
            await requestModel.updateRequestMatchDetails(requestId, status, topMatchId, llmProfile || `Matching Error: ${error.message}`);
        } catch (updateError) {
            console.error(`Failed to update request ${requestId} status after matching error:`, updateError);
        }
    }
}

module.exports = {
    findAndAssignMatch
}