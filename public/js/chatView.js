document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatPartnerNameElement = document.getElementById('chatPartnerName');
    const chatTaskTypeElement = document.getElementById('chatTaskType');
    const messageAreaDiv = document.getElementById('messageArea');
    const messageLoadingDiv = document.getElementById('messageLoading');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const messageErrorDiv = document.getElementById('messageError');

    // --- State ---
    let currentUserId = null;
    let currentChatId = null;
    let currentChatPartnerName = 'Chat'; // Default
    let currentChatTaskType = '';


    // --- Initialization ---
    async function initializePage() {
        await setupNavbar(); // Get user ID, setup logout etc.

        // Get chatId from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const chatIdParam = urlParams.get('chatId');

        if (!chatIdParam || isNaN(parseInt(chatIdParam, 10))) {
            showError('Invalid or missing chat ID in URL.');
            disableInput();
            return;
        }

        currentChatId = parseInt(chatIdParam, 10);

        // Optionally fetch chat details (like partner name, task type) if not passed easily
        // For now, we'll try to get them from the referrer or placeholder
        // A better approach: have an API endpoint GET /api/chats/:chatId to get details + verify access
        // Let's assume partner name/task type might need fetching or use placeholders
        chatPartnerNameElement.textContent = 'Loading...'; // Placeholder
        chatTaskTypeElement.textContent = '';

        if (currentUserId && currentChatId) {
            await fetchMessages(currentChatId, 1); // Load initial messages
            enableInput();
            // Fetch chat details after messages load (or combine if API allows)
            await fetchChatDetails(currentChatId);
        } else {
             showError('Authentication failed or Chat ID missing.');
             disableInput();
        }
        setupEventListeners();
    }

    // --- Fetching Data ---
    async function fetchChatDetails(chatId) {
        // Placeholder: Ideally, fetch details from an API like GET /api/chats/:chatId
        // This API should return partner name, task type etc. AND verify user access
        console.warn("fetchChatDetails not fully implemented - using placeholder data or requires new API endpoint.");
        // For demo, let's try getting from referrer state if list page passed it (not reliable)
         try {
             // Attempt to fetch chat list data again to find details - INEFFICIENT
              const response = await fetch(`/api/chats?limit=100`); // Fetch many chats, hoping to find ours
              if (response.ok) {
                  const data = await response.json();
                  const chatInfo = data.chats.find(c => c.chat_id === chatId);
                  if (chatInfo) {
                       currentChatPartnerName = `${chatInfo.other_user_first_name || ''} ${chatInfo.other_user_last_name || ''}`.trim() || 'Chat Partner';
                       currentChatTaskType = chatInfo.task_type || '';
                       chatPartnerNameElement.textContent = currentChatPartnerName;
                       chatTaskTypeElement.textContent = `Task: ${currentChatTaskType}`;
                  } else {
                       chatPartnerNameElement.textContent = 'Chat Partner'; // Fallback
                  }
              } else { chatPartnerNameElement.textContent = 'Chat Partner'; } // Fallback
         } catch (e) { console.error("Error trying to fetch chat details:", e); chatPartnerNameElement.textContent = 'Chat Partner'; }
    }


    async function fetchMessages(chatId, page = 1) {
        messageLoadingDiv.style.display = 'block';
        if (page === 1) messageAreaDiv.innerHTML = ''; // Clear only on first page load

        try {
            const response = await fetch(`/api/chats/${chatId}/messages?page=${page}&limit=50`); // Load 50 messages
            messageLoadingDiv.style.display = 'none';

            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                    showError('Access denied or session expired. Redirecting...', true);
                    setTimeout(() => window.location.href = '/login', 2500);
                 } else {
                     throw new Error((await response.json()).error || 'Failed to fetch messages');
                 }
                 return;
            }

            const data = await response.json();
            renderMessages(data.messages);

        } catch (error) {
            messageLoadingDiv.style.display = 'none';
            console.error('Error fetching messages:', error);
            showError(`Error loading messages: ${error.message}`);
        }
    }

    // --- Rendering ---
    function renderMessages(messages) {
        messages.forEach(msg => {
            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'message-wrapper';

            const msgDiv = document.createElement('div');
            msgDiv.classList.add('message');
            const isSent = msg.sender_id === currentUserId;
            msgDiv.classList.add(isSent ? 'sent' : 'received');

            const senderSpan = document.createElement('span');
            senderSpan.className = 'message-sender';
            // Display partner's name for received, 'You' for sent
            senderSpan.textContent = isSent ? 'You' : (msg.sender_first_name || `User ${msg.sender_id}`);

            const contentP = document.createElement('p');
            // Basic sanitization (replace potential HTML tags - need more robust library for production)
            contentP.textContent = msg.content;
            contentP.className = 'mb-0';

            msgDiv.appendChild(senderSpan);
            msgDiv.appendChild(contentP);
            wrapperDiv.appendChild(msgDiv);
            messageAreaDiv.appendChild(wrapperDiv);
        });
        // Scroll to the bottom after rendering new messages
        scrollToBottom();
    }

    function scrollToBottom() {
        // A small delay can help ensure rendering is complete before scrolling
        setTimeout(() => {
             messageAreaDiv.scrollTop = messageAreaDiv.scrollHeight;
        }, 50);
    }

    // --- Sending Messages ---
    async function handleSendMessage(event) {
        event.preventDefault(); // Prevent form submission from reloading page
        const content = messageInput.value.trim();

        if (!content || !currentChatId) return;

        disableInput();
        showError(''); // Clear previous send errors

        try {
            // Cookie sent automatically
            const response = await fetch(`/api/chats/${currentChatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            });

             if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                     showError('Authentication error. Please log in again.', true);
                     setTimeout(() => window.location.href = '/login', 2500);
                 } else {
                     const result = await response.json();
                     throw new Error(result.error || `Failed to send message (${response.status})`);
                 }
             } else {
                 const newMessage = await response.json();
                 messageInput.value = ''; // Clear input on success
                 renderMessages([newMessage]); // Add the new message immediately
                 // If using polling or websockets, this render might be redundant
                 // Or just call fetchMessages again for simplicity for now:
                 // await fetchMessages(currentChatId);
             }

        } catch (error) {
            console.error("Error sending message:", error);
            showError(`Send failed: ${error.message}`, false); // Show send error
            alert('error');
        } finally {
            enableInput();
            messageInput.focus();
        }
    }

    // --- UI State & Utilities ---
    function disableInput() {
        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
    }

    function enableInput() {
        messageInput.disabled = false;
        sendMessageBtn.disabled = false;
    }

    function showError(msg, isFatal = false) {
         messageLoadingDiv.style.display = 'none'; // Hide loading if error occurs
         messageErrorDiv.textContent = msg;
         messageErrorDiv.style.display = msg ? 'block' : 'none';
         if(isFatal) {
              disableInput(); // Disable input on fatal errors (like auth)
         }
    }


    // --- Event Listeners ---
    function setupEventListeners() {
        messageForm.addEventListener('submit', handleSendMessage);
         // Logout button (if using common setup, this might be redundant)
         const logoutButton = document.getElementById('logoutButton');
         if (logoutButton) {
             logoutButton.addEventListener('click', async () => {
                 try {
                     const logoutResponse = await fetch('/api/auth/logout', { method: 'POST' });
                     if (logoutResponse.ok) { window.location.href = '/login'; }
                     else { showError('Logout failed.', false); }
                 } catch (err) { showError('Logout error.', false); }
             });
         }
    }

     // --- Navbar Setup (Essential for getting currentUserId) ---
    async function setupNavbar() {
         try {
             const response = await fetch('/api/users/me'); // Cookie automatically sent
             if (response.ok) {
                 const user = await response.json();
                 currentUserId = user.id; // Set current user ID
                 const userNameElement = document.getElementById('navbarUsername');
                 if (userNameElement) {
                    userNameElement.textContent = `${user.first_name || user.email}`;
                 }
             } else if (response.status === 401 || response.status === 403) {
                 window.location.href = '/login';
             } else {
                  console.error('Failed to fetch user info for navbar:', response.statusText);
                   showError('Could not load user details.', true); // Consider this fatal for chat page
             }
         } catch (error) {
             console.error('Error setting up navbar:', error);
             showError('Error loading page details.', true);
         }
     }


    // --- Initialize Page ---
    initializePage();

});