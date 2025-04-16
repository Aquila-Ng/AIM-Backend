document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const matchListDiv = document.getElementById('matchList');
    const paginationUl = document.getElementById('pagination');
    const messageDiv = document.getElementById('message');
    const messageTextSpan = document.getElementById('messageText');
    const loadingDiv = document.getElementById('loading');
    const modalElement = document.getElementById('matchDetailModal');
    // Modal Content Placeholders
    const modalTaskType = document.getElementById('modalTaskType');
    const modalRequesterName = document.getElementById('modalRequesterName');
    const modalRequesterAge = document.getElementById('modalRequesterAge');
    const modalComments = document.getElementById('modalComments');
    const modalScheduledTime = document.getElementById('modalScheduledTime');
    const modalLocationText = document.getElementById('modalLocationText'); // Renamed
    const modalScore = document.getElementById('modalScore');
    // Modal Map Elements
    const modalMapContainer = document.getElementById('modalMapContainer');
    const modalMapDiv = document.getElementById('modalMap');
    const modalMapMessage = document.getElementById('modalMapMessage');
    const modalMapElementId = 'modalMap';
    // Modal Buttons
    const acceptButton = document.getElementById('acceptButton');
    const declineButton = document.getElementById('declineButton');

    // --- State Variables ---
    let currentMatchData = null;
    let azureMapsKey = null;
    let modalMapInstance, modalDatasource, modalMarkerPin;
    let modalInstance = null; // To store the Bootstrap Modal instance

    // --- Initialization ---
    async function initializePage() {
        // Instantiate the Bootstrap modal object ONCE
        if (modalElement) {
             modalInstance = new bootstrap.Modal(modalElement);
        }
        await setupNavbar();
        await fetchMapConfig();
        await fetchMatches(1);
        setupEventListeners();
    }

    // --- Map Configuration ---
    async function fetchMapConfig() {
        // (Keep existing implementation - uses cookie auth)
        try {
             const response = await fetch('/api/maps/config');
             if (!response.ok) { /* ... handle auth error or other errors ... */ }
             else {
                 const config = await response.json();
                 if (config?.subscriptionKey) { azureMapsKey = config.subscriptionKey; console.log("Azure Maps Key loaded."); }
                 else { throw new Error("Subscription key missing."); }
             }
        } catch (error) { /* ... handle error, set azureMapsKey = null ... */ }
    }

    // --- Fetching Matches ---
    async function fetchMatches(page = 1) {
        // (Keep existing implementation - uses cookie auth)
        showMessage(''); loadingDiv.style.display = 'block';
        matchListDiv.innerHTML = ''; paginationUl.innerHTML = '';
        try {
            const response = await fetch(`/api/matches/pending?page=${page}&limit=6`); // 6 cards
            loadingDiv.style.display = 'none';
            if (!response.ok) { /* ... handle auth error/redirect or other errors ... */ return; }
            const data = await response.json();
            if (!data.matches || data.matches.length === 0) { matchListDiv.innerHTML = '<p class="col-12 text-center text-muted mt-4">You have no pending help offers.</p>'; return; }
            renderMatches(data.matches);
            renderPagination(data.currentPage, data.totalPages);
        } catch (error) { /* ... handle error ... */ }
    }

    // --- Rendering UI ---
    function renderMatches(matches) {
        // (Largely same, but ensure Bootstrap 5 attributes are set on card)
        matchListDiv.innerHTML = '';
        matches.forEach(match => {
            const colDiv = document.createElement('div'); colDiv.className = 'col';
            const card = document.createElement('div');
            card.className = 'card h-100';
            card.setAttribute('data-bs-toggle', 'modal'); // Use data-bs-toggle
            card.setAttribute('data-bs-target', '#matchDetailModal'); // Use data-bs-target
            card.dataset.matchInfo = JSON.stringify(match); // Store data

            const cardBody = document.createElement('div'); cardBody.className = 'card-body';
            const title = document.createElement('h6'); title.className = 'card-title';
            title.textContent = `Request: ${match.task_type || 'N/A'}`;
            const requesterInfo = document.createElement('p'); requesterInfo.className = 'card-text';
            requesterInfo.textContent = `From: ${match.requester_first_name || ''} ${match.requester_last_name || ''}`.trim() || 'Unknown User';
            const offeredAt = document.createElement('p'); offeredAt.className = 'card-text text-muted';
            offeredAt.innerHTML = `<small>Offered: ${match.offered_at ? new Date(match.offered_at).toLocaleString() : 'N/A'}</small>`;
            cardBody.appendChild(title); cardBody.appendChild(requesterInfo); cardBody.appendChild(offeredAt);
            card.appendChild(cardBody); colDiv.appendChild(card); matchListDiv.appendChild(colDiv);
        });
    }

    function renderPagination(currentPage, totalPages) {
        // (Keep existing implementation - BS5 pagination structure is similar)
        paginationUl.innerHTML = '';
        if (totalPages <= 1) { document.getElementById('paginationContainer').style.display = 'none'; return; };
        document.getElementById('paginationContainer').style.display = 'flex';

        const createPageItem = (page, text, isDisabled = false, isActive = false, isIcon = false) => {
            const li = document.createElement('li'); li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const link = document.createElement('a'); link.className = 'page-link'; link.href = '#';
            if (isIcon) { link.innerHTML = text; link.setAttribute('aria-label', text.includes('left') ? 'Previous' : 'Next'); }
            else { link.textContent = text || page; }
            if (!isDisabled) { link.onclick = (e) => { e.preventDefault(); fetchMatches(page); }; }
            else { link.setAttribute('tabindex', '-1'); link.setAttribute('aria-disabled', 'true'); }
            li.appendChild(link); return li;
        };

        paginationUl.appendChild(createPageItem(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1, false, true));
        for (let i = 1; i <= totalPages; i++) { paginationUl.appendChild(createPageItem(i, null, false, i === currentPage)); }
        paginationUl.appendChild(createPageItem(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages, false, true));
    }

    // --- Modal Logic ---
    function setupEventListeners() {
        // Listen for Bootstrap 5 modal show event on the modal element itself
        modalElement.addEventListener('show.bs.modal', (event) => {
            console.log("BS5 Modal show event triggered");
            const card = event.relatedTarget; // Element that triggered the modal (the card)
            if (!card || !card.dataset.matchInfo) {
                 console.error("Could not find match info on triggering element.");
                 populateModalWithError();
                 return;
            }
            try {
                currentMatchData = JSON.parse(card.dataset.matchInfo);
                populateModal(currentMatchData);
                handleModalMap(currentMatchData); // Handle map display logic
            } catch (e) {
                 console.error("Error parsing match info:", e);
                 populateModalWithError();
            }
        });

        // Cleanup map on modal hide
        modalElement.addEventListener('hidden.bs.modal', () => {
             if (modalMapInstance) {
                 console.log("Disposing of modal map instance.");
                 modalMapInstance.dispose();
                 modalMapInstance = null;
                 modalDatasource = null;
                 modalMarkerPin = null;
             }
             currentMatchData = null; // Clear current data when modal closes
         });

        // Accept/Decline Button Listeners
        acceptButton.addEventListener('click', handleAccept);
        declineButton.addEventListener('click', handleDecline);

         // Setup Navbar listeners (logout)
         const logoutButton = document.getElementById('logoutButton');
         if (logoutButton) { logoutButton.addEventListener('click', handleLogout); }
    }

    function populateModal(match) {
        // (Keep existing implementation)
        modalTaskType.textContent = match.task_type || 'N/A';
        modalRequesterName.textContent = `${match.requester_first_name || ''} ${match.requester_last_name || ''}`.trim() || 'Unknown';
        modalRequesterAge.textContent = match.requester_age || 'N/A';
        modalComments.textContent = match.comments || 'None';
        modalScore.textContent = match.score !== null && match.score !== undefined ? match.score.toFixed(2) : 'N/A';
        modalScheduledTime.textContent = match.scheduled_datetime ? new Date(match.scheduled_datetime).toLocaleString() : 'Not scheduled';
        modalLocationText.textContent = match.location_address || 'Not specified'; // Populate text address
        // Reset button states
        acceptButton.disabled = false;
        declineButton.disabled = false;
    }

    function populateModalWithError() {
        // (Add implementation to show error state in modal fields)
         modalTaskType.textContent = 'Error';
         modalRequesterName.textContent = 'Error';
         modalRequesterAge.textContent = 'N/A';
         modalComments.textContent = 'Could not load details.';
         modalScore.textContent = 'N/A';
         modalScheduledTime.textContent = 'N/A';
         modalLocationText.textContent = 'N/A';
         hideModalMap('Error loading details.');
         acceptButton.disabled = true;
         declineButton.disabled = true;
    }

    // --- Map Integration for Modal ---
    function handleModalMap(match) {
        // (Keep existing implementation - checks key, coordinates, calls init/update/hide)
         if (!azureMapsKey) { hideModalMap('Map config unavailable.'); return; }
         if (match.location_latitude && match.location_longitude) {
             const coordinates = [parseFloat(match.location_longitude), parseFloat(match.location_latitude)];
             if (!isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
                 modalMapMessage.style.display = 'none'; modalMapDiv.style.display = 'block';
                 if (!modalMapInstance) { initializeModalMap(coordinates); }
                 else { updateModalMap(coordinates); }
                 setTimeout(() => { if(modalMapInstance) modalMapInstance.resize(); }, 200);
             } else { hideModalMap("Invalid location data."); }
         } else { hideModalMap("Location not specified."); }
    }

    function initializeModalMap(centerCoordinates) {
        // (Keep existing implementation - creates map, source, layer, marker)
         if (!azureMapsKey || modalMapInstance) return;
         console.log("Initializing modal map at:", centerCoordinates);
         try {
             modalMapInstance = new atlas.Map(modalMapElementId, { center: centerCoordinates, zoom: 15, language: 'en-US', authOptions: { authType: 'subscriptionKey', subscriptionKey: azureMapsKey }, style:'road', interactive: false, showLogo: false, showFeedbackLink: false });
             modalMapInstance.events.add('ready', () => {
                 console.log("Modal map ready."); modalDatasource = new atlas.source.DataSource(); modalMapInstance.sources.add(modalDatasource);
                 modalMapInstance.layers.add(new atlas.layer.SymbolLayer(modalDatasource, null, { iconOptions: { image: 'marker-red', allowOverlap: true, ignorePlacement: true }, filter: ['==', ['geometry-type'], 'Point'] }));
                 modalMarkerPin = new atlas.data.Point(centerCoordinates); modalDatasource.add(modalMarkerPin); console.log("Modal marker added at:", centerCoordinates);
             });
             modalMapInstance.events.add('error', (e) => { console.error("Modal map error:", e.error); hideModalMap('Error loading map.');});
         } catch (mapError) { hideModalMap('Failed to initialize map.'); }
    }

    function updateModalMap(coordinates) {
        // (Keep existing implementation - updates marker coords, datasource, camera)
         if (!modalMapInstance || !modalDatasource || !modalMarkerPin) { if(coordinates && azureMapsKey) initializeModalMap(coordinates); return; };
         console.log("Updating modal map marker to:", coordinates);
         try {
             modalMarkerPin.geometry.coordinates = coordinates; modalDatasource.setShapes(modalMarkerPin);
             modalMapInstance.layers.getLayers().forEach(layer => { if(layer instanceof atlas.layer.SymbolLayer && layer.source === modalDatasource.getId()) { layer.setOptions({ filter: ['==', ['geometry-type'], 'Point'] }); }});
             modalMapInstance.setCamera({ center: coordinates, zoom: 15 });
         } catch (error) { console.error("Error updating modal map:", error); }
    }

     function hideModalMap(message = "Location not specified.") {
        // (Keep existing implementation)
         modalMapDiv.style.display = 'none';
         modalMapMessage.textContent = message;
         modalMapMessage.style.display = 'block';
     }

     // --- Accept / Decline Logic ---
     function handleAccept() {
         if (!currentMatchData) return;
         handleMatchResponse('accept', currentMatchData.match_id);
     }
      function handleDecline() {
         if (!currentMatchData) return;
         handleMatchResponse('decline', currentMatchData.match_id);
     }

     async function handleMatchResponse(action, matchId) {
        // Disable buttons
        acceptButton.disabled = true;
        declineButton.disabled = true;
        showMessage(`Processing ${action}...`, 'info', false); // Show persistent message in main page

        try {
             // Cookie sent automatically
             const response = await fetch(`/api/matches/${matchId}/${action}`, { method: 'POST' });

             // Check auth status first
             if (response.status === 401 || response.status === 403) {
                 showMessage('Authentication error. Please log in again.', 'danger', false);
                 if (modalInstance) modalInstance.hide(); // Use BS5 hide
                 setTimeout(() => window.location.href = '/login', 2000);
                 return;
             }

             const result = await response.json(); // Try to parse JSON regardless

             if (!response.ok) {
                 throw new Error(result.error || `Failed to ${action} match`);
             }

             if (modalInstance) modalInstance.hide(); // Use BS5 hide on success
             showMessage(`Match successfully ${action}ed!`, 'success', true); // Auto-hide success
             await fetchMatches(); // Refresh list

        } catch (error) {
            console.error(`Error ${action}ing match:`, error);
            showMessage(`Error: ${error.message}`, 'danger', false); // Show persistent error in main page
            // Re-enable buttons on error (if modal is still open conceptually)
             acceptButton.disabled = false;
             declineButton.disabled = false;
        }
     }

    // --- Utilities & Navbar ---
    function showMessage(msg, type = 'info', autoHide = true) {
        // (Keep existing implementation - uses Bootstrap 5 alert classes/methods)
        if (!msg) { messageDiv.style.display = 'none'; return; }
        messageTextSpan.textContent = msg;
        messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
        messageDiv.style.display = 'block';
        if (autoHide) { setTimeout(() => { const bsAlert = bootstrap.Alert.getOrCreateInstance(messageDiv); if (bsAlert) bsAlert.close(); else messageDiv.style.display = 'none'; }, 3500); }
    }
    async function setupNavbar() { /* (Keep existing implementation) */
        try {
             const response = await fetch('/api/users/me');
             if (response.ok) {
                 const user = await response.json();
                 const userNameElement = document.getElementById('navbarUsername');
                 if (userNameElement) { userNameElement.textContent = user.first_name || user.email; }
             } else if (response.status === 401 || response.status === 403) { window.location.href = '/login'; }
             else { console.error('Navbar user fetch error:', response.statusText); }
         } catch (error) { console.error('Navbar setup error:', error); }
    }
    async function handleLogout() { /* (Keep existing implementation) */
         try {
             const logoutResponse = await fetch('/api/auth/logout', { method: 'POST' });
             if (logoutResponse.ok) { window.location.href = '/login'; }
             else { showMessage('Logout failed.', 'warning', false); }
         } catch (err) { showMessage('Logout error.', 'danger', false); }
    }

    // --- Initialize Page ---
    initializePage();

});