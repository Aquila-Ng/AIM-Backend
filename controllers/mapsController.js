const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({path: path.join(__dirname, '../.env')});

const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;
const AZURE_MAPS_API_VERSION = '1.0';

if (!AZURE_MAPS_KEY) {
    console.error('FATAL ERROR: AZURE_MAPS_KEY enviroment variable is not set');
}

async function getMapConfig(req, res){
    if (!AZURE_MAPS_KEY){
        return res.status(500).json({error: 'Azure Maps configuration is missing on the server.'});
    }
    res.json({ subscriptionKey: AZURE_MAPS_KEY });
}

async function searchAddress(req, res) {
    const query = req.query.query;
    const lat = req.query.lat;
    const lon = req.query.lon;

    if (!query) {
        return res.status(400).json({ error: 'Search query parameter is required.' });
    }
    if (!AZURE_MAPS_KEY){
        return res.status(500).json({ error: 'Azure Maps services is unavailable (server config)'});
    }

    const searchUrl = `https://atlas.microsoft.com/search/fuzzy/json`;

    try {
        const response = await axios.get(searchUrl, {
            params: {
                'api-version': AZURE_MAPS_API_VERSION,
                'subscription-key': AZURE_MAPS_KEY,
                'query': query,
                'limit': 5, // Limit number of suggestions
                ...(lat && lon && { 'lat': lat }),
                ...(lat && lon && { 'lon': lon }),
                'countrySet': 'SG'
                // 'radius': 50000 // Search radius in meters if lat/lon provided
            }
        });

        res.json(response.data);

    } 
    catch (error) {
        console.error("Azure Maps Search Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
             error: 'Failed to perform address search.',
             details: error.response?.data?.error?.message
        });
    }
}

async function reverseGeocode(req,res){
    const lat = req.query.lat;
    const lon = req.query.lon;

    if (!lat || !lon){
        return res.status(400).json({ error: 'Latitude and Longitude query parameters are required.' });
    }
    if (!AZURE_MAPS_KEY){
        return res.status(500).json({ error: 'Azure Maps services is unavailable (server config)'});
    }

    const reverseGeocodeUrl = `https://atlas.microsoft.com/search/address/reverse/${AZURE_MAPS_API_VERSION}`;
    try {
        const response = await axios.get(reverseGeocodeUrl, {
            params: {
                'api-version': AZURE_MAPS_API_VERSION,
                'subscription-key': AZURE_MAPS_KEY,
                'query': `${lat},${lon}`, // Format: lat,lon
                // 'entityType': 'Address', // Optional: restrict types, e.g., 'Address', 'Municipality'
                // 'heading': 0, // Optional
                // 'number': '' // Optional
            }
        });

        if (response.data && response.data.addresses && response.data.addresses.length > 0) {
             // Send back the first address object or just the formatted address
             res.json({ address: response.data.addresses[0] }); // Send the whole first address object
             // Or: res.json({ formattedAddress: response.data.addresses[0].address.freeformAddress });
        } else {
             res.status(404).json({ error: 'No address found for the provided coordinates.' });
        }

    } 
    catch (error) {
        console.error("Azure Maps Reverse Geocode Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to perform reverse geocoding.',
            details: error.response?.data?.error?.message
         });
    }
}

module.exports = {
    getMapConfig,
    searchAddress,
    reverseGeocode
}