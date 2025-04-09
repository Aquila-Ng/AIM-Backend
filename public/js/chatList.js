document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatListDiv = document.getElementById('chatList');
    const chatListPaginationUl = document.getElementById('chatListPagination');
    const messageDiv = document.getElementById('message');
    const messageTextSpan = document.getElementById('messageText');
    const loadingDiv = document.getElementById('chatListLoading');

    // --- State ---
    let currentUserId = null;

    // --- Initialization ---
    async function initializePage() {
        await setupNavbar(); // Setup navbar user display and logout
        if (currentUserId) {
            await fetchChats(1); // Fetch first page of chats
        } else {
            // Navbar setup should handle redirect if auth fails
             loadingDiv.textContent = 'Authentication error.';
             loadingDiv.style.display = 'block';
        }
    }

    // --- Fetching and Rendering ---
    async function fetchChats(page = 1) {
        showMessage(''); // Clear previous messages
        loadingDiv.style.display = 'block';
        chatListDiv.innerHTML = ''; // Clear list while loading
        chatListPaginationUl.innerHTML = '';

        try {
            // Cookie sent automatically
            const response = await fetch(`/api/chats?page=${page}&limit=15`);
            loadingDiv.style.display = 'none';

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    showMessage('Your session has expired or you are not authorized. Redirecting...', 'warning', false);
                    setTimeout(() => window.location.href = '/login', 2500);
                } else {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Failed to fetch chats');
                }
                return;
            }

            const data = await response.json();

            if (!data.chats || data.chats.length === 0) {
                chatListDiv.innerHTML = '<p class="text-center text-muted mt-4">No chats found.</p>';
                return;
            }

            renderChatList(data.chats);
            renderChatListPagination(data.currentPage, data.totalPages);

        } catch (error) {
            loadingDiv.style.display = 'none';
            console.error('Error fetching chats:', error);
            showMessage(`Error loading chats: ${error.message}`, 'danger', false);
        }
    }

    function renderChatList(chats) {
        chatListDiv.innerHTML = ''; // Clear just before rendering
        chats.forEach(chat => {
            const chatLink = document.createElement('a');
            chatLink.href = `/chatView.html?chatId=${chat.chat_id}`; // Link to chat view page
            chatLink.className = 'list-group-item list-group-item-action flex-column align-items-start';
            chatLink.setAttribute('aria-current', 'true'); // Indicate it's a link within the list context

            const partnerName = `${chat.other_user_first_name || ''} ${chat.other_user_last_name || ''}`.trim() || 'Unknown User';
            const taskType = chat.task_type || 'Request';
            const lastMessagePreview = chat.last_message_preview || 'No messages yet.';
            const lastMessageTime = chat.last_message_time ? formatRelativeTime(chat.last_message_time) : '';

            chatLink.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 text-primary">${partnerName}</h6>
                    <small class="text-muted">${lastMessageTime}</small>
                </div>
                <p class="mb-1 chat-preview text-truncate">${lastMessagePreview}</p>
                <small class="text-muted">Related Task: ${taskType}</small>
            `;

            chatListDiv.appendChild(chatLink);
        });
    }

    function renderChatListPagination(currentPage, totalPages) {
        chatListPaginationUl.innerHTML = ''; // Clear existing
        if (totalPages <= 1) {
             document.getElementById('paginationContainer').style.display = 'none'; // Hide nav if only one page
             return;
         };
         document.getElementById('paginationContainer').style.display = 'flex'; // Ensure visible otherwise

        const createPageItem = (page, text, isDisabled = false, isActive = false, isIcon = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const link = document.createElement('a');
            link.className = 'page-link';
            link.href = '#';
            if (isIcon) {
                 link.innerHTML = text; // Use innerHTML for icons
                 link.setAttribute('aria-label', page === currentPage - 1 ? 'Previous' : 'Next');
            } else {
                 link.textContent = text || page;
            }

            if (!isDisabled) {
                link.onclick = (e) => { e.preventDefault(); fetchChats(page); };
            } else {
                 link.setAttribute('tabindex', '-1');
                 link.setAttribute('aria-disabled', 'true');
            }
            li.appendChild(link);
            return li;
        };

        // Previous Button (using icon)
        chatListPaginationUl.appendChild(createPageItem(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1, false, true));

        // Simplified page numbers (add more complex logic for many pages if needed)
        for (let i = 1; i <= totalPages; i++) {
            chatListPaginationUl.appendChild(createPageItem(i, null, false, i === currentPage));
        }

        // Next Button (using icon)
        chatListPaginationUl.appendChild(createPageItem(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages, false, true));
    }


    // --- Utilities ---
    function showMessage(msg, type = 'info', autoHide = true) {
        if (!msg) {
            messageDiv.style.display = 'none';
            return;
        }
        messageTextSpan.textContent = msg;
        // Remove previous alert types, add new one
        messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
        messageDiv.style.display = 'block';

        if (autoHide && (type === 'success' || type === 'info')) {
            setTimeout(() => {
                // Use Bootstrap's dismiss method if available, or just hide
                 const bsAlert = bootstrap.Alert.getOrCreateInstance(messageDiv);
                 if (bsAlert) {
                     bsAlert.close();
                 } else {
                     messageDiv.style.display = 'none';
                 }
            }, 3500);
        }
    }

    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffSeconds < 60) return `now`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return `Yesterday`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(); // Older than a week
    }

    // --- Navbar Setup (Essential for getting currentUserId) ---
    async function setupNavbar() {
         try {
             const response = await fetch('/api/users/me'); // Cookie automatically sent
             if (response.ok) {
                 const user = await response.json();
                 currentUserId = user.id; // Crucial: Set current user ID
                 const userNameElement = document.getElementById('navbarUsername');
                 if (userNameElement) {
                     userNameElement.textContent = user.first_name || user.email;
                 }
             } else if (response.status === 401 || response.status === 403) {
                 // Redirect to login if not authenticated
                 window.location.href = '/login';
                 return; // Stop further execution
             } else {
                  console.error('Failed to fetch user info for navbar:', response.statusText);
                  showMessage('Could not load user details.', 'warning', false);
             }
         } catch (error) {
             console.error('Error setting up navbar:', error);
             showMessage('Error loading page details.', 'danger', false);
              // Consider redirecting to login on network errors too
               // window.location.href = '/login';
         }
     }

    // --- Initialize Page ---
    initializePage();

});