document.addEventListener('DOMContentLoaded', () => {

    const messageDiv = document.getElementById('message');
    const messageTextSpan = document.getElementById('messageText');
    
    let currentUserId = null;

    async function initializePage() {
        await setupNavbar();
        if (!currentUserId){
            showMessage('Error Getting User Details', 'Danger', false);
        }
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

    initializePage();
})

// Logout functionality
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