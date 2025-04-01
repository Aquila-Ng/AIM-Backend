const form = document.getElementById('registrationForm');
const errorMessage = document.getElementById('errorMessage');
const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

function nextStep(step) {
    if (!validateStep(step)) return;
    document.getElementById('step' + step).style.display = 'none';
    document.getElementById('step' + (step + 1)).style.display = 'block';
}

function prevStep(step) {
    document.getElementById('step' + step).style.display = 'none';
    document.getElementById('step' + (step - 1)).style.display = 'block';
}

function validateStep(step) {
    let isValid = true;
    const elements = document.querySelectorAll(`#step${step} [required]`);

    elements.forEach(element => {
        element.classList.remove('is-invalid');
        if (!element.value) {
            element.classList.add('is-invalid');
            isValid = false;
        }
        if (element.id === 'email' && !element.value.match(emailRegex)) {
            element.classList.add('is-invalid');
            isValid = false;
        }
        if (element.id === 'password' && element.value.length < 8) {
            element.classList.add('is-invalid');
            isValid = false;
        }
    });
    return isValid;
}

form.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!validateStep(3)) return;

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        age: document.getElementById('age').value,
        sex: document.getElementById('sex').value,
        height: document.getElementById('height').value,
        weight: document.getElementById('weight').value,
        blindVision: document.querySelector('input[name="blindVision"]:checked').value,
        deafHearing: document.querySelector('input[name="deafHearing"]:checked').value,
        difficultyWalking: document.querySelector('input[name="difficultyWalking"]:checked').value,
    };

    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => {
                throw err;
            });
        }
        return res.json();
    })
    .then(data => {
        errorMessage.className = 'alert alert-success';
        errorMessage.innerHTML = 'Registration successful! Proceed to <a href="/login" class="alert-link">Login</a>';
        errorMessage.style.display = 'block';
    })
    .catch(err => {
        console.error('Registration error: ', err);
        errorMessage.textContent = err.message || 'An error occurred during registration';
        errorMessage.style.display = 'block';
    });
});