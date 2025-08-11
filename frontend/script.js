// --- Global Constants and Variables ---
const API_BASE_URL = window.location.origin;
let patientToDeleteId = null; // Used for the delete confirmation modal

// --- Utility Functions ---

/**
 * Displays a notification toast.
 * @param {string} message - The message to display.
 * @param {'success'|'error'} type - The type of notification.
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = `fixed bottom-5 right-5 text-white py-2 px-5 rounded-lg shadow-xl text-center fade-in ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/**
 * Returns a Tailwind CSS color class based on BMI verdict.
 * @param {string} verdict - The BMI verdict string.
 * @returns {string} A Tailwind CSS text color class.
 */
function getVerdictColor(verdict) {
    switch (verdict) {
        case 'Underweight': return 'text-blue-600';
        case 'Normal': return 'text-green-600';
        case 'Overweight': return 'text-yellow-600';
        case 'Obesity': return 'text-red-600';
        default: return 'text-gray-700';
    }
}

// --- API Functions ---

/**
 * Fetches data from a specified API endpoint.
 * @param {string} endpoint - The API endpoint to fetch (e.g., '/view').
 * @param {object} [options={}] - Optional fetch options (method, headers, body).
 * @returns {Promise<any>} The JSON response from the API.
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || `API request failed with status ${response.status}`);
        }
        return result;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        showToast(error.message, 'error');
        throw error; // Re-throw the error to be caught by the caller
    }
}

// --- Page-Specific Logic ---

/**
 * Logic for the View Patients page (view.html).
 */
function initViewPage() {
    const patientGrid = document.getElementById('patientGrid');
    const loading = document.getElementById('loading');
    const noPatientsMessage = document.getElementById('noPatientsMessage');
    const sortBtn = document.getElementById('sortBtn');
    const deleteModal = document.getElementById('deleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    function showLoading(isLoading) {
        if (isLoading) {
            loading.classList.remove('hidden');
            patientGrid.classList.add('hidden');
            noPatientsMessage.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            patientGrid.classList.remove('hidden');
        }
    }

    function displayPatients(patients) {
        patientGrid.innerHTML = '';
        if (patients.length === 0) {
            noPatientsMessage.classList.remove('hidden');
        } else {
            noPatientsMessage.classList.add('hidden');
            patients.forEach(patient => {
                const card = document.createElement('div');
                card.className = 'card p-5 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col fade-in';
                const verdictColor = getVerdictColor(patient.verdict);

                card.innerHTML = `
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <h3 class="text-xl font-bold text-gray-800">${patient.name}</h3>
                            <span class="text-sm font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-full">${patient.id}</span>
                        </div>
                        <p class="text-gray-600 mt-1">${patient.city}</p>
                        <div class="mt-4 border-t pt-4 text-sm text-gray-700 space-y-2">
                            <p><strong>Age:</strong> ${patient.age}</p>
                            <p><strong>Gender:</strong> <span class="capitalize">${patient.gender}</span></p>
                            <p><strong>Height:</strong> ${patient.height} m</p>
                            <p><strong>Weight:</strong> ${patient.weight} kg</p>
                            <div class="mt-2 pt-2 border-t">
                                <p class="font-bold text-base">BMI: ${patient.bmi} - <span class="${verdictColor} font-semibold">${patient.verdict}</span></p>
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t flex justify-end gap-2">
                        <a href="/edit.html?id=${patient.id}" class="edit-btn bg-yellow-500 text-white text-sm font-semibold py-1 px-3 rounded-md hover:bg-yellow-600 transition-colors">Edit</a>
                        <button class="delete-btn bg-red-600 text-white text-sm font-semibold py-1 px-3 rounded-md hover:bg-red-700 transition-colors" data-id="${patient.id}">Delete</button>
                    </div>
                `;
                patientGrid.appendChild(card);
            });
        }
    }
    
    async function fetchAndDisplayPatients(sortBy = null, order = null) {
        showLoading(true);
        try {
            let data;
            if (sortBy && order) {
                 // The backend returns an array for /sort
                data = await apiRequest(`/sort?sort_by=${sortBy}&order=${order}`);
            } else {
                // The backend returns an object for /view
                const rawData = await apiRequest('/view');
                data = Object.entries(rawData).map(([id, details]) => ({ id, ...details }));
            }
            displayPatients(data);
        } catch (error) {
            // Error is already logged and toasted by apiRequest
        } finally {
            showLoading(false);
        }
    }
    
    // Event Listeners
    sortBtn.addEventListener('click', () => {
        const sortBy = document.getElementById('sortBy').value;
        const order = document.getElementById('sortOrder').value;
        fetchAndDisplayPatients(sortBy, order);
    });

    patientGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            patientToDeleteId = e.target.dataset.id;
            deleteModal.classList.remove('hidden');
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        patientToDeleteId = null;
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!patientToDeleteId) return;
        try {
            const result = await apiRequest(`/delete/${patientToDeleteId}`, { method: 'DELETE' });
            showToast(result.message, 'success');
            fetchAndDisplayPatients(); // Refresh list
        } finally {
            deleteModal.classList.add('hidden');
            patientToDeleteId = null;
        }
    });
    
    // Initial Load
    fetchAndDisplayPatients();
}

