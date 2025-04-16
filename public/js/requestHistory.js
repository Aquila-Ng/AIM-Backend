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
    const modalLocation = document.getElementById('modalLocation');
    const modalHelperInfo = document.getElementById('modalHelperInfo');
    const modalGoToChatBtn = document.getElementById('modalGoToChatBtn');

    // --- State ---
    let currentRequestData = null; // To hold data for the modal

    // --- Initialization ---
    async function initializePage() {
        await setupNavbar(); // Setup user display/logout
        await fetchHistory(1); // Fetch first page of history
        setupEventListeners(); // Setup modal listener
    }

    // --- Fetching History ---
    async function fetchHistory(page = 1) {
        showMessage(''); // Clear previous messages
        loadingDiv.style.display = 'block';
        requestListDiv.innerHTML = ''; // Clear list while loading
        paginationUl.innerHTML = '';

        try {
            // Cookie sent automatically
            const response = await fetch(`/api/requests/my-history?page=${page}&limit=6`, { // Show 6 cards per page (2 rows)
                method: 'GET',
            });
            loadingDiv.style.display = 'none';

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    showMessage('Your session has expired or you are not authorized. Redirecting...', 'warning', false);
                    setTimeout(() => window.location.href = '/login', 2500);
                } else {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Failed to fetch history');
                }
                return;
            }

            const data = await response.json();

            if (!data.requests || data.requests.length === 0) {
                 requestListDiv.innerHTML = '<p class="col-12 text-center text-muted mt-4">You have not created any requests yet.</p>';
                return;
            }

            renderRequestCards(data.requests);
            renderPagination(data.currentPage, data.totalPages); // Assuming backend provides these

        } catch (error) {
            loadingDiv.style.display = 'none';
            console.error('Error fetching request history:', error);
            showMessage(`Error loading requests: ${error.message}`, 'danger', false);
        }
    }

    // --- Rendering UI ---
    function renderRequestCards(requests) {
        requestListDiv.innerHTML = ''; // Clear just before rendering
        requests.forEach(req => {
            const colDiv = document.createElement('div');
            colDiv.className = 'col';

            const card = document.createElement('div');
            // Use card-body directly for click if whole card clickable
            card.className = 'card h-100'; // h-100 for equal height cards in a row
            card.setAttribute('data-bs-toggle', 'modal');
            card.setAttribute('data-bs-target', '#requestDetailModal');
            // Store all request info needed for the modal
            card.dataset.requestInfo = JSON.stringify(req);

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body d-flex flex-column'; // Flex column for structure

            // Top row: Title and Badge
            const topRow = document.createElement('div');
            topRow.className = 'd-flex justify-content-between align-items-start mb-2';

            const title = document.createElement('h6');
            title.className = 'card-title mb-0 me-2'; // Adjusted title size
            title.textContent = `Request #${req.id}: ${req.task_type || 'N/A'}`;

            const statusBadge = document.createElement('span');
            const statusClass = req.status ? req.status.replace(/_/g, '-').toLowerCase() : 'unknown';
            statusBadge.className = `badge rounded-pill status-badge status-${statusClass}`;
            statusBadge.textContent = req.status ? req.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';

            topRow.appendChild(title);
            topRow.appendChild(statusBadge);

            // Details (limited lines)
            const details = document.createElement('p');
            details.className = 'card-text text-muted mb-2 flex-grow-1'; // flex-grow to push footer down
            details.textContent = req.comments || 'No additional details provided.';

            // Footer info
            const footerDiv = document.createElement('div');
            footerDiv.className = 'mt-auto'; // Push to bottom

            const createdAt = document.createElement('small');
            createdAt.className = 'text-muted d-block';
            createdAt.textContent = `Created: ${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A'}`;
            footerDiv.appendChild(createdAt);

            // Add helper info only if matched/completed
            if ((req.status === 'matched' || req.status === 'completed') && req.helper_first_name) {
                 const helperInfo = document.createElement('small');
                 helperInfo.className = 'text-muted d-block fw-medium'; // Slightly bolder
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

    function renderPagination(currentPage, totalPages) {
        // (Keep existing pagination logic, ensure it uses Bootstrap 5 classes if necessary)
        paginationUl.innerHTML = '';
        if (totalPages <= 1) {
             document.getElementById('paginationContainer').style.display = 'none';
             return;
         };
         document.getElementById('paginationContainer').style.display = 'flex';

        const createPageItem = (page, text, isDisabled = false, isActive = false, isIcon = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const link = document.createElement('a');
            link.className = 'page-link';
            link.href = '#';
            if (isIcon) { link.innerHTML = text; link.setAttribute('aria-label', text.includes('left') ? 'Previous' : 'Next'); }
            else { link.textContent = text || page; }
            if (!isDisabled) { link.onclick = (e) => { e.preventDefault(); fetchHistory(page); }; }
            else { link.setAttribute('tabindex', '-1'); link.setAttribute('aria-disabled', 'true'); }
            li.appendChild(link);
            return li;
        };

        paginationUl.appendChild(createPageItem(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1, false, true));
        for (let i = 1; i <= totalPages; i++) { paginationUl.appendChild(createPageItem(i, null, false, i === currentPage)); }
        paginationUl.appendChild(createPageItem(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages, false, true));
    }

    // --- Modal Logic ---
    function setupEventListeners() {
        modalElement.addEventListener('show.bs.modal', (event) => {
            console.log("Modal show event triggered");
            const card = event.relatedTarget.closest('.card'); // Get the card that triggered the modal
            if (!card || !card.dataset.requestInfo) {
                console.error("Could not find request info on triggering element.");
                // Populate modal with error?
                modalRequestId.textContent = 'Error';
                modalComments.textContent = 'Could not load request details.';
                return;
            }

            try {
                currentRequestData = JSON.parse(card.dataset.requestInfo);
                console.log("Populating modal with data:", currentRequestData);
                populateModal(currentRequestData);
            } catch (e) {
                console.error("Error parsing request info:", e);
                modalRequestId.textContent = 'Error';
                modalComments.textContent = 'Could not load request details (parse error).';
            }
        });

         // Setup Navbar listeners (logout) - if not in common.js
         const logoutButton = document.getElementById('logoutButton');
         if (logoutButton) {
             logoutButton.addEventListener('click', handleLogout);
         }
    }

    function populateModal(req) {
        modalRequestId.textContent = req.id || 'N/A';
        modalTaskType.textContent = req.task_type || 'N/A';
        modalComments.textContent = req.comments || 'None provided.';
        modalCreatedAt.textContent = req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A';
        modalScheduledTime.textContent = req.scheduled_datetime ? new Date(req.scheduled_datetime).toLocaleString() : 'Not scheduled';
        modalLocation.textContent = req.location_address || 'Not specified';

        // Status Badge in Modal
        const statusClass = req.status ? req.status.replace(/_/g, '-').toLowerCase() : 'unknown';
        modalStatusBadge.className = `badge rounded-pill status-badge status-${statusClass}`; // Reset classes
        modalStatusBadge.textContent = req.status ? req.status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';

        // Helper Info
        if ((req.status === 'matched' || req.status === 'completed') && req.helper_first_name) {
            modalHelperInfo.textContent = `${req.helper_first_name} ${req.helper_last_name || ''}`;
            modalHelperInfo.classList.remove('text-muted');
        } else {
            modalHelperInfo.textContent = 'Not yet assigned';
             modalHelperInfo.classList.add('text-muted');
        }

        // Go to Chat Button Logic
        // **ASSUMPTION:** Backend's /api/requests/my-history now includes 'chat_id' when status is 'matched'
        if (req.status === 'matched' && req.chat_id) {
             modalGoToChatBtn.style.display = 'block'; // Show the button
             modalGoToChatBtn.onclick = () => {
                 window.location.href = `/chatView.html?chatId=${req.chat_id}`;
             };
        } else {
             modalGoToChatBtn.style.display = 'none'; // Hide the button
             modalGoToChatBtn.onclick = null; // Remove any previous handler
        }
    }

    // --- Utilities ---
    function showMessage(msg, type = 'info', autoHide = true) {
        // (Keep existing implementation)
         if (!msg) { messageDiv.style.display = 'none'; return; }
         messageTextSpan.textContent = msg;
         messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
         messageDiv.style.display = 'block';
         // Auto-hide logic using Bootstrap's Alert component
          if (autoHide) {
             setTimeout(() => {
                 const bsAlert = bootstrap.Alert.getOrCreateInstance(messageDiv);
                 if (bsAlert) bsAlert.close();
                 else messageDiv.style.display = 'none';
             }, 3500);
         }
    }

    // --- Navbar Setup (Essential for getting currentUserId) ---
     async function setupNavbar() {
         try {
             const response = await fetch('/api/users/me'); // Cookie automatically sent
             if (response.ok) {
                 const user = await response.json();
                 // currentUserId = user.id; // Not strictly needed on this page
                 const userNameElement = document.getElementById('navbarUsername');
                 if (userNameElement) {
                     userNameElement.textContent = user.first_name || user.email;
                 }
             } else if (response.status === 401 || response.status === 403) {
                 window.location.href = '/login';
             } else { console.error('Navbar user fetch error:', response.statusText); }
         } catch (error) { console.error('Navbar setup error:', error); }
     }
     async function handleLogout() {
         // (Keep existing implementation)
         try {
             const logoutResponse = await fetch('/api/auth/logout', { method: 'POST' });
             if (logoutResponse.ok) { window.location.href = '/login'; }
             else { showMessage('Logout failed.', 'warning', false); }
         } catch (err) { showMessage('Logout error.', 'danger', false); }
     }

    // --- Initialize Page ---
    initializePage();

});