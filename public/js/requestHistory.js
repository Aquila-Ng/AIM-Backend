document.addEventListener('DOMContentLoaded', () => {
    const requestListDiv = document.getElementById('requestList');
    const paginationUl = document.getElementById('pagination');
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');

    async function fetchHistory(page = 1) {
        showMessage(''); // Clear previous messages
        requestListDiv.innerHTML = ''; // Clear previous list
        paginationUl.innerHTML = ''; // Clear previous pagination
        loadingDiv.style.display = 'block'; // Show loading indicator

        try {
            const response = await fetch(`/api/requests/my-history?page=${page}&limit=5`, { // Limit to 5 per page
                method: 'GET',
                // Removed the headers object as HTTP-only cookies are automatic
            });

            loadingDiv.style.display = 'none'; // Hide loading indicator

            if (!response.ok) {
                if (response.status === 401) {
                     showMessage('Authentication error. Please log in.', 'danger');
                } else {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Failed to fetch history');
                }
                return; // Stop processing on error
            }

            const data = await response.json();

            if (!data.requests || data.requests.length === 0) {
                showMessage('You have not created any requests yet.', 'info');
                return;
            }

            renderRequests(data.requests);
            renderPagination(data.currentPage, data.totalPages);

        } catch (error) {
            loadingDiv.style.display = 'none';
            console.error('Error fetching request history:', error);
            showMessage(`Error: ${error.message}`, 'danger');
        }
    }

    function renderRequests(requests) {
        requests.forEach(req => {
            const card = document.createElement('div');
            card.className = 'card';

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            const title = document.createElement('h5');
            title.className = 'card-title';
            title.textContent = `Request #${req.id}: ${req.task_type}`;

            const statusBadge = document.createElement('span');
            // Normalize status for CSS class (replace underscores, lowercase)
            const statusClass = req.status.replace('_', '-').toLowerCase();
            statusBadge.className = `badge status-badge status-${statusClass} float-right`;
            statusBadge.textContent = req.status.replace('_', ' ').toUpperCase(); // Display friendly status

            const createdAt = document.createElement('p');
            createdAt.className = 'card-text text-muted';
            createdAt.textContent = `Created: ${new Date(req.created_at).toLocaleString()}`;

            const details = document.createElement('p');
            details.className = 'card-text';
            details.textContent = req.comments ? `Details: ${req.comments}` : 'No additional details provided.';

             // Add schedule/location info if present
             let scheduleInfo = '';
             if (req.scheduled_datetime) {
                 scheduleInfo += `Scheduled: ${new Date(req.scheduled_datetime).toLocaleString()}`;
             }
             if (req.location_address) {
                 scheduleInfo += (scheduleInfo ? ' | ' : '') + `Location: ${req.location_address}`;
             }
              if (scheduleInfo) {
                 const schedulePara = document.createElement('p');
                 schedulePara.className = 'card-text text-info'; // Style differently
                 schedulePara.textContent = scheduleInfo;
                 cardBody.appendChild(schedulePara);
              }


            let helperInfo = '';
            if (req.status === 'matched' && req.helper_first_name) {
                helperInfo = `Matched with: ${req.helper_first_name} ${req.helper_last_name}`;
            } else if (req.status === 'completed' && req.helper_first_name) {
                 helperInfo = `Completed by: ${req.helper_first_name} ${req.helper_last_name}`;
            }

            if (helperInfo) {
                 const helperPara = document.createElement('p');
                 helperPara.className = 'card-text font-weight-bold';
                 helperPara.textContent = helperInfo;
                 cardBody.appendChild(helperPara);
                 // TODO: Add 'Go to Chat' button if status is 'matched'
                  if (req.status === 'matched') {
                     const chatButton = document.createElement('button');
                     chatButton.className = 'btn btn-success btn-sm mt-2';
                     chatButton.textContent = 'Go to Chat';
                     chatButton.onclick = () => { /* Implement chat navigation */ window.alert('Chat feature not implemented yet.'); };
                     cardBody.appendChild(chatButton);
                  }
            }


            cardBody.appendChild(title);
             cardBody.appendChild(statusBadge); // Add badge here
            cardBody.appendChild(createdAt);
            cardBody.appendChild(details);
            // Append helper info if exists
            // Append schedule info if exists

            card.appendChild(cardBody);
            requestListDiv.appendChild(card);
        });
    }

    function renderPagination(currentPage, totalPages) {
        if (totalPages <= 1) return; // No need for pagination

        // Previous Button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.textContent = 'Previous';
        prevLink.onclick = (e) => { e.preventDefault(); if (currentPage > 1) fetchHistory(currentPage - 1); };
        prevLi.appendChild(prevLink);
        paginationUl.appendChild(prevLi);

        // Page Number Buttons (simplified example)
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            const pageLink = document.createElement('a');
            pageLink.className = 'page-link';
            pageLink.href = '#';
            pageLink.textContent = i;
            pageLink.onclick = (e) => { e.preventDefault(); fetchHistory(i); };
            pageLi.appendChild(pageLink);
            paginationUl.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.textContent = 'Next';
        nextLink.onclick = (e) => { e.preventDefault(); if (currentPage < totalPages) fetchHistory(currentPage + 1); };
        nextLi.appendChild(nextLink);
        paginationUl.appendChild(nextLi);
    }


    function showMessage(msg, type = 'info') {
        messageDiv.textContent = msg;
        messageDiv.className = `alert alert-${type} mt-3`;
        messageDiv.style.display = msg ? 'block' : 'none';
    }

    // Initial fetch
    fetchHistory(1);
});