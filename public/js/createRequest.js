let map;
let marker;
let autocomplete;

// Function called by Google Maps script loading
function initMap() {
    const defaultLocation = { lat: -34.397, lng: 150.644 }; // Default to Sydney, Australia (change as needed)
    map = new google.maps.Map(document.getElementById("map"), {
        center: defaultLocation,
        zoom: 8,
    });

    marker = new google.maps.Marker({
        map: map,
        anchorPoint: new google.maps.Point(0, -29),
        draggable: true, // Allow user to drag the marker
    });

    // --- Autocomplete Setup ---
    const addressInput = document.getElementById("addressInput");
    autocomplete = new google.maps.places.Autocomplete(addressInput, {
        fields: ["formatted_address", "geometry"], // Request specific fields
    });

    // Bias results to map viewport
    autocomplete.bindTo("bounds", map);

    // --- Event Listeners ---
    autocomplete.addListener("place_changed", () => {
        marker.setVisible(false); // Hide marker while place changes
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
            window.alert("No details available for input: '" + place.name + "'");
            return;
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17); // Why 17? Because it looks good.
        }
        marker.setPosition(place.geometry.location);
        marker.setVisible(true);

        // Store details
        document.getElementById("formattedAddress").value = place.formatted_address || '';
        document.getElementById("latitude").value = place.geometry.location.lat();
        document.getElementById("longitude").value = place.geometry.location.lng();
    });

     // Allow clicking on the map to set marker and attempt reverse geocode
     map.addListener("click", (mapsMouseEvent) => {
        const position = mapsMouseEvent.latLng;
        marker.setPosition(position);
        marker.setVisible(true);
        map.panTo(position); // Center map on clicked location

        // Attempt to get address from coordinates (Reverse Geocoding)
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: position }, (results, status) => {
            if (status === "OK") {
                if (results[0]) {
                    document.getElementById("addressInput").value = results[0].formatted_address;
                    document.getElementById("formattedAddress").value = results[0].formatted_address;
                } else {
                    document.getElementById("addressInput").value = "Address not found";
                    document.getElementById("formattedAddress").value = '';
                }
            } else {
                console.error("Geocoder failed due to: " + status);
                document.getElementById("addressInput").value = "Address lookup failed";
                 document.getElementById("formattedAddress").value = '';
            }
             // Update hidden lat/lng fields on click too
             document.getElementById("latitude").value = position.lat();
             document.getElementById("longitude").value = position.lng();
        });
    });

    // Listen for marker drag end
    marker.addListener('dragend', () => {
        const position = marker.getPosition();
        map.panTo(position);
        // Attempt reverse geocode on drag end
         const geocoder = new google.maps.Geocoder();
         geocoder.geocode({ location: position }, (results, status) => {
            // (Same geocode handling as map click) ...
             if (status === "OK" && results[0]) {
                 document.getElementById("addressInput").value = results[0].formatted_address;
                 document.getElementById("formattedAddress").value = results[0].formatted_address;
             } else {
                 document.getElementById("addressInput").value = "Address not found";
                 document.getElementById("formattedAddress").value = '';
             }
             document.getElementById("latitude").value = position.lat();
             document.getElementById("longitude").value = position.lng();
         });
    });
} // end initMap


document.addEventListener('DOMContentLoaded', () => {
    const requestForm = document.getElementById('requestForm');
    const taskTypeSelect = document.getElementById('taskType');
    const commentsTextarea = document.getElementById('comments');
    const scheduledDateTimeInput = document.getElementById('scheduledDateTime');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const addressInput = document.getElementById('formattedAddress'); // Use the hidden one with full address
    const messageDiv = document.getElementById('message');

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const taskType = taskTypeSelect.value;
        const comments = commentsTextarea.value.trim();
        const scheduledDateTime = scheduledDateTimeInput.value || null; // Send null if empty
        const latitude = latitudeInput.value || null;
        const longitude = longitudeInput.value || null;
        const address = addressInput.value || null;

        if (!taskType) {
            showMessage('Please select a task type.', 'danger');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('Authentication error. Please log in again.', 'danger');
            // window.location.href = '/login';
            return;
        }

        // Construct body, only including schedule/location if they have values
        const body = {
            taskType: taskType,
            comments: comments,
            ...(scheduledDateTime && { scheduledDateTime: scheduledDateTime }),
            ...(latitude && longitude && { latitude: parseFloat(latitude) }), // Ensure they are numbers
            ...(latitude && longitude && { longitude: parseFloat(longitude) }),
            ...(address && { address: address }),
        };


        try {
            showMessage('Submitting request...', 'info');
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(`Request submitted successfully (ID: ${result.requestId})! Potential helpers are being notified.`, 'success');
                requestForm.reset(); // Clear form
                // Clear map marker and location fields
                if (marker) marker.setVisible(false);
                latitudeInput.value = '';
                longitudeInput.value = '';
                addressInput.value = '';
                document.getElementById('addressInput').value = ''; // Clear visible address input too
                // Redirect after a delay?
                 setTimeout(() => window.location.href = '/requestHistory', 2500); // Go to history page
            } else {
                showMessage(`Error: ${result.error || 'Failed to submit request.'}`, 'danger');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            showMessage('An unexpected error occurred. Please try again.', 'danger');
        }
    });

    function showMessage(msg, type = 'info') {
        messageDiv.textContent = msg;
        messageDiv.className = `alert alert-${type} mt-3`; // Use Bootstrap alert classes
    }
});