document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jwToken');

    if (!token) {
        window.location.href = '/login';
        return;
    }
});

// Logout functionality
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('jwToken');
    window.location.href = '/';
});