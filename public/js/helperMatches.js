document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const matchListDiv = document.getElementById('matchList');
    const paginationUl = document.getElementById('pagination');
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');
    const modalElement = document.getElementById('matchDetailModal'); // Get modal element
    const modal = $('#matchDetailModal'); // jQuery selector for Bootstrap modal methods
    const modalMapElementId = 'modalMap';
    const mapMessageElement = document.getElementById('mapMessage');

    // --- State Variables ---
    let currentMatchData = null; // Store data for the currently viewed match
    let azureMapsKey = null;     // Store fetched Azure Maps key
    let modalMapInstance, modalDatasource, modalMarkerPin; // Variables for map objects inside modal

    // --- Initial Page Setup ---
    async function initializePage() {
        await fetchAndDisplayUserInfo(); // Fetch user info for navbar
        await fetchMapConfig();          // Fetch map key
        await fetchMatches(1);           // Fetch first page of matches
        setupEventListeners();           // Setup button/modal listeners
    }

    // --- Authentication & User Info ---
    async function fetchAndDisplayUserInfo() {
        // Fetches user info using the auth cookie and updates the navbar
        try {
            const response = await fetch('/api/users/me'); // Cookie sent automatically
            if (response.ok) {
                const user = await response.json();
                const userNameElement = document.getElementById('userDropdown');
                if (userNameElement) {
                    userNameElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.first_name || user.email}`;
                }
                // Store user info if needed globally: window.currentUser = user;
            } else if (response.status === 401 || response.status === 403) {
                window.location.href = '/login'; // Redirect if not authenticated
            } else {
                console.error('Failed to fetch user info:', response.statusText);
                // Handle error display if needed
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
             showMessage('Could not load user details.', 'warning');
        }
    }

     async function handleLogout() {
         try {
             const response = await fetch('/api/auth/logout', { method: 'POST' });
             if (response.ok) {
                 window.location.href = '/login';
             } else {
                 console.error('Logout failed:', await response.text());
                 showMessage('Logout failed. Please try again.', 'danger');
             }
         } catch (error) {
             console.error('Error during logout:', error);
              showMessage('An error occurred during logout.', 'danger');
         }
     }

    // --- Map Configuration ---
    async function fetchMapConfig() {
        try {
            const response = await fetch('/api/maps/config'); // Auth cookie sent automatically
            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                     console.warn('Auth error fetching map config, user might be logged out.');
                     // Redirect handled by main fetch checks or page load protection
                 } else {
                     throw new Error(`Failed to fetch map config (${response.status})`);
                 }
            } else {
                const config = await response.json();
                if (config && config.subscriptionKey) {
                    azureMapsKey = config.subscriptionKey;
                    console.log("Azure Maps Key loaded.");
                } else {
                    throw new Error("Subscription key missing in map config response.");
                }
            }
        } catch (error) {
            console.error("Error fetching map config:", error);
            showMessage('Map features may be limited: Could not load map configuration.', 'warning');
            azureMapsKey = null; // Ensure key is null if fetch failed
        }
    }

    // --- Fetching Matches ---
    async function fetchMatches(page = 1) {
        showMessage('');
        matchListDiv.innerHTML = '';
        paginationUl.innerHTML = '';
        loadingDiv.style.display = 'block';

        try {
            // REMOVED Authorization header - cookie is sent automatically
            const response = await fetch(`/api/matches/pending?page=${page}&limit=5`);

            loadingDiv.style.display = 'none';

            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                    showMessage('Your session has expired or you are not authorized. Redirecting to login...', 'warning');
                    setTimeout(() => window.location.href = '/login', 2500);
                 } else {
                     const errorResult = await response.json();
                     throw new Error(errorResult.error || 'Failed to fetch matches');
                 }
                 return; // Stop processing on error/redirect
            }

            const data = await response.json();

            if (!data.matches || data.matches.length === 0) {
                showMessage('You have no pending help offers.', 'info');
                return;
            }

            renderMatches(data.matches);
            renderPagination(data.currentPage, data.totalPages);

        } catch (error) {
            loadingDiv.style.display = 'none';
            console.error('Error fetching pending matches:', error);
            showMessage(`Error: ${error.message}`, 'danger');
        }
    }

    // --- Rendering UI ---
    function renderMatches(matches) {
        matches.forEach(match => {
            const card = document.createElement('div');
            card.className = 'card';
            // Store match data directly on the element for easy access
            // Stringify is important here
            card.dataset.matchInfo = JSON.stringify(match);

            // Use Bootstrap's modal attributes directly for simplicity
            card.setAttribute('data-toggle', 'modal');
            card.setAttribute('data-target', '#matchDetailModal');

            // Add event listener to set currentMatchData *before* modal shows
            card.addEventListener('click', () => {
                 currentMatchData = match; // Set data for the modal about to open
                 console.log("Card clicked, currentMatchData set:", currentMatchData);
            });


            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            const title = document.createElement('h5');
            title.className = 'card-title';
            title.textContent = `Request: ${match.task_type}`;

            const requesterInfo = document.createElement('p');
            requesterInfo.className = 'card-text';
            requesterInfo.textContent = `From: ${match.requester_first_name} ${match.requester_last_name}`;

            const offeredAt = document.createElement('p');
            offeredAt.className = 'card-text text-muted';
            offeredAt.textContent = `Offered: ${new Date(match.offered_at).toLocaleString()}`;

            cardBody.appendChild(title);
            cardBody.appendChild(requesterInfo);
            cardBody.appendChild(offeredAt);
            card.appendChild(cardBody);
            matchListDiv.appendChild(card);
        });
    }

    function renderPagination(currentPage, totalPages) {
        // (Keep the pagination logic from previous version - it's reusable)
        paginationUl.innerHTML = ''; // Clear existing
        if (totalPages <= 1) return;

        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const link = document.createElement('a');
            link.className = 'page-link';
            link.href = '#';
            link.textContent = text || page;
            if (!isDisabled) {
                link.onclick = (e) => { e.preventDefault(); fetchMatches(page); };
            }
            li.appendChild(link);
            return li;
        };

        paginationUl.appendChild(createPageItem(currentPage - 1, 'Previous', currentPage === 1));
        // Add logic for ellipsis if many pages, or just show all for simplicity
        for (let i = 1; i <= totalPages; i++) {
            paginationUl.appendChild(createPageItem(i, null, false, i === currentPage));
        }
        paginationUl.appendChild(createPageItem(currentPage + 1, 'Next', currentPage === totalPages));
    }

    function showMessage(msg, type = 'info') {
        messageDiv.textContent = msg;
        messageDiv.className = `alert alert-${type} mt-3`;
        messageDiv.style.display = msg ? 'block' : 'none';
    }

     // --- Modal Logic ---

     function populateModalDetails() {
         if (!currentMatchData) return;

         document.getElementById('modalTaskType').textContent = currentMatchData.task_type || 'N/A';
         document.getElementById('modalRequesterAge').textContent = currentMatchData.requester_age || 'N/A';
         document.getElementById('modalComments').textContent = currentMatchData.comments || 'None';
         document.getElementById('modalLocation').textContent = currentMatchData.location_address || 'Not specified';
         if (!currentMatchData.scheduled_datetime){
            document.getElementById('modalDateTime').className = "text-danger"
            document.getElementById('modalDateTime').textContent = "ASAP";
        }
        else {
            document.getElementById('modalDateTime').className = "text-primary"
            document.getElementById('modalDateTime').innerHTML = currentMatchData.scheduled_datetime ? new Date(currentMatchData.scheduled_datetime).toLocaleString() : 'Error';
        }

         // Reset button states
         document.getElementById('acceptButton').disabled = false;
         document.getElementById('declineButton').disabled = false;
     }

    // --- Map Integration for Modal ---

    function initializeModalMap(centerCoordinates) {
        if (!azureMapsKey) {
            console.warn("Azure Maps Key not available, cannot initialize modal map.");
             mapMessageElement.textContent = 'Map configuration unavailable.';
             mapMessageElement.style.display = 'block';
            return;
        }
         if (modalMapInstance) {
             console.log("Modal map already initialized.");
             return; // Already initialized
         }
         console.log("Initializing modal map...");
         mapMessageElement.style.display = 'none'; // Hide loading message

         try {
             modalMapInstance = new atlas.Map(modalMapElementId, {
                 center: centerCoordinates || [0,0], // Default if no coords provided
                 zoom: 14, // Start somewhat zoomed in
                 language: 'en-US',
                 authOptions: {
                     authType: 'subscriptionKey',
                     subscriptionKey: azureMapsKey
                 },
                 style:'road_shaded_relief'
             });

             modalMapInstance.events.add('ready', function () {
                 console.log("Modal map ready.");
                 modalDatasource = new atlas.source.DataSource();
                 modalMapInstance.sources.add(modalDatasource);

                 // Add layer for the marker
                 modalMapInstance.layers.add(new atlas.layer.SymbolLayer(modalDatasource, null, {
                     iconOptions: { image: 'marker-red', allowOverlap: true, ignorePlacement: true }, // Red marker
                 }));

                 // Create the marker pin feature - start invisible
                  modalMarkerPin = new atlas.data.Point(centerCoordinates || [0,0]);
                  modalDatasource.add(modalMarkerPin);
                  // Ensure layer is ready before trying to update marker? Add delay or check?
                   if(centerCoordinates) {
                         updateModalMapMarker(centerCoordinates); // Place marker if coords exist
                   } else {
                       // Hide marker if no coords? The layer filter might handle this.
                       console.log("No initial coordinates for modal map marker.");
                       hideModalMapMarker();
                   }
             });

             // Handle potential map errors during init
              modalMapInstance.events.add('error', function(e) {
                    console.error("Modal map error:", e.error);
                    mapMessageElement.textContent = 'Error loading map.';
                    mapMessageElement.style.display = 'block';
              });

         } catch (mapError) {
             console.error("Error initializing modal map:", mapError);
             mapMessageElement.textContent = 'Failed to initialize map.';
             mapMessageElement.style.display = 'block';
         }
    }

    // Use the provided updateMapMarker, adapting it for modal map components
    function updateModalMapMarker(coordinates) {
        console.log("updateModalMapMarker called with coordinates:", coordinates);
        if (!modalMapInstance) console.log("Modal Map is not initialized.");
        if (!modalDatasource) console.log("Modal Datasource is not initialized.");
        if (!modalMarkerPin) console.log("Modal MarkerPin is not initialized.");
        if (!modalMapInstance || !modalDatasource || !modalMarkerPin) return;

         // Show map message element initially if needed
         mapMessageElement.style.display = 'none';

        try {
            // Azure Maps coordinates are [longitude, latitude]
            modalMarkerPin.geometry.coordinates = coordinates; // Update pin's coordinates
            modalDatasource.setShapes(modalMarkerPin); // Force datasource update
            console.log("Modal marker position updated in datasource to:", modalMarkerPin.geometry.coordinates);

            // Ensure the marker layer is visible
            modalMapInstance.layers.getLayers().forEach(layer => {
                if(layer instanceof atlas.layer.SymbolLayer && layer.source === modalDatasource.getId()) {
                     console.log("Found modal symbol layer with ID:", layer.getId());
                     layer.setOptions({ filter: null }); // Remove filter to show
                     console.log("Filter removed from modal symbol layer.");
                } else if (layer instanceof atlas.layer.SymbolLayer) {
                    console.log(`Found a symbol layer but its source ID is ${layer.source} and modal datasource ID is ${modalDatasource.getId()}`);
                }
            });

             // Adjust camera
             modalMapInstance.setCamera({
                 center: coordinates,
                 zoom: 15
             });

        } catch (error) {
            console.error("Error updating modal marker coordinates:", error);
            mapMessageElement.textContent = 'Error updating map marker.';
            mapMessageElement.style.display = 'block';
        }
    }

     function hideModalMapMarker() {
        if (!modalMapInstance || !modalDatasource) return;
         console.log("Hiding modal map marker.");
         modalMapInstance.layers.getLayers().forEach(layer => {
             if(layer instanceof atlas.layer.SymbolLayer && layer.source === modalDatasource.getId()) {
                 layer.setOptions({ filter: ['==', ['geometry-type'], 'NonExistent'] }); // Filter to hide
             }
         });
         mapMessageElement.textContent = 'Location not specified for this request.';
         mapMessageElement.style.display = 'block';
     }

    // --- Event Listeners ---
    function setupEventListeners() {
         // Modal event listener (using jQuery for Bootstrap events)
         $(modalElement).on('show.bs.modal', function () {
             console.log("Modal show event triggered");
             populateModalDetails(); // Populate text fields

             // Handle map logic
             if (currentMatchData && currentMatchData.location_latitude && currentMatchData.location_longitude) {
                 const coordinates = [
                     parseFloat(currentMatchData.location_longitude), // Lon first
                     parseFloat(currentMatchData.location_latitude)   // Lat second
                 ];
                 if (!isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
                     if (!modalMapInstance) {
                         initializeModalMap(coordinates); // Initialize map centered on location
                     } else {
                         updateModalMapMarker(coordinates); // Just update existing map
                     }
                 } else {
                     console.warn("Invalid coordinates for match:", currentMatchData);
                     if (modalMapInstance) hideModalMapMarker();
                     else { mapMessageElement.textContent = 'Invalid location data.'; mapMessageElement.style.display = 'block';}
                 }
             } else {
                 console.log("No location data for this match.");
                 // Initialize map without marker if it's the first time, or hide marker if map exists
                 if (!modalMapInstance && azureMapsKey) { // Only init if key exists
                     initializeModalMap(null); // Initialize map at default center, no marker shown initially
                 } else if (modalMapInstance) {
                     hideModalMapMarker();
                 } else {
                     mapMessageElement.textContent = 'Location not specified for this request.';
                     mapMessageElement.style.display = 'block';
                 }
             }
         });

         // Accept button
         document.getElementById('acceptButton').addEventListener('click', async () => {
             if (!currentMatchData) return;
             await handleMatchResponse('accept', currentMatchData.match_id);
         });

         // Decline button
         document.getElementById('declineButton').addEventListener('click', async () => {
             if (!currentMatchData) return;
             await handleMatchResponse('decline', currentMatchData.match_id);
         });

         // Logout button
          const logoutButton = document.getElementById('logoutButton');
          if (logoutButton) {
              logoutButton.addEventListener('click', handleLogout);
          }
    }


     async function handleMatchResponse(action, matchId) {
        // Disable buttons
        document.getElementById('acceptButton').disabled = true;
        document.getElementById('declineButton').disabled = true;
        showMessage('Processing...', 'info', false); // Show persistent message

        try {
             // REMOVED Authorization header
             const response = await fetch(`/api/matches/${matchId}/${action}`, {
                 method: 'POST'
             });

             // Check auth status first
             if (response.status === 401 || response.status === 403) {
                showMessage('Authentication error. Please log in again.', 'danger');
                modal.modal('hide');
                setTimeout(() => window.location.href = '/login', 2000);
                return; // Stop processing
             }

             const result = await response.json(); // Try to parse JSON regardless

             if (!response.ok) {
                 throw new Error(result.error || `Failed to ${action} match`);
             }

             modal.modal('hide');
             showMessage(`Match successfully ${action}ed!`, 'success', true); // Auto-hide success
             await fetchMatches(); // Refresh list (await to ensure it tries before message hides)

        } catch (error) {
            console.error(`Error ${action}ing match:`, error);
            showMessage(`Error: ${error.message}`, 'danger', false); // Show persistent error
            // Re-enable buttons on error
            document.getElementById('acceptButton').disabled = false;
            document.getElementById('declineButton').disabled = false;
        }
     }

     // Modified showMessage to allow persistent messages
      function showMessage(msg, type = 'info', autoHide = true) {
        messageDiv.textContent = msg;
        messageDiv.className = `alert alert-${type} mt-3`;
        messageDiv.style.display = msg ? 'block' : 'none';
        if (autoHide && (type === 'success' || type === 'info')) {
             setTimeout(() => {
                 if (messageDiv.textContent === msg) { // Only hide if message hasn't changed
                      messageDiv.style.display = 'none';
                 }
             }, 3000); // Hide after 3 seconds
        }
     }

    // --- Start the page initialization ---
    initializePage();

});

document.getElementById('logoutButton').addEventListener('click', async (event) => {
    event.preventDefault();
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login'; // Redirect on successful logout
        } else {
            console.error('Logout failed:', await response.text());
            alert('Logout failed. Please try again.');
        }
    }
    catch (error) {
        console.error('Error during logout:', error);
        alert('An error occurred during logout.');
    }
});