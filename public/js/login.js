const form = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const email = document.getElementById('email');
const password = document.getElementById('password');

const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

form.addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent default form submission
    let isValid = true;

    // Reset invalid states
    [email, password].forEach(input => input.classList.remove('is-invalid'));

    // Email validation
    if (!email.value.match(emailRegex)) {
        email.classList.add('is-invalid');
        email.nextElementSibling.textContent = "Invalid email";
        isValid = false;
    }

    // Password validation
    if (password.value.length < 8) {
        password.classList.add('is-invalid');
        password.nextElementSibling.textContent = "Password must be at least 8 characters long.";
        isValid = false;
    }

    if (!isValid) return;

    // Send login request
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email.value,
            password: password.value
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => {
                throw new Error(err.error || 'Login failed'); // Use `error` key instead of `message`
            });
        }
        return res.json();
    })
    .then(data => {
        const token = data.token;
        localStorage.setItem('jwToken', token);

        window.location.href = '/home';
    })
    .catch(err => {
        console.error('Login error:', err);
        errorMessage.textContent = err.message; 
        errorMessage.style.display = 'block';
    });
});