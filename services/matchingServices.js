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
const MAX_MATCHES_TO_OFFER = 10;

const AGE_PRIORITY_BONUS = 3;     // Bonus for helpers aged 18-35
const NEED_MATCH_SCORE = 3;       // Score for helper capability matching requester need
const SEX_MATCH_SCORE = 3;        // Score for matching requester's sex preference (if any)
const BMI_HEALTHY_BONUS = 2;      // Bonus for helper having BMI in healthy range
const LLM_SEX_MATCH_SCORE = 3;    // Bonus if helper sex matches LLM ideal sex
const LLM_CAPABILITY_MATCH_SCORE = 2; // Bonus per capability match with LLM profile (e.g., LLM wants no walking diff, helper has none)
const LLM_CAPABILITY_MISMATCH_PENALTY = 5; // Bonus per capability match with LLM profile (e.g., LLM wants no walking diff, helper has none)

// Define which user profile fields represent needs
const NEED_FIELDS = [
    'blind_vision_difficulty',
    'deaf_hearing_difficulty',
    'difficulty_walking',
];

const BMI_HEALTHY_MIN = 18.5;
const BMI_HEALTHY_MAX = 24.9;

function calculateBmi(heightCm, weightKg) {
    if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) {
        return null; // Invalid input
    }
    try {
        const heightM = heightCm / 100; // Convert cm to meters
        const bmi = weightKg / (heightM * heightM);
        return bmi;
    } catch (error) {
        console.error("Error calculating BMI:", error);
        return null;
    }
}

function parseLlmProfile(llmProfileString) {
    if (!llmProfileString || typeof llmProfileString !== 'string') {
        return null;
    }
    console.log("Parsing LLM Profile String:", llmProfileString); // Debugging

    const profile = {
        sex: null,
        visionDifficulty: null,
        hearingDifficulty: null,
        walkingDifficulty: null,
    };

    try {
        // Regex to capture Key: [Value] format, handling potential whitespace variations
        const sexMatch = llmProfileString.match(/•\s*Sex:\s*(Male|Female|Any)/i);
        const visionMatch = llmProfileString.match(/•\s*Vision Difficulty:\s*(True|False)/i);
        const hearingMatch = llmProfileString.match(/•\s*Hearing Difficulty:\s*(True|False)/i);
        const walkingMatch = llmProfileString.match(/•\s*Walking Difficulty:\s*(True|False)/i);

        if (sexMatch && sexMatch[1]) {
             // Capitalize first letter, lowercase rest (e.g., "Female")
            profile.sex = sexMatch[1].charAt(0).toUpperCase() + sexMatch[1].slice(1).toLowerCase();
        }
        if (visionMatch && visionMatch[1]) {
            profile.visionDifficulty = visionMatch[1].toLowerCase() === 'true';
        }
        if (hearingMatch && hearingMatch[1]) {
            profile.hearingDifficulty = hearingMatch[1].toLowerCase() === 'true';
        }
        if (walkingMatch && walkingMatch[1]) {
            profile.walkingDifficulty = walkingMatch[1].toLowerCase() === 'true';
        }

        console.log("Parsed LLM Profile:", profile); // Debugging
        return profile;

    } catch (error) {
        console.error("Error parsing LLM profile string:", error);
        return null; // Return null if parsing fails
    }
}

/**
 * Calculates compatibility score, considering base profile, LLM profile, and BMI.
 * @param {object} requesterProfile - User object for the requester.
 * @param {object} helperProfile - User object for the potential helper.
 * @param {object | null} idealHelperProfile - Parsed LLM profile object (or null).
 * @param {number | null} geoDistanceKm - Geographic distance (optional).
 * @returns {number} - Compatibility score. Returns -Infinity if helper is disqualified.
 */
