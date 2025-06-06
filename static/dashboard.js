document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const patientForm = document.getElementById('patientForm');
    const patientIdInput = document.getElementById('patientId');
    const patientNameInput = document.getElementById('patientName');
    const patientAgeInput = document.getElementById('patientAge');
    const patientGenderInput = document.getElementById('patientGender');
    const patientDepartmentInput = document.getElementById('patientDepartment');
    const patientPhoneInput = document.getElementById('patientPhone');
    const patientEmailInput = document.getElementById('patientEmail');
    const patientPrescriptionsInput = document.getElementById('patientPrescriptions');
    const patientMedicalHistoryInput = document.getElementById('patientMedicalHistory');
    const patientListBody = document.querySelector('#patientList tbody');
    const savePatientButton = document.getElementById('savePatientButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const formTitle = document.getElementById('formTitle');
    const logoutButton = document.getElementById('logoutButton');
    const searchPatientInput = document.getElementById('searchPatient'); // Search input
    const searchButton = document.getElementById('searchButton'); // New search button

    // Error message elements for form fields
    const patientNameError = document.getElementById('patientNameError');
    const patientAgeError = document.getElementById('patientAgeError');
    const patientGenderError = document.getElementById('patientGenderError');
    const patientDepartmentError = document.getElementById('patientDepartmentError');
    const patientPhoneError = document.getElementById('patientPhoneError');
    const patientEmailError = document.getElementById('patientEmailError');


    // New UI Elements
    const messageDiv = document.getElementById('message');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // --- Chart Instances ---
    let genderChartInstance = null;
    let departmentChartInstance = null;
    let visitorsChartInstance = null;

    // --- Global Variable to store all patients ---
    let allPatients = []; // To store all fetched patients for client-side search

    // --- Helper Functions ---
    function showMessage(msg, type = 'success') {
        console.log(`[showMessage] Displaying message: "${msg}" of type: "${type}"`); // DIAGNOSTIC LOG
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`; // Add class for styling
        messageDiv.style.display = 'block'; // Show the message
        // Re-apply animation or clear previous one if needed
        messageDiv.style.animation = 'none'; // Reset animation
        void messageDiv.offsetWidth; // Trigger reflow to restart animation
        messageDiv.style.animation = 'fadeInOut 5s forwards'; // Apply animation
    }

    // Function to display individual field errors
    function showFieldError(inputElement, errorElement, message) {
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        if (inputElement) {
            inputElement.classList.add('invalid-field'); // Add class to input
        }
    }

    // Function to clear a single field error
    function clearFieldError(inputElement, errorElement) {
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        if (inputElement) {
            inputElement.classList.remove('invalid-field');
        }
    }

    // Function to clear all field errors
    function clearAllFieldErrors() {
        clearFieldError(patientNameInput, patientNameError);
        clearFieldError(patientAgeInput, patientAgeError);
        clearFieldError(patientGenderInput, patientGenderError);
        clearFieldError(patientDepartmentInput, patientDepartmentError);
        clearFieldError(patientPhoneInput, patientPhoneError);
        clearFieldError(patientEmailInput, patientEmailError);
    }

    // --- REMOVED: attachPatientButtonListeners() function ---
    // It's no longer needed because we're using event delegation on patientListBody.

    function showLoadingSpinner() {
        loadingSpinner.style.display = 'block';
    }

    function hideLoadingSpinner() {
        loadingSpinner.style.display = 'none';
    }

    // --- Validation Logic for individual fields ---
    function validatePatientName() {
        const name = patientNameInput.value.trim();
        if (!name) {
            showFieldError(patientNameInput, patientNameError, 'Name is required.');
            return false;
        } else if (/\d/.test(name)) { // Check if name contains any digits
            showFieldError(patientNameInput, patientNameError, 'Name cannot contain numbers.');
            return false;
        }
        else {
            clearFieldError(patientNameInput, patientNameError);
            return true;
        }
    }

    function validatePatientAge() {
        const age = parseInt(patientAgeInput.value);
        if (isNaN(age) || age <= 0) {
            showFieldError(patientAgeInput, patientAgeError, 'Age must be a positive number.');
            return false;
        } else if (age > 120) { // Age cannot exceed 120 years
            showFieldError(patientAgeInput, patientAgeError, 'Age cannot exceed 120 years.');
            return false;
        }
        else {
            clearFieldError(patientAgeInput, patientAgeError);
            return true;
        }
    }

    function validatePatientGender() {
        const gender = patientGenderInput.value;
        if (!gender) {
            showFieldError(patientGenderInput, patientGenderError, 'Gender is required.');
            return false;
        } else {
            clearFieldError(patientGenderInput, patientGenderError);
            return true;
        }
    }

    function validatePatientDepartment() {
        const department = patientDepartmentInput.value.trim();
        if (!department) {
            showFieldError(patientDepartmentInput, patientDepartmentError, 'Department is required.');
            return false;
        } else {
            clearFieldError(patientDepartmentInput, patientDepartmentError);
            return true;
        }
    }

    function validatePatientPhone() {
        const phone = patientPhoneInput.value.trim();
        if (phone && !/^\d{10,}$/.test(phone)) {
            showFieldError(patientPhoneInput, patientPhoneError, 'Please enter a valid 10-digit phone number.');
            return false;
        } else {
            clearFieldError(patientPhoneInput, patientPhoneError);
            return true;
        }
    }

    function validatePatientEmail() {
        const email = patientEmailInput.value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError(patientEmailInput, patientEmailError, 'Please enter a valid email address.');
            return false;
        } else {
            clearFieldError(patientEmailInput, patientEmailError);
            return true;
        }
    }


    // --- API Interaction Functions ---
    async function fetchData(url, options = {}) {
        showLoadingSpinner(); // Show spinner before fetch
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                // If no token, redirect to login page
                window.location.href = '/';
                return; // Prevent further execution
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // THIS IS THE CRUCIAL LINE
            };

            const response = await fetch(url, { ...options, headers });
            hideLoadingSpinner(); // Hide spinner after response

            // --- NEW DIAGNOSTIC LOGS FOR FETCH RESPONSE ---
            console.log(`[fetchData] URL: ${url}, Method: ${options.method || 'GET'}`);
            console.log(`[fetchData] Response Status: ${response.status}`);

            if (response.status === 401 || response.status === 403) {
                showMessage('Session expired or unauthorized. Please log in again.', 'error');
                setTimeout(() => {
                    window.location.href = '/'; // Redirect to login after a delay
                }, 2000);
                return; // Prevent further execution
            }

            if (!response.ok) { // This means status is 4xx or 5xx
                const errorData = await response.json();
                console.error(`[fetchData] HTTP Error! Status: ${response.status}, Error Data:`, errorData); // NEW LOG
                throw new Error(errorData.msg || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json(); // If response.ok is true, parse JSON
            console.log(`[fetchData] Success! Status: ${response.status}, Data:`, data); // NEW LOG
            return data;
        } catch (error) {
            hideLoadingSpinner(); // Hide spinner on error too
            console.error("Fetch error caught in fetchData:", error); // Clarified log
            showMessage(`Error: ${error.message}`, 'error');
            throw error; // Re-throw to propagate error to specific handlers
        }
    }

    // --- Patient CRUD Operations ---

    async function loadPatients() {
        try {
            const patients = await fetchData('/patients');
            if (!patients) return; // Exit if fetch failed (e.g., due to redirect)

            allPatients = patients; // Store all fetched patients

            // On load, if search bar is empty, show prompt. Otherwise, run filter.
            if (searchPatientInput.value.trim() === '') {
                 patientListBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Start typing in the search bar and click Search to find patients.</td></tr>';
            } else {
                filterPatients(); // If there's text in search bar on load, filter immediately
            }


        } catch (error) {
            console.error('Failed to load patients:', error);
            showMessage('Failed to load patients. Check console for details.', 'error');
        }
    }

    // Function to filter and display patients based on search input
    function filterPatients() {
        const searchTerm = searchPatientInput.value.trim().toLowerCase();
        patientListBody.innerHTML = ''; // Clear existing list

        if (searchTerm === '') {
            patientListBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Start typing in the search bar and click Search to find patients.</td></tr>';
            return;
        }

        const filtered = allPatients.filter(patient =>
            patient.name.toLowerCase().includes(searchTerm) ||
            (patient.patient_id && patient.patient_id.toLowerCase().includes(searchTerm)) // Check patient_id exists
        );

        if (filtered.length === 0) {
            patientListBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No patients found matching your search.</td></tr>';
            return;
        }

        filtered.forEach(patient => {
            const row = patientListBody.insertRow();
            row.dataset.id = patient._id; // Store MongoDB _id for easy access

            // Handle nested contact_info and array fields gracefully
            const contactInfo = patient.contact_info || {};
            const currentPrescriptions = (patient.current_prescriptions && Array.isArray(patient.current_prescriptions)) ? patient.current_prescriptions.join(', ') : 'N/A';
            const medicalHistory = (patient.medical_history && Array.isArray(patient.medical_history)) ? patient.medical_history.join(', ') : 'N/A';

            row.innerHTML = `
                <td>${patient.patient_id || 'N/A'}</td>
                <td>${patient.name || 'N/A'}</td>
                <td>${patient.age || 'N/A'}</td>
                <td>${patient.gender || 'N/A'}</td>
                <td>${patient.department || 'N/A'}</td>
                <td>Phone: ${contactInfo.phone || 'N/A'}<br>Email: ${contactInfo.email || 'N/A'}</td>
                <td>${currentPrescriptions}</td>
                <td>${medicalHistory}</td>
                <td>
                    <button class="edit-btn" data-id="${patient._id}">Edit</button>
                    <button class="delete-btn danger" data-id="${patient._id}">Delete</button>
                </td>
            `;
        });
        // Removed: attachPatientButtonListeners(); // No longer needed
    }


    async function handlePatientFormSubmit(event) {
        event.preventDefault();
        clearAllFieldErrors();

        // --- DIAGNOSTIC LOGS ---
        console.log('--- Submitting Patient Form ---');
        console.log('1. Current patientIdInput.value at start of submit:', patientIdInput.value);

        // ... (validation logic) ...

        const patientId = patientIdInput.value; // _id if editing, empty if adding
        const name = patientNameInput.value.trim();
        const age = parseInt(patientAgeInput.value);
        const gender = patientGenderInput.value;
        const department = patientDepartmentInput.value.trim();
        const phone = patientPhoneInput.value.trim();
        const email = patientEmailInput.value.trim();
        const prescriptions = patientPrescriptionsInput.value.split(',').map(s => s.trim()).filter(s => s); // Split and clean
        const medicalHistory = patientMedicalHistoryInput.value.split(',').map(s => s.trim()).filter(s => s); // Split and clean


        const patientData = {
            name,
            age,
            gender,
            department,
            contact_info: { phone, email },
            current_prescriptions: prescriptions,
            medical_history: medicalHistory
        };

        try {
            if (patientId) { // If patientId exists, it's an update
                console.log('2. Detected patientId:', patientId, '. Attempting to UPDATE patient.');
                await fetchData(`/patients/${patientId}`, {
                    method: 'PUT',
                    body: JSON.stringify(patientData)
                });
                console.log('3. API call for UPDATE successful. Preparing "Patient updated successfully!" message.');
                showMessage('Patient updated successfully!', 'success'); // Correct message for update
            } else { // Otherwise, it's a new patient
                console.log('2. No patientId. Attempting to ADD new patient.');
                await fetchData('/patients', {
                    method: 'POST',
                    body: JSON.stringify(patientData)
                });
                console.log('3. API call for ADD successful. Preparing "Patient added successfully!" message.');
                showMessage('Patient added successfully!', 'success'); // Correct message for add
            }
            patientForm.reset(); // Clear form
            resetFormForAdd(); // Reset form state
            loadPatients(); // Reload allPatients data and re-evaluate search display
            loadAllCharts(); // Reload charts as data might have changed
        } catch (error) {
            console.error('Failed to save patient:', error);
            console.log('4. Showing error message:', `Failed to save patient: ${error.message}`);
            showMessage(`Failed to save patient: ${error.message}`, 'error');
        }
    }

    async function deletePatient(id) {
        // The confirm dialog now only appears once due to single event listener
        if (confirm('Are you sure you want to delete this patient?')) {
            try {
                console.log('Attempting to DELETE patient with ID:', id); // DIAGNOSTIC LOG
                await fetchData(`/patients/${id}`, {
                    method: 'DELETE'
                });
                console.log('API call for DELETE successful (from deletePatient perspective). Preparing "Patient deleted successfully!" message.'); // DIAGNOSTIC LOG
                showMessage('Patient deleted successfully!', 'success'); // THIS IS THE LINE FOR THE MESSAGE
                loadPatients(); // Reload allPatients data and re-evaluate search display
                loadAllCharts(); // Reload charts
            } catch (error) {
                console.error('Failed to delete patient:', error);
                showMessage(`Failed to delete patient: ${error.message}`, 'error');
            }
        }
    }

    async function editPatient(id) {
        console.log('--- Entering editPatient function for ID:', id); // DIAGNOSTIC LOG
        try {
            const patient = await fetchData(`/patients/${id}`);
            if (!patient) {
                console.log('No patient data returned for ID:', id); // DIAGNOSTIC LOG
                return;
            }

            patientIdInput.value = patient._id;
            console.log('patientIdInput.value set to:', patientIdInput.value, ' (after fetch in editPatient)'); // DIAGNOSTIC LOG

            // Populate form with patient data
            patientNameInput.value = patient.name;
            patientAgeInput.value = patient.age;
            patientGenderInput.value = patient.gender;
            patientDepartmentInput.value = patient.department;

            patientPhoneInput.value = patient.contact_info ? patient.contact_info.phone || '' : '';
            patientEmailInput.value = patient.contact_info ? patient.contact_info.email || '' : '';

            patientPrescriptionsInput.value = (patient.current_prescriptions && Array.isArray(patient.current_prescriptions)) ? patient.current_prescriptions.join(', ') : '';
            patientMedicalHistoryInput.value = (patient.medical_history && Array.isArray(patient.medical_history)) ? patient.medical_history.join(', ') : '';

            // Adjust form UI for editing
            formTitle.textContent = 'Update Patient';
            savePatientButton.textContent = 'Update Patient';
            cancelEditButton.style.display = 'inline-block'; // Show cancel button
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
            clearAllFieldErrors(); // Clear any previous errors when starting edit
        } catch (error) {
            console.error('Failed to load patient for edit:', error);
            showMessage('Failed to load patient for edit.', 'error');
        }
    }

    function resetFormForAdd() {
        console.log('--- Entering resetFormForAdd function ---'); // DIAGNOSTIC LOG
        patientForm.reset();
        patientIdInput.value = ''; // Clear hidden ID
        console.log('patientIdInput.value cleared to:', patientIdInput.value); // DIAGNOSTIC LOG
        formTitle.textContent = 'Add New Patient';
        savePatientButton.textContent = 'Save Patient';
        cancelEditButton.style.display = 'none'; // Hide cancel button
        clearAllFieldErrors(); // Clear errors when resetting form
    }

    // --- Chart Rendering Functions ---

    function destroyChart(chartInstance) {
        if (chartInstance) {
            chartInstance.destroy();
        }
    }

    async function loadChart(chartType) {
        let data = [];
        let labels = [];
        let chartLabel = '';
        let canvasId = '';
        let currentChartInstance = null; // To hold the instance specific to the chart type

        try {
            switch (chartType) {
                case "gender":
                    data = await fetchData('/analytics/gender-distribution');
                    if (!data) return;
                    labels = data.map(d => d._id); // _id holds the gender
                    data = data.map(d => d.count);
                    chartLabel = 'Gender Distribution';
                    canvasId = 'genderDistributionChart';
                    currentChartInstance = genderChartInstance;
                    break;
                case "department":
                    data = await fetchData('/analytics/department-distribution');
                    if (!data) return;
                    labels = data.map(d => d._id); // _id holds the department
                    data = data.map(d => d.count);
                    chartLabel = 'Department Distribution';
                    canvasId = 'departmentDistributionChart';
                    currentChartInstance = departmentChartInstance;
                    break;
                case "visitors":
                    data = await fetchData('/analytics/frequent-visitors');
                    if (!data) return;
                    labels = data.map(d => `${d.name} (${d.patient_id})`);
                    data = data.map(d => d.visit_count);
                    chartLabel = 'Visit Count';
                    canvasId = 'frequentVisitorsChart';
                    currentChartInstance = visitorsChartInstance;
                    break;
                default:
                    console.warn("Unknown chart type:", chartType);
                    return;
            }

            const ctx = document.getElementById(canvasId).getContext('2d');
            destroyChart(currentChartInstance); // Destroy previous instance if it exists

            const chartConfig = {
                type: 'bar', // Default to bar, can be changed based on type
                data: {
                    labels: labels,
                    datasets: [{
                        label: chartLabel,
                        data: data,
                        backgroundColor: [
                            'rgba(76, 175, 80, 0.6)', // Primary
                            'rgba(33, 150, 243, 0.6)', // Secondary
                            'rgba(255, 193, 7, 0.6)', // Accent
                            'rgba(244, 67, 54, 0.6)', // Error
                            'rgba(156, 39, 176, 0.6)', // Purple
                            'rgba(0, 188, 212, 0.6)', // Cyan
                            'rgba(255, 87, 34, 0.6)', // Deep Orange
                        ],
                        borderColor: [
                            'rgba(76, 175, 80, 1)',
                            'rgba(33, 150, 243, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(244, 67, 54, 1)',
                            'rgba(156, 39, 176, 1)',
                            'rgba(0, 188, 212, 1)',
                            'rgba(255, 87, 34, 1)',
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Allow container to control aspect ratio
                    plugins: {
                        legend: {
                            display: false // Hide legend if only one dataset
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0 // Ensure whole numbers for counts
                            }
                        }
                    }
                }
            };

            // Specific chart type adjustments (e.g., pie for distributions)
            if (chartType === "gender" || chartType === "department") {
                chartConfig.type = 'pie';
                chartConfig.options.scales = {}; // Remove scales for pie charts
                chartConfig.options.plugins.legend.display = true; // Show legend for pie charts
            }

            // Assign to global instance variable
            if (chartType === "gender") genderChartInstance = new Chart(ctx, chartConfig);
            else if (chartType === "department") departmentChartInstance = new Chart(ctx, chartConfig);
            else if (chartType === "visitors") visitorsChartInstance = new Chart(ctx, chartConfig);

        } catch (error) {
            console.error(`Failed to load ${chartType} chart:`, error);
            showMessage(`Failed to load ${chartLabel} chart.`, 'error');
        }
    }

    async function loadAllCharts() {
        showLoadingSpinner(); // Show spinner for all charts loading
        try {
            await Promise.all([
                loadChart("gender"),
                loadChart("department"),
                loadChart("visitors")
            ]);
        } catch (error) {
            console.error("Error loading all charts:", error);
        } finally {
            hideLoadingSpinner(); // Hide spinner after all charts loaded or on error
        }
    }

    // --- Event Listeners ---

    patientForm.addEventListener('submit', handlePatientFormSubmit);

    // Live validation event listeners
    patientNameInput.addEventListener('input', validatePatientName);
    patientNameInput.addEventListener('blur', validatePatientName); // Also validate on blur

    patientAgeInput.addEventListener('input', validatePatientAge);
    patientAgeInput.addEventListener('blur', validatePatientAge);

    patientGenderInput.addEventListener('change', validatePatientGender); // Use 'change' for select elements
    patientGenderInput.addEventListener('blur', validatePatientGender);

    patientDepartmentInput.addEventListener('input', validatePatientDepartment);
    patientDepartmentInput.addEventListener('blur', validatePatientDepartment);

    patientPhoneInput.addEventListener('input', validatePatientPhone);
    patientPhoneInput.addEventListener('blur', validatePatientPhone);

    patientEmailInput.addEventListener('input', validatePatientEmail);
    patientEmailInput.addEventListener('blur', validatePatientEmail);


    cancelEditButton.addEventListener('click', resetFormForAdd);

    // This is the ONLY place where edit/delete are handled now
    patientListBody.addEventListener('click', (event) => {
        const target = event.target;
        const id = target.dataset.id;
        if (target.classList.contains('edit-btn')) {
            editPatient(id);
        } else if (target.classList.contains('delete-btn')) {
            // ONLY call deletePatient once through this delegation
            deletePatient(id);
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        showMessage('Logged out successfully.', 'success');
        setTimeout(() => {
            window.location.href = '/'; // Redirect to login
        }, 1000);
    });

    // Event listener for the search button (search only on button click)
    searchButton.addEventListener('click', filterPatients);


    // --- Initial Load ---
    loadPatients(); // This now only fetches data, doesn't display until search
    loadAllCharts(); // Load all charts on initial page load
});