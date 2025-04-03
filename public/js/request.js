document.addEventListener('DOMContentLoaded', () => {
    const requestForm = document.getElementById('requestForm');
    const taskTypeSelect = document.getElementById('taskType');
    const commentsTextarea = document.getElementById('comments');
    // Add elements for displaying messages to the user (e.g., success/error)
    const errorMessage = document.getElementById('errorMessage'); // Assuming you add a <div id="message"></div>

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const taskType = taskTypeSelect.value;
        const comments = commentsTextarea.value.trim(); // Trim whitespace

        // Basic validation (optional but recommended)
        if (!taskType) {
            errorMessage.textContent = 'Please select a task type.';
            errorMessage.style.display = 'block';
            return;
        }

        const token = localStorage.getItem('jwToken'); // Assuming you store JWT here after login

        if (!token) {
            window.location.href = '/login';
            return;
        }

        try {
            const response = await fetch('/api/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'authorisation': `Bearer ${token}` // Send JWT token
                },
                body: JSON.stringify({
                    taskType: taskType,
                    comments: comments // Send empty string if no comments
                })
            });

            const result = await response.json();

            if (response.ok) {
                errorMessage.innerHTML = `Request submitted successfully (ID: ${result.requestId})! View matching status <a href='/matches'>here</a>.`;
                errorMessage.className = 'alert alert-success';
                errorMessage.style.display = 'block';
                // requestForm.reset(); // Clear the form
                // Optionally redirect after a delay or provide a link
                // setTimeout(() => window.location.href = '/home', 2000);
            } else {
                errorMessage.textContent = `Error: ${result.error || 'Failed to submit request.'}`;
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            errorMessage.textContent = 'An unexpected error occurred. Please try again.';
            errorMessage.style.display = 'block';
        }
    });
});