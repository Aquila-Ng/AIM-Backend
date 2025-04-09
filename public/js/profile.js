document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const profileForm = document.getElementById('profileForm');
    const emailInput = document.getElementById('email');
    // const firstNameInput = document.getElementById('firstName');
    // const lastNameInput = document.getElementById('lastName');
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const profileIconContainer = document.getElementById('profileIconContainer');
    const profileNameElement = document.getElementById('profileName');
    const profileAgeElement = document.getElementById('profileAge');
    const messageDiv = document.getElementById('message');
    const updateButton = document.getElementById('updateButton');
    // Radio button groups
    const blindVisionRadios = document.querySelectorAll('input[name="blindVisionDifficulty"]');
    const deafHearingRadios = document.querySelectorAll('input[name="deafHearingDifficulty"]');
    const difficultyWalkingRadios = document.querySelectorAll('input[name="difficultyWalking"]');

    let currentUserData = null; // Store fetched user data

    // --- Initial Load ---
    async function loadUserProfile() {
        showMessage('Loading profile...', 'info', false);
        try {
            // Cookie sent automatically
            const response = await fetch('/api/users/me');
            if (response.ok) {
                currentUserData = await response.json();
                populateProfileData(currentUserData);
                showMessage(''); // Clear loading message
            } else if (response.status === 401 || response.status === 403) {
                window.location.href = '/login'; // Redirect if not authenticated
            } else {
                throw new Error(`Failed to load profile (${response.status})`);
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            showMessage(`Error: ${error.message}`, 'danger', false);
        }
    }

    function populateProfileData(user) {
        if (!user) return;

        // Display non-editable fields
        profileNameElement.textContent = `${user.first_name || ''} ${user.last_name || ''}`;
        profileAgeElement.textContent = user.age ? `Age: ${user.age}` : 'Age: N/A';

        // Set profile icon based on sex
        const icon = document.createElement('i');
        icon.classList.add('fas', 'profile-icon');
        if (user.sex === 'Male') {
            icon.classList.add('fa-male', 'male');
        } else if (user.sex === 'Female') {
            icon.classList.add('fa-female', 'female');
        } else {
            icon.classList.add('fa-user-circle'); // Default
        }
        profileIconContainer.innerHTML = ''; // Clear previous
        profileIconContainer.appendChild(icon);

        // Populate editable fields
        emailInput.value = user.email || '';
        heightInput.value = user.height || '';
        weightInput.value = user.weight || '';

        // Set radio buttons
        setRadioButtonValue(blindVisionRadios, user.blind_vision_difficulty);
        setRadioButtonValue(deafHearingRadios, user.deaf_hearing_difficulty);
        setRadioButtonValue(difficultyWalkingRadios, user.difficulty_walking);

        // Reset validation state on load
         profileForm.classList.remove('was-validated');
    }

    function setRadioButtonValue(radioNodeList, value) {
        // value is expected to be true or false from the backend
        const valueToSelect = String(value); // Convert boolean to string "true" or "false"
        radioNodeList.forEach(radio => {
            if (radio.value === valueToSelect) {
                radio.checked = true;
            } else {
                 radio.checked = false; // Explicitly uncheck others
            }
        });
    }

    function getRadioButtonValue(radioNodeList) {
        let selectedValue = null;
        radioNodeList.forEach(radio => {
            if (radio.checked) {
                selectedValue = radio.value;
            }
        });
        // Convert string "true"/"false" back to boolean, handle null
        if (selectedValue === 'true') return true;
        if (selectedValue === 'false') return false;
        return null; // Return null if nothing selected (shouldn't happen with 'required')
    }


    // --- Form Submission and Update Logic ---
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation(); // Stop default browser validation UI if using Bootstrap's

        // --- Client-side Validation ---
        let isValid = true;
        profileForm.classList.add('was-validated'); // Trigger Bootstrap styles

        // Simple check for radio buttons (Bootstrap validation is weak here)
         if (getRadioButtonValue(blindVisionRadios) === null) {
             // Manually add error indication if needed, e.g., style the label
             console.error("Vision difficulty selection missing");
             isValid = false;
         }
        if (getRadioButtonValue(deafHearingRadios) === null) {
             console.error("Hearing difficulty selection missing");
             isValid = false;
         }
         if (getRadioButtonValue(difficultyWalkingRadios) === null) {
             console.error("Walking difficulty selection missing");
              isValid = false;
         }
        // Check other fields using standard form validation API
        if (!profileForm.checkValidity()) {
            isValid = false;
        }

        if (!isValid) {
             showMessage('Please correct the errors in the form.', 'warning', false);
            return; // Stop submission if invalid
        }

        // --- Gather Data for Update ---
        const updatedData = {
            email: emailInput.value.trim(),
            height: parseFloat(heightInput.value) || null, // Store as number or null
            weight: parseFloat(weightInput.value) || null,
            blind_vision_difficulty: getRadioButtonValue(blindVisionRadios),
            deaf_hearing_difficulty: getRadioButtonValue(deafHearingRadios),
            difficulty_walking: getRadioButtonValue(difficultyWalkingRadios),
        };

        // Remove nulls if not intended (or let backend handle nulls if needed)
        if (updatedData.height === null) delete updatedData.height;
        if (updatedData.weight === null) delete updatedData.weight;


        // --- Send Update Request ---
        showMessage('Updating profile...', 'info', false);
        updateButton.disabled = true;

        try {
            // Cookie sent automatically
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            const result = await response.json(); // Attempt to parse JSON always

            if (response.ok) {
                showMessage('Profile updated successfully!', 'success', true); // Auto-hide success
                currentUserData = result.user; // Update local data store
                populateProfileData(currentUserData); // Re-populate form with updated data
                profileForm.classList.remove('was-validated'); // Reset validation state
            } else {
                if (response.status === 401 || response.status === 403) {
                    window.location.href = '/login'; // Auth error
                } else {
                    // Display specific error from backend if available
                    throw new Error(result.error || `Update failed (${response.status})`);
                }
            }

        } catch (error) {
            console.error("Error updating profile:", error);
            showMessage(`Error: ${error.message}`, 'danger', false); // Show persistent error
        } finally {
            updateButton.disabled = false; // Re-enable button
        }
    });

    // --- Utility Functions ---
    function showMessage(msg, type = 'info', autoHide = true) {
        messageDiv.innerHTML = msg; // Use innerHTML if you might include simple HTML
        messageDiv.className = `alert alert-${type}`; // Clear previous classes
        messageDiv.style.display = msg ? 'block' : 'none';

        if (autoHide && (type === 'success' || type === 'info')) {
            setTimeout(() => {
                // Check if the message is still the same one we set
                if (messageDiv.innerHTML === msg) {
                    messageDiv.style.display = 'none';
                }
            }, 3000);
        }
    }

     // --- Navbar User/Logout (Example - reuse or move to common.js) ---
     async function setupNavbar() {
         try {
             const response = await fetch('/api/users/me');
             if (response.ok) {
                 const user = await response.json();
                 const userNameElement = document.getElementById('userDropdown');
                 if (userNameElement) {
                     userNameElement.innerHTML = `<i class="fas fa-user-circle"></i> ${user.first_name || user.email}`;
                 }
             } else if (response.status === 401 || response.status === 403) {
                 // Should be caught by protectPage, but safety check
                 window.location.href = '/login';
             }
         } catch (error) { console.error('Navbar user fetch error:', error); }

         const logoutButton = document.getElementById('logoutButton');
         if (logoutButton) {
             logoutButton.addEventListener('click', async () => {
                 try {
                     const logoutResponse = await fetch('/api/auth/logout', { method: 'POST' });
                     if (logoutResponse.ok) { window.location.href = '/login'; }
                     else { alert('Logout failed.'); }
                 } catch (err) { alert('Logout error.'); }
             });
         }
     }


    // --- Initialize ---
    loadUserProfile();
    setupNavbar(); // Setup navbar user display and logout

});

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