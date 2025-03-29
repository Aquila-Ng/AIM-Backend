document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const token = localStorage.getItem('jwToken');
    
    if (!token) {
        window.location.href = '/';
        return;
    }

    fetch('/api/protected', {
        headers: {
            'authorisation': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok){
            throw new Error('Unauthorized');
        }
        return res.json();
    })
    .then(data => {
        const message = data.message
        
    })
    .catch(err => {
        console.error('Error:', err);
        window.location.href = '/'
    })
})