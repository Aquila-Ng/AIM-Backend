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
            messageDiv.textContent = 'Please select a task type.';
            messageDiv.style.color = 'red';
            return;
        }

        const token = localStorage.getItem('jwToken'); // Assuming you store JWT here after login

        if (!token) {
            window.location.href = '/login';
            return;
        }

        try {
            const response = await fetch('/api/requests', {
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
                messageDiv.textContent = `Request submitted successfully (ID: ${result.requestId})! Matching is in progress.`;
                messageDiv.style.color = 'green';
                requestForm.reset(); // Clear the form
                // Optionally redirect after a delay or provide a link
                // setTimeout(() => window.location.href = '/home', 2000);
            } else {
                messageDiv.textContent = `Error: ${result.error || 'Failed to submit request.'}`;
                messageDiv.style.color = 'red';
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            messageDiv.textContent = 'An unexpected error occurred. Please try again.';
            messageDiv.style.color = 'red';
        }
    });
});