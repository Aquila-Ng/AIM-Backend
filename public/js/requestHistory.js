document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const requestListDiv = document.getElementById('requestList');
    const paginationUl = document.getElementById('pagination');
    const messageDiv = document.getElementById('message');
    const messageTextSpan = document.getElementById('messageText');
    const loadingDiv = document.getElementById('loading');
    const modalElement = document.getElementById('requestDetailModal');
    // Modal Content Placeholders
    const modalRequestId = document.getElementById('modalRequestId');
    const modalTaskType = document.getElementById('modalTaskType');
    const modalStatusBadge = document.getElementById('modalStatusBadge');
    const modalComments = document.getElementById('modalComments');
    const modalCreatedAt = document.getElementById('modalCreatedAt');
    const modalScheduledTime = document.getElementById('modalScheduledTime');
    const modalLocation = document.getElementById('modalLocation'); // Text address
    const modalHelperInfo = document.getElementById('modalHelperInfo');
    const modalGoToChatBtn = document.getElementById('modalGoToChatBtn');
    // Modal Map Elements
    const modalMapContainer = document.getElementById('modalMapContainer');
    const modalMapDiv = document.getElementById('modalMap');
    const modalMapMessage = document.getElementById('modalMapMessage');
    const modalMapElementId = 'modalMap'; // ID for map init

    // --- State ---
    let currentRequestData = null;
    let azureMapsKey = null; // Store fetched Azure Maps key
    let modalMapInstance, modalDatasource, modalMarkerPin; // Map objects for modal

    // --- Initialization ---
    async function initializePage() {
        await setupNavbar();
        await fetchMapConfig(); // Fetch map key early
        await fetchHistory(1);
        setupEventListeners();
    }

    // --- Fetching Map Config ---
    async function fetchMapConfig() {
        try {
            const response = await fetch('/api/maps/config'); // Auth cookie sent automatically
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.warn('Auth error fetching map config, user might be logged out.');
                } else {
                    throw new Error(`Failed to fetch map config (${response.status})`);
                }
            } else {
                const config = await response.json();
                if (config && config.subscriptionKey) {
                    azureMapsKey = config.subscriptionKey;
                    console.log("Azure Maps Key loaded for history page.");
                } else {
                    throw new Error("Subscription key missing in map config response.");
                }
            }
        } catch (error) {
            console.error("Error fetching map config:", error);
            showMessage('Map features may be unavailable.', 'warning', true);
            azureMapsKey = null;
        }
    }

    // --- Fetching History ---
    async function fetchHistory(page = 1) {
        showMessage('');
        loadingDiv.style.display = 'block';
        requestListDiv.innerHTML = '';
        paginationUl.innerHTML = '';

        try {
            const response = await fetch(`/api/requests/my-history?page=${page}&limit=6`);
            loadingDiv.style.display = 'none';

            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                     showMessage('Your session has expired. Please log in again.', 'warning', false);
                     setTimeout(() => window.location.href = '/login', 2500);
                 } else { throw new Error((await response.json()).error || 'Failed to fetch history'); }
                 return;
            }
            const data = await response.json();
            if (!data.requests || data.requests.length === 0) {
                 requestListDiv.innerHTML = '<p class="col-12 text-center text-muted mt-4">You have not created any requests yet.</p>';
                 return;
            }
            renderRequestCards(data.requests);
            renderPagination(data.currentPage, data.totalPages);

        } catch (error) { /* ... (keep existing error handling) ... */ }
    }

    // --- Rendering UI ---
    function renderRequestCards(requests) {
        // (Keep the existing renderRequestCards implementation - it already sets up the card structure and data attribute)
        requestListDiv.innerHTML = '';
        requests.forEach(req => {
            const colDiv = document.createElement('div'); 
            colDiv.className = 'col';

            const card = document.createElement('div');
            card.className = 'card h-100';
            card.setAttribute('data-bs-toggle', 'modal');
            card.setAttribute('data-bs-target', '#requestDetailModal');

            card.dataset.requestInfo = JSON.stringify(req); // Store data

            const cardBody = document.createElement('div'); 
            cardBody.className = 'card-body d-flex flex-column';

            const topRow = document.createElement('div'); 
            topRow.className = 'd-flex justify-content-between align-items-start mb-2';

            const title = document.createElement('h6'); title.className = 'card-title mb-0 me-2';
            title.textContent = `Request #${req.id}: ${req.task_type || 'N/A'}`;

            const statusBadge = document.createElement('span');
            const statusClass = req.status ? req.status.replace(/_/g, '-').toLowerCase() : 'unknown';
            statusBadge.className = `badge rounded-pill status-badge status-${statusClass}`;
            statusBadge.textContent = req.status ? req.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';

            topRow.appendChild(title); topRow.appendChild(statusBadge);

            const details = document.createElement('p');
            details.className = 'card-text text-muted mb-2 flex-grow-1';
            details.textContent = req.comments || 'No additional details';
            
            const footerDiv = document.createElement('div'); footerDiv.className = 'mt-auto';
            const createdAt = document.createElement('small'); createdAt.className = 'text-muted d-block';
            createdAt.textContent = `Created: ${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}`;
            footerDiv.appendChild(createdAt);

            if ((req.status === 'matched' || req.status === 'completed') && req.helper_first_name) {
                 const helperInfo = document.createElement('small'); 
                 helperInfo.className = 'text-muted d-block fw-medium';
                 helperInfo.textContent = `${req.status === 'matched' ? 'Helper' : 'Completed by'}: ${req.helper_first_name} ${req.helper_last_name || ''}`;
                 footerDiv.appendChild(helperInfo);
            }

            cardBody.appendChild(topRow); 
            cardBody.appendChild(details); 
            cardBody.appendChild(footerDiv);

            card.appendChild(cardBody); 
            colDiv.appendChild(card); 
            requestListDiv.appendChild(colDiv);
        });
    }

    function renderPagination(currentPage, totalPages) { /* (Keep existing implementation) */
        paginationUl.innerHTML = '';
        if (totalPages <= 1) { document.getElementById('paginationContainer').style.display = 'none'; return; };
        document.getElementById('paginationContainer').style.display = 'flex';
        const createPageItem = (page, text, isDisabled = false, isActive = false, isIcon = false) => {
            const li = document.createElement('li'); li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const link = document.createElement('a'); link.className = 'page-link'; link.href = '#';
            if (isIcon) { link.innerHTML = text; link.setAttribute('aria-label', text.includes('left') ? 'Previous' : 'Next'); }
            else { link.textContent = text || page; }
            if (!isDisabled) { link.onclick = (e) => { e.preventDefault(); fetchHistory(page); }; }
            else { link.setAttribute('tabindex', '-1'); link.setAttribute('aria-disabled', 'true'); }
            li.appendChild(link); return li;
        };
        paginationUl.appendChild(createPageItem(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1, false, true));
        for (let i = 1; i <= totalPages; i++) { paginationUl.appendChild(createPageItem(i, null, false, i === currentPage)); }
        paginationUl.appendChild(createPageItem(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages, false, true));
    }

    // --- Modal & Map Logic ---
    function setupEventListeners() {
        modalElement.addEventListener('show.bs.modal', (event) => {
            console.log("Modal show event triggered for Request History");
            const card = event.relatedTarget; // Button or element that triggered the modal (the card div)
            if (!card || !card.dataset.requestInfo) {
                console.error("Could not find request info on triggering element.");
                populateModalWithError(); // Show error state in modal
                return;
            }
            try {
                currentRequestData = JSON.parse(card.dataset.requestInfo);
                populateModal(currentRequestData); // Populate text details
                handleModalMap(currentRequestData); // Handle map display logic
            } catch (e) {
                console.error("Error parsing request info:", e);
                populateModalWithError();
            }
        });

         // Cleanup map on modal hide to prevent issues if SDK loaded multiple times
          modalElement.addEventListener('hidden.bs.modal', () => {
              if (modalMapInstance) {
                  console.log("Disposing of modal map instance.");
                  modalMapInstance.dispose();
                  modalMapInstance = null;
                  modalDatasource = null;
                  modalMarkerPin = null;
              }
          });

         // Setup Navbar listeners (logout)
         const logoutButton = document.getElementById('logoutButton');
         if (logoutButton) { logoutButton.addEventListener('click', handleLogout); }
    }

    function populateModal(req) {
        // (Keep existing implementation for populating text fields and status badge)
        modalRequestId.textContent = req.id || 'N/A';
        modalTaskType.textContent = req.task_type || 'N/A';
        modalComments.textContent = req.comments || 'None provided.';
        modalCreatedAt.textContent = req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A';
        modalScheduledTime.textContent = req.scheduled_datetime ? new Date(req.scheduled_datetime).toLocaleString() : 'Not scheduled';
        modalLocation.textContent = req.location_address || 'N/A'; // Address text
        const statusClass = req.status ? req.status.replace(/_/g, '-').toLowerCase() : 'unknown';
        modalStatusBadge.className = `badge rounded-pill status-badge status-${statusClass}`;
        modalStatusBadge.textContent = req.status ? req.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';
        if ((req.status === 'matched' || req.status === 'completed') && req.helper_first_name) {
            modalHelperInfo.textContent = `${req.helper_first_name} ${req.helper_last_name || ''}`;
            modalHelperInfo.classList.remove('text-muted');
        } else {
            modalHelperInfo.textContent = 'Not yet assigned';
             modalHelperInfo.classList.add('text-muted');
        }

        // Go to Chat Button Logic (using updated backend data assumption)
        if (req.status === 'matched' && req.chat_id) { // Ensure backend sends chat_id
             modalGoToChatBtn.style.display = 'block';
             modalGoToChatBtn.onclick = () => {
                 window.location.href = `/chatView.html?chatId=${req.chat_id}`;
             };
        } else {
             modalGoToChatBtn.style.display = 'none';
             modalGoToChatBtn.onclick = null;
        }
    }

     function populateModalWithError() {
         modalRequestId.textContent = 'Error';
         modalTaskType.textContent = 'Error';
         modalStatusBadge.className = 'badge rounded-pill bg-danger';
         modalStatusBadge.textContent = 'ERROR';
         modalComments.textContent = 'Could not load request details.';
         modalCreatedAt.textContent = 'N/A';
         modalScheduledTime.textContent = 'N/A';
         modalLocation.textContent = 'N/A';
         modalHelperInfo.textContent = 'N/A';
         modalGoToChatBtn.style.display = 'none';
         modalMapDiv.style.display = 'none';
         modalMapMessage.textContent = 'Error loading details.';
         modalMapMessage.style.display = 'block';
     }

    // --- Modal Map Handling ---
     function handleModalMap(req) {
         if (!azureMapsKey) {
             console.warn("Map key not loaded, cannot display map.");
             modalMapDiv.style.display = 'none';
             modalMapMessage.textContent = 'Map configuration unavailable.';
             modalMapMessage.style.display = 'block';
             return;
         }

         if (req.location_latitude && req.location_longitude) {
             const coordinates = [
                 parseFloat(req.location_longitude), // Lon first
                 parseFloat(req.location_latitude)   // Lat second
             ];

             if (!isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
                  modalMapMessage.style.display = 'none'; // Hide message
                  modalMapDiv.style.display = 'block';   // Show map div

                 // Initialize map IF NOT ALREADY INITIALIZED, else update
                 if (!modalMapInstance) {
                     initializeModalMap(coordinates);
                 } else {
                     updateModalMap(coordinates);
                 }
                 // Ensure resize after modal is fully shown
                  setTimeout(() => {
                     if(modalMapInstance) modalMapInstance.resize();
                 }, 200); // Adjust delay if needed

             } else {
                 console.warn("Invalid coordinates in request data:", req);
                 hideModalMap("Invalid location data.");
             }
         } else {
             console.log("No location data for this request.");
             hideModalMap("Location not specified for this request.");
         }
     }

    function initializeModalMap(centerCoordinates) {
         if (!azureMapsKey || modalMapInstance) return; // Don't re-initialize

         console.log("Initializing modal map at:", centerCoordinates);
         try {
             modalMapInstance = new atlas.Map(modalMapElementId, {
                 center: centerCoordinates,
                 zoom: 15, // Zoom in reasonably close
                 language: 'en-US',
                 authOptions: { 
                    authType: 'subscriptionKey', 
                    subscriptionKey: azureMapsKey 
                },
                 style: 'road', // Simpler style for static view
                 interactive: false, // Make the map non-interactive
                 showLogo: false,
                 showFeedbackLink: false
             });

             modalMapInstance.events.add('ready', function () {
                 console.log("Modal map ready.");
                 modalDatasource = new atlas.source.DataSource();
                 modalMapInstance.sources.add(modalDatasource);

                 // Add layer for the marker (non-interactive)
                 modalMapInstance.layers.add(new atlas.layer.SymbolLayer(modalDatasource, null, {
                     iconOptions: { image: 'marker-red', allowOverlap: true, ignorePlacement: true },
                     filter: ['==', ['geometry-type'], 'Point'] // Initially show points
                 }));

                 // Create the marker pin feature
                 modalMarkerPin = new atlas.data.Point(centerCoordinates);
                 modalDatasource.add(modalMarkerPin);
                 console.log("Modal marker added at:", centerCoordinates);
             });

             modalMapInstance.events.add('error', (e) => { console.error("Modal map error:", e.error); hideModalMap('Error loading map.');});

         } catch (mapError) { /* ... handle error ... */ hideModalMap('Failed to initialize map.'); }
    }

    function updateModalMap(coordinates) {
        if (!modalMapInstance || !modalDatasource || !modalMarkerPin) {
             console.warn("Attempted to update map before initialization.");
              // Try initializing now if coordinates are valid
              if(coordinates && azureMapsKey) initializeModalMap(coordinates);
             return;
        };
        console.log("Updating modal map marker to:", coordinates);
        try {
            modalMarkerPin.geometry.coordinates = coordinates;
            modalDatasource.setShapes(modalMarkerPin);

            // Ensure layer filter allows point display
             modalMapInstance.layers.getLayers().forEach(layer => {
                 if(layer instanceof atlas.layer.SymbolLayer && layer.source === modalDatasource.getId()) {
                      layer.setOptions({ filter: ['==', ['geometry-type'], 'Point'] });
                 }
             });

            modalMapInstance.setCamera({ center: coordinates, zoom: 15 });
        } catch (error) {
            console.error("Error updating modal map:", error);
        }
    }

     function hideModalMap(message = "Location not specified.") {
         modalMapDiv.style.display = 'none';
         modalMapMessage.textContent = message;
         modalMapMessage.style.display = 'block';
         // If map instance exists, clear its data? Optional.
         // if (modalDatasource) modalDatasource.clear();
     }


    // --- Utilities & Navbar ---
    function showMessage(msg, type = 'info', autoHide = true) { /* (Keep existing implementation) */
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