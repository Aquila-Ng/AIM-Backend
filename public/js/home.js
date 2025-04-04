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