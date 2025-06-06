document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.getElementById('message');

    function showMessage(msg, type = 'error') {
        messageDiv.textContent = msg;
        messageDiv.className = `message-area ${type}`;
        messageDiv.style.display = 'block';
    }

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Login successful, store the access token
                localStorage.setItem('access_token', data.access_token);
                showMessage('Login successful! Redirecting...', 'success');
                // Redirect to the dashboard
                window.location.href = '/dashboard';
            } else {
                // Login failed, display error message
                showMessage(data.msg || 'Login failed.');
            }
        } catch (error) {
            console.error('Network error during login:', error);
            showMessage('Network error. Please try again.');
        }
    });
});