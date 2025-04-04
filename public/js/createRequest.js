document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const requestForm = document.getElementById('requestForm');
    const taskTypeSelect = document.getElementById('taskType');
    const commentsTextarea = document.getElementById('comments');
    const scheduledDateTimeInput = document.getElementById('scheduledDateTime');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    const formattedAddressInput = document.getElementById('formattedAddress'); // Hidden input
    const addressInput = document.getElementById('addressInput'); // Visible input
    const suggestionsList = document.getElementById('suggestions');
    const messageDiv = document.getElementById('message');
    const mapElementId = 'myMap'; // ID of the map container div

    // --- Map Variables ---
    let map, datasource, popup, markerPin; // Azure Maps specific variables
    let azureMapsKey = null; // Will be fetched from backend
    let searchDebounceTimer;

    // --- Initialization ---
    async function initializePage() {
        try {
            const config = await fetchMapConfig();
            if (config && config.subscriptionKey) {
                azureMapsKey = config.subscriptionKey;
                initializeMap(azureMapsKey);
                setupEventListeners();
            } else {
                showMessage('Could not load map configuration. Please try again later.', 'danger');
                // Disable location input/map?
                 addressInput.disabled = true;
                 document.getElementById(mapElementId).innerHTML = '<div class="alert alert-warning">Map is unavailable.</div>';
            }
        } catch (error) {
            showMessage('Error initializing page: ' + error.message, 'danger');
        }
    }

    async function fetchMapConfig() {
        try {
            // Cookie should be sent automatically for authentication
            const response = await fetch('/api/maps/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch map config (${response.status})`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching map config:", error);
            throw error; // Re-throw to be caught by initializePage
        }
    }

    function initializeMap(subscriptionKey) {
        try {
             // Initialize a map instance.
             map = new atlas.Map(mapElementId, {
                 center: [103.8198, 1.3521], // Default center for Singapore
                 zoom: 12, // Increased default zoom
                 language: 'en-US',
                 authOptions: {
                     authType: 'subscriptionKey',
                     subscriptionKey: subscriptionKey
                 },
                 style: 'road_shaded_relief' // Map style
             });

             // Wait until the map resources are ready.
             map.events.add('ready', function () {
                 console.log("Azure Map Ready");

                 // Create a data source and add it to the map.
                 datasource = new atlas.source.DataSource();
                 map.sources.add(datasource);

                 // Create a layer to render point data (the marker).
                 map.layers.add(new atlas.layer.SymbolLayer(datasource, null, {
                     iconOptions: {
                         image: 'marker-blue', // Use built-in marker
                         allowOverlap: true,
                         ignorePlacement: true // Important for single draggable marker
                     },
                    //  textOptions: { // Optional: display text with marker
                    //      textField: ['get', 'title'],
                    //      offset: [0, 1.2]
                    //  }
                 }));

                 // Create a reusable popup.
                 popup = new atlas.Popup({
                     pixelOffset: [0, -18],
                     closeButton: false
                 });

                  // --- Add Map Event Listeners ---

                  // Click Event: Add/Move marker and reverse geocode
                  map.events.add('click', function (e) {
                      handleMapInteraction(e.position);
                  });

                  // Create the marker feature AFTER the layer is added
                   markerPin = new atlas.data.Point([0, 0]); // Initialize at 0,0 (will be moved)
                   // markerPin.properties = { title: "Selected Location" }; // Optional title
                   datasource.add(markerPin);
                   // Initially hide the marker until a location is set
                   map.layers.getLayers().forEach(layer => {
                       if(layer instanceof atlas.layer.SymbolLayer) {
                           layer.setOptions({ filter: ['==', ['geometry-type'], 'NonExistent'] }); // Hack to hide initially
                       }
                   });

                   // --- Marker Dragging (More Complex with Symbol Layer) ---
                   let isDragging = false;
                   let currentMarkerFeature = null; // Store ref to the marker feature

                   // When mouse down on a symbol, start dragging.
                   map.events.add('mousedown', markerPin.layerId || map.layers.getLayers()[0].getId(), (e) => { // Use actual layer ID if possible
                        if (e.shapes && e.shapes.length > 0 && e.shapes[0].dataSource === datasource) {
                           // We assume the first shape is our marker if datasource matches
                            currentMarkerFeature = e.shapes[0];
                            isDragging = true;
                            map.getCanvasContainer().style.cursor = 'grabbing';
                            map.setOptions({ dragPanInteraction: false }); // Disable map pan during marker drag
                        }
                   });

                   // Update marker position on mouse move while dragging.
                   map.events.add('mousemove', (e) => {
                       if (isDragging && currentMarkerFeature) {
                           markerPin.geometry.coordinates = e.position; // Update coordinates directly
                           datasource.setShapes(markerPin); // Re-set shape in datasource to trigger update
                       }
                   });

                   // Stop dragging on mouse up.
                   map.events.add('mouseup', () => {
                       if (isDragging) {
                           isDragging = false;
                           map.getCanvasContainer().style.cursor = 'grab';
                           map.setOptions({ dragPanInteraction: true }); // Re-enable map pan
                           handleMapInteraction(markerPin.geometry.coordinates); // Reverse geocode on drag end
                           currentMarkerFeature = null;
                       }
                   });
                   // Also handle mouse leave of map container
                   map.events.add('mouseleave', () => {
                         if (isDragging) {
                            isDragging = false;
                            map.getCanvasContainer().style.cursor = 'grab';
                            map.setOptions({ dragPanInteraction: true });
                            handleMapInteraction(markerPin.geometry.coordinates);
                            currentMarkerFeature = null;
                         }
                   });


             }); // End map 'ready' event

         } catch (mapError) {
             console.error("Error initializing Azure Map:", mapError);
              showMessage('Failed to initialize the map.', 'danger');
              document.getElementById(mapElementId).innerHTML = '<div class="alert alert-warning">Map could not be loaded.</div>';
         }
    }

    // --- Event Listener Setup ---
    function setupEventListeners() {
        // Address Input Autocomplete (using backend proxy)
        addressInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            const query = addressInput.value;
            if (query.length < 3) { // Don't search for very short strings
                suggestionsList.innerHTML = '';
                suggestionsList.style.display = 'none';
                return;
            }
            // Debounce: Wait 300ms after user stops typing
            searchDebounceTimer = setTimeout(() => {
                performAddressSearch(query);
            }, 300);
        });

         // Hide suggestions when clicking outside
         document.addEventListener('click', (event) => {
             if (!addressInput.contains(event.target) && !suggestionsList.contains(event.target)) {
                 suggestionsList.style.display = 'none';
             }
         });

         // Form Submission
         requestForm.addEventListener('submit', handleFormSubmit);
    }

    // --- Core Map/Search Functions ---

    async function performAddressSearch(query) {
        suggestionsList.innerHTML = '<li><i>Searching...</i></li>';
        suggestionsList.style.display = 'block';

        try {
            // Get current map center for bias (optional but good)
            const center = map ? map.getCamera().center : null;
            const lat = center ? center[1] : null;
            const lon = center ? center[0] : null;

            let url = `/api/maps/search?query=${encodeURIComponent(query)}`;
            if (lat && lon) {
                 url += `&lat=${lat}&lon=${lon}`;
            }

            // Cookie is sent automatically
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Search failed (${response.status})`);
            }
            const data = await response.json();

            renderSuggestions(data.results); // Assuming results are in data.results

        } catch (error) {
            console.error('Address search error:', error);
            suggestionsList.innerHTML = '<li><i>Error fetching suggestions.</i></li>';
            suggestionsList.style.display = 'block'; // Keep visible to show error
        }
    }

    function renderSuggestions(results) {
        suggestionsList.innerHTML = ''; // Clear previous/loading
        if (!results || results.length === 0) {
            suggestionsList.innerHTML = '<li><i>No results found.</i></li>';
            suggestionsList.style.display = 'block';
            return;
        }

        results.forEach(result => {
            const li = document.createElement('li');
            li.textContent = result.address?.freeformAddress || result.address?.streetName || 'Unknown location'; // Display address
            li.dataset.position = JSON.stringify(result.position); // Store position {lat, lon}
            li.dataset.address = result.address?.freeformAddress || '';
            li.addEventListener('click', () => {
                selectSuggestion(result);
                suggestionsList.style.display = 'none'; // Hide after selection
            });
            suggestionsList.appendChild(li);
        });
         suggestionsList.style.display = 'block';
    }

    function selectSuggestion(result) {
        const position = result.position; // { lat, lon }
        const address = result.address?.freeformAddress || addressInput.value; // Use result address

        if (position && position.lat && position.lon) {
            const coordinates = [position.lon, position.lat]; // Azure Maps uses [lon, lat]
            addressInput.value = address; // Update visible input

            // Update the map center and marker
            map.setCamera({
                center: coordinates,
                zoom: 15 // Adjust zoom level as desired
            });
            updateMapMarker(coordinates);

            // Update hidden fields and optionally map center/popup
            updateLocationState(coordinates, address);
        } else {
             console.warn("Selected suggestion missing position data:", result);
        }
         suggestionsList.style.display = 'none';
    }

    // Function to handle map click or marker drag end
    async function handleMapInteraction(coordinates) {
        updateMapMarker(coordinates); // Move the visual marker

        // Perform reverse geocoding using backend proxy
        try {
            const lon = coordinates[0];
            const lat = coordinates[1];
             // Cookie sent automatically
            const response = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                throw new Error(`Reverse geocode failed (${response.status})`);
            }
            const data = await response.json();

            const address = data.address?.address?.freeformAddress || `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            addressInput.value = address; // Update the visible input field

             // Update hidden fields and optionally map center/popup
             updateLocationState(coordinates, address);


        } catch (error) {
            console.error('Reverse geocoding error:', error);
            addressInput.value = "Could not find address";
            updateLocationState(coordinates, "Could not find address"); // Still store coords
        }
    }


    function updateMapMarker(coordinates) {
        console.log("updateMapMarker called with coordinates:", coordinates);
        if (!map) console.log("Map is not initialized.");
        if (!datasource) console.log("Datasource is not initialized.");
        if (!markerPin) console.log("MarkerPin is not initialized.");
        if (!map || !datasource || !markerPin) return;

        try {
            markerPin.setCoordinates(coordinates); // Use setCoordinates method
            datasource.setShapes(markerPin); // Update the datasource
            console.log("Marker position updated in datasource to:", markerPin.geometry.coordinates);
        } catch (error) {
            console.error("Error updating marker coordinates:", error);
        }

        // Ensure the marker layer is visible
        map.layers.getLayers().forEach(layer => {
            if(layer instanceof atlas.layer.SymbolLayer && layer.source === datasource.getId()) {
                 console.log("Found symbol layer with ID:", layer.getId());
                 layer.setOptions({ filter: null }); // Remove filter to show
                 console.log("Filter removed from symbol layer.");
            } else if (layer instanceof atlas.layer.SymbolLayer) {
                console.log(`Found a symbol layer but its source ID is ${layer.source} and datasource ID is ${datasource.getId()}`);
            }
        });
    }

    function updateLocationState(coordinates, address) {
         if (coordinates) {
             longitudeInput.value = coordinates[0];
             latitudeInput.value = coordinates[1];
         } else {
             longitudeInput.value = '';
             latitudeInput.value = '';
         }
         formattedAddressInput.value = address || ''; // Store the address (even if it's just coords)
         console.log("Location State Updated:", { lat: latitudeInput.value, lon: longitudeInput.value, address: formattedAddressInput.value });

          // Optional: Show popup with address
          if (popup && coordinates && address) {
              popup.setOptions({
                  content: `<div style="padding: 5px;">${address}</div>`,
                  position: coordinates
              });
              if (!popup.isOpen()) {
                    popup.open(map);
              }
          } else if (popup) {
                popup.close();
          }
    }

    // --- Form Submission ---
    async function handleFormSubmit(event) {
        event.preventDefault();

        const taskType = taskTypeSelect.value;
        const comments = commentsTextarea.value.trim();
        const scheduledDateTime = scheduledDateTimeInput.value || null;
        // Get final location details from hidden inputs
        const latitude = latitudeInput.value || null;
        const longitude = longitudeInput.value || null;
        const address = formattedAddressInput.value || null; // Use the hidden field's value

        if (!taskType) {
            showMessage('Please select a task type.', 'danger');
            return;
        }

        // Construct body
        const body = {
            taskType: taskType,
            comments: comments,
            ...(scheduledDateTime && { scheduledDateTime: scheduledDateTime }),
            // Only include location if BOTH lat/lon are present
            ...(latitude && longitude && { latitude: parseFloat(latitude) }),
            ...(latitude && longitude && { longitude: parseFloat(longitude) }),
            ...(latitude && longitude && address && { address: address }), // Include address if we have coords
        };

        try {
            showMessage('Submitting request...', 'info');
            console.log(body);
            // Cookie is sent automatically
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(`Request submitted successfully (ID: ${result.requestId})! Potential helpers are being notified.`, 'success');
                requestForm.reset();
                // Reset map state
                 latitudeInput.value = '';
                 longitudeInput.value = '';
                 formattedAddressInput.value = '';
                 if (markerPin) {
                     // Hide marker again
                      map.layers.getLayers().forEach(layer => {
                          if(layer instanceof atlas.layer.SymbolLayer) {
                              layer.setOptions({ filter: ['==', ['geometry-type'], 'NonExistent'] });
                          }
                      });
                 }
                 if(popup) popup.close();
                 // Optionally reset map center/zoom
                 // setTimeout(() => window.location.href = '/requestHistory', 2500);
            } else {
                if (response.status === 401 || response.status === 403) {
                     showMessage('Authentication error. Please log in again.', 'danger');
                } else {
                     showMessage(`Error: ${result.error || 'Failed to submit request.'}`, 'danger');
                }
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            showMessage('An unexpected error occurred. Please try again.', 'danger');
        }
    }

    function showMessage(msg, type = 'info') {
        messageDiv.textContent = msg;
        messageDiv.className = `alert alert-${type} mt-3`;
        messageDiv.style.display = msg ? 'block' : 'none';
    }

    // --- Start the process ---
    initializePage();

});