/**
 * Logic for the Create Patient page (create.html).
 */
function initCreatePage() {
    const patientForm = document.getElementById('patientForm');
    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(patientForm);
        const patientData = {};
        for (let [key, value] of formData.entries()) {
            patientData[key] = ['age', 'height', 'weight'].includes(key) ? parseFloat(value) : value;
        }

        try {
            const result = await apiRequest('/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patientData),
            });
            showToast(result.message, 'success');
            // Redirect to the view page after successful creation
            setTimeout(() => {
                window.location.href = '/view.html';
            }, 1000);
        } catch (error) {
            // Error is already handled by apiRequest
        }
    });
}

/**
 * Logic for the Edit Patient page (edit.html).
 */
function initEditPage() {
    const patientForm = document.getElementById('patientForm');
    const editFormContainer = document.getElementById('editFormContainer');
    const messageContainer = document.getElementById('messageContainer');
    const patientIdDisplay = document.getElementById('patientIdDisplay');

    // Get patient ID from URL (e.g., /edit.html?id=P001)
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');

    if (!patientId) {
        messageContainer.innerHTML = `<h3 class="text-xl font-semibold text-red-600">No Patient ID Provided</h3><p class="text-gray-500 mt-2">Please go back to the <a href="/view.html" class="text-blue-600 hover:underline">view page</a> and select a patient to edit.</p>`;
        return;
    }

    async function loadPatientForEdit() {
        messageContainer.innerHTML = `<p class="font-semibold">Loading patient data...</p>`;
        try {
            const data = await apiRequest(`/patient/${patientId}`);
            
            // Populate the form
            document.getElementById('patientId').value = patientId;
            patientIdDisplay.textContent = patientId;
            document.getElementById('name').value = data.name;
            document.getElementById('city').value = data.city;
            document.getElementById('age').value = data.age;
            document.getElementById('gender').value = data.gender;
            document.getElementById('height').value = data.height;
            document.getElementById('weight').value = data.weight;

            // Show the form and hide the message container
            editFormContainer.classList.remove('hidden');
            messageContainer.classList.add('hidden');

        } catch (error) {
            messageContainer.innerHTML = `<h3 class="text-xl font-semibold text-red-600">Failed to Load Patient</h3><p class="text-gray-500 mt-2">${error.message}</p>`;
        }
    }

    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(patientForm);
        const patientData = {};
        // Note: For update, we don't send the ID in the body
        for (let [key, value] of formData.entries()) {
            if (key !== 'id') {
                 patientData[key] = ['age', 'height', 'weight'].includes(key) ? parseFloat(value) : value;
            }
        }
        
        try {
            const result = await apiRequest(`/edit/${patientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patientData),
            });
            showToast(result.message, 'success');
            setTimeout(() => {
                window.location.href = '/view.html';
            }, 1000);
        } catch (error) {
            // Error handled by apiRequest
        }
    });

    loadPatientForEdit();
}


// --- Main DOMContentLoaded Event Listener ---
// This acts as a simple router to run the correct code for the current page.
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path === '/view.html' || path.startsWith('/view')) {
        initViewPage();
    } else if (path === '/create.html' || path.startsWith('/create')) {
        initCreatePage();
    } else if (path === '/edit.html' || path.startsWith('/edit')) {
        initEditPage();
    }
    // No specific JS needed for index.html (home page)
});
