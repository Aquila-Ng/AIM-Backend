const form = document.getElementById('registerForm');
const errorMessage = document.getElementById('errorMessage')
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');


// Regular expression for email validation (basic pattern)
const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

form.addEventListener('submit', function(event) {
    let isValid = true;

    // Reset all invalid states
    [email, password, confirmPassword].forEach(input => {
        input.classList.remove('is-invalid');
    });

    // Email Validation: Check if the email matches the regex format
    if (!email.value.match(emailRegex)) {
        email.classList.add('is-invalid');
        email.nextElementSibling.textContent = "Please provide a valid email address.";
        isValid = false;
    }

    // Password Validation: Check if the password is greater than 8 characters
    if (password.value.length < 8) {
        password.classList.add('is-invalid');
        password.nextElementSibling.textContent = "Password must be at least 8 characters long.";
        isValid = false;
    }

    // Confirm Password Validation: Check if the passwords match
    if (password.value !== confirmPassword.value) {
        confirmPassword.classList.add('is-invalid');
        confirmPassword.nextElementSibling.textContent = "Passwords do not match.";
        isValid = false;
    }

    // If form is invalid, prevent submission
    if (!isValid) {
        event.preventDefault();
    }
    else{
        fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify({
                email: email.value,
                password: password.value
            })
        })
        .then (res => {
            if (!res.ok){
                return res.json().then(err => {
                    throw err;
                })
            }
            return res.json();
        })
        .then (data => {
            // Handle successful registration
            errorMessage.className = 'alert alert-success';
            errorMessage.textContent = 'Registration successful!';
            errorMessage.style.display = 'block';
        })
        .catch (err => {
            // Handle errors from server
            console.error('Registration error: ', err);
            errorMessage.textContent = err.message || 'An error occurred during registration';
            errorMessage.style.display = 'block';
        });
    }
});