function calculateCompatibilityScore(requesterProfile, helperProfile, idealHelperProfile, geoDistanceKm = null) {
    let score = 0;

    // --- 1. Base Score Calculation (Requester Needs vs. Helper Capabilities) ---
    NEED_FIELDS.forEach(field => {
        // Check if field exists on both profiles before accessing
        if (requesterProfile.hasOwnProperty(field) && helperProfile.hasOwnProperty(field)) {
             if (requesterProfile[field] === true && helperProfile[field] === false) {
                 score += NEED_MATCH_SCORE;

             }
        } else {
             console.warn(`Scoring warning: Field '${field}' missing in requester or helper profile.`);
        }
    });

    // --- 2. Base Sex Matching (Original Requester Preference - if applicable) ---
    // Assuming direct sex match is the default preference if LLM profile is absent
    if (!idealHelperProfile && requesterProfile.sex && helperProfile.sex && requesterProfile.sex === helperProfile.sex) {
         score += SEX_MATCH_SCORE;
    }

    // --- 3. Age Priority Scoring ---
    if (helperProfile.age && helperProfile.age >= 18 && helperProfile.age <= 35) {
        score += AGE_PRIORITY_BONUS;
    }

    // --- 4. BMI Scoring ---
    const bmi = calculateBmi(helperProfile.height, helperProfile.weight); // Assumes height in cm, weight in kg
    if (bmi !== null) {
        console.log(`Helper ${helperProfile.id} BMI: ${bmi.toFixed(1)}`); // Debugging
        if (bmi >= BMI_HEALTHY_MIN && bmi <= BMI_HEALTHY_MAX) {
            score += BMI_HEALTHY_BONUS;
            console.log(`Helper ${helperProfile.id} received BMI bonus.`); // Debugging
        }
    } else {
         console.log(`Could not calculate BMI for helper ${helperProfile.id}.`);
    }

   // --- 5. LLM Profile Scoring (If available) ---
    if (idealHelperProfile) {
        console.log(`Applying LLM scoring for helper ${helperProfile.id}`);
        console.log(` - Parsed LLM Profile:`, idealHelperProfile); // Log the whole parsed object
        console.log(` - Helper Profile Sex: [${helperProfile.sex}]`); // Log helper's sex

        // LLM Sex Preference Match (Refined)
        // Check if BOTH the ideal profile and the helper profile have a non-empty sex value
        if (idealHelperProfile.sex && typeof idealHelperProfile.sex === 'string' &&
            helperProfile.sex && typeof helperProfile.sex === 'string') {

            // Perform a case-insensitive comparison
            const idealSexLower = idealHelperProfile.sex.toLowerCase();
            const helperSexLower = helperProfile.sex.toLowerCase();

            console.log(`   - Comparing Ideal Sex (lower): [${idealSexLower}] vs Helper Sex (lower): [${helperSexLower}]`); // Debug comparison

            if (idealSexLower === helperSexLower) {
                score += LLM_SEX_MATCH_SCORE;
                console.log(`   - LLM Sex Match Bonus Added (+${LLM_SEX_MATCH_SCORE})`);
            } else {
                 console.log(`   - No LLM Sex Match (Values differ case-insensitively)`);
            }
        } else {
            // Log why the comparison was skipped
             console.log(` - Skipping LLM Sex Match because ideal sex (${idealHelperProfile.sex}) or helper sex (${helperProfile.sex}) is missing or not a string.`);
        }

        // LLM Capability Match (Helper should NOT have the difficulty if LLM says False)
        const checkLlmCapability = (llmField, helperField) => {
            if (idealHelperProfile[llmField] === false && helperProfile.hasOwnProperty(helperField) && helperProfile[helperField] === false) {
                 score += LLM_CAPABILITY_MATCH_SCORE;
                 console.log(` - LLM Capability Match Bonus Added for: ${llmField}`);
            } else if (idealHelperProfile[llmField] === true && helperProfile.hasOwnProperty(helperField) && helperProfile[helperField] === true) {
                // Optional: Add score if LLM wants difficulty and helper *has* it (e.g., shared experience?)
                // score += LLM_SHARED_DIFFICULTY_SCORE;
                // console.log(` - LLM Shared Difficulty Match Bonus Added for: ${llmField}`);
            } 
            else if (idealHelperProfile[llmField] === false && helperProfile.hasOwnProperty(helperField) && helperProfile[helperField] === true) {
                // Optional: Penalize if LLM wants no difficulty but helper HAS it
                score -= LLM_CAPABILITY_MISMATCH_PENALTY;
                console.log(` - LLM Capability Mismatch (Penalty potential) for: ${llmField}`);
            }
        };

        checkLlmCapability('visionDifficulty', 'blind_vision_difficulty');
        checkLlmCapability('hearingDifficulty', 'deaf_hearing_difficulty');
        checkLlmCapability('walkingDifficulty', 'difficulty_walking');

    } else {
        // console.log(`No idealHelperProfile provided for scoring helper ${helperProfile.id}`);
    }


    // --- 6. Geo-Proximity Bonus (Conceptual) ---
    if (geoDistanceKm !== null) {
        if (geoDistanceKm <= 5) score += 1;
        else if (geoDistanceKm <= 10) score += 0.5;
    }

    console.log(`Final Score for Helper ${helperProfile.id}: ${score}`); // Debugging
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
        •	Age: Male or Female or null (select one based on the analysis)
        •	Sex: Male or Female or null (select one based on the analysis)
        •	Vision Difficulty: True or False (select one based on the analysis)
        •	Hearing Difficulty: True or False (select one based on the analysis)
        •	Walking Difficulty: True or False (select one based on the analysis)
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

async function findAndOfferMatches(requestId) {
    console.log(`Starting matching & offering process for request ID: ${requestId}`);
    let llmProfileString = null; // Store the raw LLM output string
    let parsedLlmProfile = null; // Store the parsed object

    try {
        const request = await requestModel.findRequestById(requestId);
        if (!request || request.status !== 'open') {
            console.log(`Request ID ${requestId} not found or not open. Skipping matching.`);
            return;
        }

        const requesterProfile = await userModel.findUserById(request.req_user_id);
        if (!requesterProfile) {
            console.error(`Matching Error: Requester profile not found for user ID ${request.req_user_id} (Request ID: ${requestId})`);
            await requestModel.updateRequestStatus(requestId, 'matching_failed'); // Updated status name
            return;
        }

        const potentialHelpers = await userModel.findPotentialHelpers(request.req_user_id);
        if (!potentialHelpers || potentialHelpers.length === 0) {
            console.log(`No potential helpers found for request ID: ${requestId}.`);
            await requestModel.updateRequestStatus(requestId, 'no_helpers_found');
            return; // Exit cleanly
        }
        console.log(`Found ${potentialHelpers.length} potential helpers for request ${requestId}.`);

        // --- Generate and Parse LLM Profile (if comments exist) ---
        if (request.comments && request.comments.trim()) {
            llmProfileString = await generateIdealHelperProfile(requesterProfile, request.task_type, request.comments);
            // Check if LLM returned an error message
            if (llmProfileString && (llmProfileString.startsWith("Error") || llmProfileString.startsWith("LLM blocked") || llmProfileString.startsWith("LLM response format invalid"))) {
                 console.warn(`LLM profile generation for request ${requestId} resulted in an error/invalid format: ${llmProfileString}`);
                 // Decide how to proceed: continue without LLM scoring or fail? Let's continue without.
                 parsedLlmProfile = null;
                 // Optionally store the error message somewhere (e.g., request comments or a dedicated log field)
            } else if (llmProfileString) {
                 parsedLlmProfile = parseLlmProfile(llmProfileString);
                 if (!parsedLlmProfile) {
                      console.warn(`Failed to parse LLM profile string for request ${requestId}. Proceeding without LLM scoring.`);
                      // LLM string might be stored, but scoring won't use it if parsing fails
                 }
            }
        } else {
            console.log(`No comments for request ${requestId}, skipping LLM profile generation.`);
        }

        // --- Perform Rank & Retrieval Scoring ---
        console.log(`Scoring potential helpers for request ${requestId}...`);
        const scoredHelpers = potentialHelpers
            .map(helper => {
                // Pass the PARSED LLM profile (or null) to the scoring function
                const score = calculateCompatibilityScore(
                    requesterProfile,
                    helper,
                    parsedLlmProfile, // Pass parsed object
                    null // geoDistanceKm
                );
                return { ...helper, score: score };
            })
            .filter(helper => helper.score > -Infinity) // Remove disqualified
            .sort((a, b) => b.score - a.score); // Sort descending

        if (scoredHelpers.length === 0) {
            console.log(`No suitable helpers found after scoring for request ${requestId}.`);
            await requestModel.updateRequestStatus(requestId, 'no_matches_found');
            return;
        }

        // --- Select Top N Matches and Offer ---
        const topMatches = scoredHelpers.slice(0, MAX_MATCHES_TO_OFFER);
        console.log(`Top ${topMatches.length} matches selected for request ${requestId}: IDs ${topMatches.map(m => m.id).join(", ")}`);
        // Log scores for debugging
         topMatches.forEach(m => console.log(`  - Helper ${m.id}: Score ${m.score?.toFixed(2)}`));


        // Store potential matches (includes score)
        const createdOffers = await requestModel.createPotentialMatches(requestId, topMatches);

        if (createdOffers.length > 0) {
            await requestModel.updateRequestStatus(requestId, 'awaiting_acceptance');
            console.log(`Request ${requestId} status updated to 'awaiting_acceptance'. Offers sent.`);
            // TODO: Decide if/where to store llmProfileString - maybe add a column to potential_matches if needed for display later?
            // Example: Add llmProfileString to the createPotentialMatches call and model if needed.
        } else {
            console.warn(`No new potential matches were created for request ${requestId}, possibly duplicates or error.`);
            await requestModel.updateRequestStatus(requestId, 'matching_failed');
        }
    } catch (err) {
        console.error(`Unhandled error during matching/offering process for request ID ${requestId}: `, err);
        try {
            await requestModel.updateRequestStatus(requestId, 'matching_failed');
        } catch (updateError) {
            console.error(`Failed to update request ${requestId} status after matching error: `, updateError);
        }
    }
}

/**
 * Orchestrates the matching process for a given help request.
 * Fetches data, runs R&R scoring, optionally calls LLM, and updates the request status.
 * This function runs asynchronously and doesn't block the initial request creation.
 * @param {number} requestId - The ID of the help_requests row.
 */
// async function findAndAssignMatch(requestId) {
//     console.log(`Starting matching process for request ID: ${requestId}`);
//     let status = 'matching_failed'; // Default status if errors occur early
//     let llmProfile = null;
//     let topMatchId = null;

//     try {
//         // 1. Fetch Request Details
//         const request = await requestModel.findRequestById(requestId);
//         if (!request) {
//             console.error(`Matching Error: Request ID ${requestId} not found.\n`);
//             // No request to update, just log and exit
//             return;
//         }
//         if (request.status !== 'open') {
//              console.log(`Request ${requestId} is not in 'open' state (current: ${request.status}). Skipping matching.`);
//              return; // Avoid rematching
//         }

//         // 2. Fetch Requester Profile
//         const requesterProfile = await userModel.findUserById(request.req_user_id);
//         if (!requesterProfile) {
//             console.error(`Matching Error: Requester profile not found for user ID ${request.req_user_id} (Request ID: ${requestId}).`);
//             await requestModel.updateRequestMatchDetails(requestId, 'matching_failed', null, "Requester profile not found.");
//             return;
//         }

//         // 3. Fetch Potential Helpers
//         const potentialHelpers = await userModel.findPotentialHelpers(request.req_user_id);
//         if (!potentialHelpers || potentialHelpers.length === 0) {
//             console.log(`No potential helpers found for request ID: ${requestId}.`);
//             status = 'no_helpers_found';
//             await requestModel.updateRequestMatchDetails(requestId, status);
//             return;
//         }
//         console.log(`Found ${potentialHelpers.length} potential helpers for request ${requestId}.`);


//         // 4. Generate LLM Profile (if comments exist)
//         if (request.comments && request.comments.trim()) {
//             llmProfile = await generateIdealHelperProfile(requesterProfile, request.task_type, request.comments);
//             // Store the LLM profile regardless of whether it's an error message or valid text
//         } else {
//              console.log(`No comments for request ${requestId}, skipping LLM profile generation.`);
//         }

//         // 5. Perform Rank & Retrieval Scoring
//         console.log(`Scoring potential helpers for request ${requestId}...`);
//         const scoredHelpers = potentialHelpers.map(helper => {
//             // Pass profiles and potentially geoDistance (if available/calculated)
//             const score = calculateCompatibilityScore(requesterProfile, helper, null); // Pass null for geoDistance for now
//             return { ...helper, score: score };
//         })
//         .filter(helper => helper.score > -Infinity); // Remove disqualified helpers

//         if (scoredHelpers.length === 0) {
//             console.log(`No suitable helpers found after scoring for request ${requestId}.`);
//             status = 'no_matches_found';
//             await requestModel.updateRequestMatchDetails(requestId, status, null, llmProfile);
//             return;
//         }

//         // 6. Sort by Score (Descending)
//         scoredHelpers.sort((a, b) => b.score - a.score); // Highest score first

//         // 7. Select Top Match
//         topMatchId = scoredHelpers[0].id;
//         status = 'matched'; // Or 'awaiting_confirmation' if needed
//         console.log(`Top match for request ${requestId}: Helper ID ${topMatchId} (Score: ${scoredHelpers[0].score})`);

//         // 8. Update Request in DB
//         await requestModel.updateRequestMatchDetails(requestId, status, topMatchId, llmProfile);
//         console.log(`Matching process completed successfully for request ${requestId}.`);

//     } catch (error) {
//         console.error(`Unhandled error during matching process for request ID ${requestId}:`, error);
//         // Attempt to update the status to failed, even if some steps succeeded before the error
//         try {
//             // Use the 'status' variable which might hold an intermediate failure state
//             await requestModel.updateRequestMatchDetails(requestId, status, topMatchId, llmProfile || `Matching Error: ${error.message}`);
//         } catch (updateError) {
//             console.error(`Failed to update request ${requestId} status after matching error:`, updateError);
//         }
//     }
// }

module.exports = {
    findAndOfferMatches
}