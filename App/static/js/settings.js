/**
 * Settings Page JavaScript
 * Manages account settings, location management, CSV uploads, and user management
 */

// Initialize components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modules
    AccountSettings.init();
    CsvUploader.init();
    LocationManager.init();
    UserManager.init();
});

/**
 * UI Helper functions for common operations
 */
const UIHelper = {
    // Show status message in modal
    showStatusMessage: function(title, message, type) {
        const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
        const statusTitle = document.getElementById('statusTitle');
        const statusMessage = document.getElementById('statusMessage');
        
        statusTitle.textContent = title;
        statusMessage.innerHTML = message;
        
        // Set the appropriate class based on the message type
        statusMessage.className = '';
        if (type === 'success') {
            statusMessage.classList.add('text-success');
        } else if (type === 'danger') {
            statusMessage.classList.add('text-danger');
        } else if (type === 'warning') {
            statusMessage.classList.add('text-warning');
        }
        
        statusModal.show();
    },
    
    // Clean up any hanging modal artifacts
    cleanupModals: function() {
        // Remove any lingering backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // Reset body classes that Bootstrap may have added
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
};

/**
 * Account Settings Module
 * Handles user account updates
 */
const AccountSettings = {
    init: function() {
        const accountForm = document.getElementById('accountSettingsForm');
        
        if (accountForm) {
            accountForm.addEventListener('submit', function(e) {
                e.preventDefault();
                AccountSettings.updateUserAccount();
            });
        }
    },
    
    updateUserAccount: async function() {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Basic validation
        if (!username || !email) {
            UIHelper.showStatusMessage('Error', 'Username and email are required.', 'danger');
            return;
        }
        
        // Password validation
        if (newPassword) {
            if (!currentPassword) {
                UIHelper.showStatusMessage('Error', 'Current password is required to set a new password.', 'danger');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                UIHelper.showStatusMessage('Error', 'New password and confirmation do not match.', 'danger');
                return;
            }
        }
        
        try {
            const response = await fetch('/api/user/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', 'Account settings updated successfully.', 'success');
                // Clear password fields after successful update
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to update account settings.', 'danger');
            }
        } catch (error) {
            console.error('Error updating account:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while updating account settings.', 'danger');
            UIHelper.cleanupModals();
        }
    }
};

/**
 * CSV Uploader Module
 * Handles CSV file uploads for assets and locations
 */
const CsvUploader = {
    init: function() {
        // Setup uploaders for different types
        this.setupUploader('asset');
        this.setupUploader('location');
    },
    
    setupUploader: function(type) {
        const fileInput = document.getElementById(`${type}CsvFile`);
        const dropZone = document.getElementById(`${type}CsvDropZone`);
        const fileNameContainer = document.getElementById(`${type}CsvFileName`);
        const selectedFileName = document.getElementById(`${type}SelectedFileName`);
        const clearFileBtn = document.getElementById(`${type}ClearFileBtn`);
        const uploadForm = document.getElementById(`${type}CsvUploadForm`);
        
        if (!fileInput || !dropZone || !fileNameContainer || !selectedFileName || !clearFileBtn || !uploadForm) {
            console.error(`Missing elements for ${type} CSV uploader`);
            return;
        }
        
        // Handle file selection
        fileInput.addEventListener('change', function() {
            if (fileInput.files.length > 0) {
                selectedFileName.textContent = fileInput.files[0].name;
                fileNameContainer.classList.remove('d-none');
            } else {
                fileNameContainer.classList.add('d-none');
            }
        });
        
        // Handle clearing the file
        clearFileBtn.addEventListener('click', function() {
            fileInput.value = '';
            fileNameContainer.classList.add('d-none');
        });
        
        // Handle form submission
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!fileInput.files.length) {
                UIHelper.showStatusMessage('Error', 'Please select a CSV file first.', 'danger');
                return;
            }
            
            CsvUploader.uploadFile(type, fileInput.files[0]);
        });
        
        // Setup drag & drop functionality
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('border-primary');
        });
        
        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('border-primary');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
            
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                
                // Trigger change event manually
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        });
    },
    
    uploadFile: async function(type, file) {
        const formData = new FormData();
        formData.append('csvFile', file);
        
        let endpoint = '';
        if (type === 'asset') {
            endpoint = '/api/imports/assets';
        } else if (type === 'location') {
            endpoint = '/api/imports/locations';
        }
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', `${type === 'asset' ? 'Assets' : 'Locations'} imported successfully.`, 'success');
                // Clear the file input
                document.getElementById(`${type}ClearFileBtn`).click();
            } else {
                UIHelper.showStatusMessage('Error', result.message || `Failed to import ${type} data.`, 'danger');
            }
        } catch (error) {
            console.error(`Error uploading ${type} CSV:`, error);
            UIHelper.showStatusMessage('Error', `An error occurred while uploading the ${type} CSV file.`, 'danger');
            UIHelper.cleanupModals();
        }
    }
};

/**
 * Location Manager Module
 * Handles buildings, floors, and rooms management
 */
const LocationManager = {
    init: function() {
        this.initTabs();
        this.initSelectors();
        this.initButtons();
        
        // Load initial buildings
        this.loadBuildings();
    },
    
    initTabs: function() {
        const locationTabs = document.getElementById('locationTabs');
        if (locationTabs) {
            locationTabs.addEventListener('shown.bs.tab', function(event) {
                const targetTab = event.target.getAttribute('id');
                
                if (targetTab === 'buildings-tab') {
                    LocationManager.loadBuildings();
                } else if (targetTab === 'floors-tab') {
                    LocationManager.populateBuildingSelect('buildingSelect');
                } else if (targetTab === 'rooms-tab') {
                    LocationManager.populateBuildingSelect('floorBuildingSelect');
                }
            });
        }
    },
    
    initSelectors: function() {
        // Building selector for floors tab
        const buildingSelect = document.getElementById('buildingSelect');
        if (buildingSelect) {
            buildingSelect.addEventListener('change', function() {
                const buildingId = buildingSelect.value;
                if (buildingId) {
                    LocationManager.loadFloors(buildingId);
                    document.getElementById('addFloorBtn').disabled = false;
                    
                    // Update the hidden building select in the modal
                    const modalBuildingSelect = document.getElementById('modalBuildingSelect');
                    modalBuildingSelect.innerHTML = `<option value="${buildingId}" selected>${buildingSelect.options[buildingSelect.selectedIndex].text}</option>`;
                } else {
                    document.getElementById('floorsTree').innerHTML = '<div class="text-center py-4"><p>Please select a building to view its floors</p></div>';
                    document.getElementById('addFloorBtn').disabled = true;
                }
            });
        }
        
        // Building selector for rooms tab
        const floorBuildingSelect = document.getElementById('floorBuildingSelect');
        if (floorBuildingSelect) {
            floorBuildingSelect.addEventListener('change', function() {
                const buildingId = floorBuildingSelect.value;
                const floorSelect = document.getElementById('floorSelect');
                
                if (buildingId) {
                    LocationManager.loadFloorsForSelect(buildingId, floorSelect);
                    floorSelect.disabled = false;
                    
                    // Update the hidden building select in the modal
                    const modalFloorBuildingSelect = document.getElementById('modalFloorBuildingSelect');
                    modalFloorBuildingSelect.innerHTML = `<option value="${buildingId}" selected>${floorBuildingSelect.options[floorBuildingSelect.selectedIndex].text}</option>`;
                } else {
                    floorSelect.innerHTML = '<option value="">First select a building...</option>';
                    floorSelect.disabled = true;
                    document.getElementById('roomsTree').innerHTML = '<div class="text-center py-4"><p>Please select a floor to view its rooms</p></div>';
                    document.getElementById('addRoomBtn').disabled = true;
                }
            });
        }
        
        // Floor selector for rooms tab
        const floorSelect = document.getElementById('floorSelect');
        if (floorSelect) {
            floorSelect.addEventListener('change', function() {
                const floorId = floorSelect.value;
                
                if (floorId) {
                    LocationManager.loadRooms(floorId);
                    document.getElementById('addRoomBtn').disabled = false;
                    
                    // Update the hidden floor select in the modal
                    const modalFloorSelect = document.getElementById('modalFloorSelect');
                    modalFloorSelect.innerHTML = `<option value="${floorId}" selected>${floorSelect.options[floorSelect.selectedIndex].text}</option>`;
                } else {
                    document.getElementById('roomsTree').innerHTML = '<div class="text-center py-4"><p>Please select a floor to view its rooms</p></div>';
                    document.getElementById('addRoomBtn').disabled = true;
                }
            });
        }
    },
    
    initButtons: function() {
        // Setup save buttons for location modals
        const saveBuildingBtn = document.getElementById('saveBuildingBtn');
        if (saveBuildingBtn) {
            saveBuildingBtn.addEventListener('click', this.saveBuilding);
        }
        
        const saveFloorBtn = document.getElementById('saveFloorBtn');
        if (saveFloorBtn) {
            saveFloorBtn.addEventListener('click', this.saveFloor);
        }
        
        const saveRoomBtn = document.getElementById('saveRoomBtn');
        if (saveRoomBtn) {
            saveRoomBtn.addEventListener('click', this.saveRoom);
        }
        
        // Make sure update buttons have no default handlers
        const updateBuildingBtn = document.getElementById('updateBuildingBtn');
        if (updateBuildingBtn) {
            updateBuildingBtn.onclick = null;
        }
        
        const updateFloorBtn = document.getElementById('updateFloorBtn');
        if (updateFloorBtn) {
            updateFloorBtn.onclick = null;
        }
        
        const updateRoomBtn = document.getElementById('updateRoomBtn');
        if (updateRoomBtn) {
            updateRoomBtn.onclick = null;
        }
    },
    
    // =============== BUILDINGS MANAGEMENT ===============
    loadBuildings: async function() {
        const buildingsTree = document.getElementById('buildingsTree');
        
        try {
            buildingsTree.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            
            const response = await fetch('/api/buildings');
            
            if (!response.ok) {
                throw new Error('Failed to fetch buildings');
            }
            
            const buildings = await response.json();
            
            if (buildings.length === 0) {
                buildingsTree.innerHTML = '<div class="text-center py-4"><p>No buildings found. Add your first building.</p></div>';
                return;
            }
            
            // Render buildings list
            let buildingsHtml = '';
            
            buildings.forEach(building => {
                buildingsHtml += `
                    <div class="location-item" data-id="${building.building_id}">
                        <div class="location-name">${building.building_name}</div>
                        <div class="location-actions">
                            <button class="btn btn-sm btn-outline-primary edit-building-btn" data-id="${building.building_id}" data-name="${building.building_name}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-building-btn" data-id="${building.building_id}" data-name="${building.building_name}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            buildingsTree.innerHTML = buildingsHtml;
            
            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-building-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.editBuilding(this.getAttribute('data-id'), this.getAttribute('data-name'));
                });
            });
            
            document.querySelectorAll('.delete-building-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.deleteBuilding(this.getAttribute('data-id'), this.getAttribute('data-name'));
                });
            });
            
        } catch (error) {
            console.error('Error loading buildings:', error);
            buildingsTree.innerHTML = '<div class="alert alert-danger">Error loading buildings. Please try again.</div>';
            UIHelper.cleanupModals();
        }
    },
    
    saveBuilding: async function() {
        const buildingName = document.getElementById('buildingName').value.trim();
        
        if (!buildingName) {
            UIHelper.showStatusMessage('Error', 'Building name is required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch('/api/buildings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    building_name: buildingName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addBuildingModal')).hide();
                // Clear the form
                document.getElementById('buildingName').value = '';
                // Show success message
                UIHelper.showStatusMessage('Success', 'Building added successfully.', 'success');
                // Reload buildings
                LocationManager.loadBuildings();
                // Update building selects
                LocationManager.populateBuildingSelect('buildingSelect');
                LocationManager.populateBuildingSelect('floorBuildingSelect');
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to add building.', 'danger');
            }
        } catch (error) {
            console.error('Error adding building:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while adding the building.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    editBuilding: function(buildingId, buildingName) {
        // Set the building name in the input
        document.getElementById('buildingName').value = buildingName;
        document.getElementById('addBuildingModalLabel').textContent = 'Edit Building';
        
        // Hide save button, show update button
        document.getElementById('saveBuildingBtn').style.display = 'none';
        const updateBtn = document.getElementById('updateBuildingBtn');
        updateBtn.style.display = 'block';
        
        // Set up the update button to call updateBuilding with the correct ID
        updateBtn.onclick = function() {
            LocationManager.updateBuilding(buildingId);
        };
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addBuildingModal'));
        modal.show();
    },
    
    updateBuilding: async function(buildingId) {
        const buildingName = document.getElementById('buildingName').value.trim();
        
        if (!buildingName) {
            UIHelper.showStatusMessage('Error', 'Building name is required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch(`/api/building/${buildingId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    building_name: buildingName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addBuildingModal')).hide();
                
                // Reset the modal for adding
                LocationManager.resetBuildingModal();
                
                // Show success message
                UIHelper.showStatusMessage('Success', 'Building updated successfully.', 'success');
                
                // Reload buildings
                LocationManager.loadBuildings();
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to update building.', 'danger');
            }
        } catch (error) {
            console.error('Error updating building:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while updating the building.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    deleteBuilding: async function(buildingId, buildingName) {
        if (!confirm(`Are you sure you want to delete building "${buildingName}"? This will also delete all associated floors and rooms.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/building/${buildingId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', 'Building deleted successfully.', 'success');
                // Reload buildings
                LocationManager.loadBuildings();
                // Update building selects
                LocationManager.populateBuildingSelect('buildingSelect');
                LocationManager.populateBuildingSelect('floorBuildingSelect');
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to delete building.', 'danger');
            }
        } catch (error) {
            console.error('Error updating building:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while removing the building.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    resetBuildingModal: function() {
        document.getElementById('buildingName').value = '';
        document.getElementById('addBuildingModalLabel').textContent = 'Add New Building';
        
        // Show save button, hide update button
        document.getElementById('saveBuildingBtn').style.display = 'block';
        document.getElementById('updateBuildingBtn').style.display = 'none';
    },
    
    // =============== FLOORS MANAGEMENT ===============
    loadFloors: async function(buildingId) {
        const floorsTree = document.getElementById('floorsTree');
        
        try {
            floorsTree.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            
            const response = await fetch(`/api/buildings/${buildingId}/floors`);//ASK ABOUT THIS, NO METHOD DEFINED
            
            if (!response.ok) {
                throw new Error('Failed to fetch floors');
            }
            
            const floors = await response.json();
            
            if (floors.length === 0) {
                floorsTree.innerHTML = '<div class="text-center py-4"><p>No floors found for this building. Add your first floor.</p></div>';
                return;
            }
            
            // Render floors list
            let floorsHtml = '';
            
            floors.forEach(floor => {
                floorsHtml += `
                    <div class="location-item" data-id="${floor.floor_id}">
                        <div class="location-name">${floor.floor_name}</div>
                        <div class="location-actions">
                            <button class="btn btn-sm btn-outline-primary edit-floor-btn" 
                                data-id="${floor.floor_id}" 
                                data-name="${floor.floor_name}"
                                data-building="${floor.building_id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-floor-btn" 
                                data-id="${floor.floor_id}" 
                                data-name="${floor.floor_name}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            floorsTree.innerHTML = floorsHtml;
            
            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-floor-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.editFloor(
                        this.getAttribute('data-id'), 
                        this.getAttribute('data-name'),
                        this.getAttribute('data-building')
                    );
                });
            });
            
            document.querySelectorAll('.delete-floor-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.deleteFloor(this.getAttribute('data-id'), this.getAttribute('data-name'));
                });
            });
            
        } catch (error) {
            console.error('Error loading floors:', error);
            floorsTree.innerHTML = '<div class="alert alert-danger">Error loading floors. Please try again.</div>';
            UIHelper.cleanupModals();
        }
    },
    
    loadFloorsForSelect: async function(buildingId, selectElement) {
        try {
            selectElement.disabled = true;
            selectElement.innerHTML = '<option value="">Loading floors...</option>';
            
            const response = await fetch(`/api/floors/${buildingId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch floors');
            }
            
            const floors = await response.json();
            
            if (floors.length === 0) {
                selectElement.innerHTML = '<option value="">No floors available</option>';
                return;
            }
            
            // Populate select element
            let optionsHtml = '<option value="">Select a floor...</option>';
            
            floors.forEach(floor => {
                optionsHtml += `<option value="${floor.floor_id}">${floor.floor_name}</option>`;
            });
            
            selectElement.innerHTML = optionsHtml;
            selectElement.disabled = false;
            
        } catch (error) {
            console.error('Error loading floors for select:', error);
            selectElement.innerHTML = '<option value="">Error loading floors</option>';
        }
    },
    
    saveFloor: async function() {
        const buildingId = document.getElementById('modalBuildingSelect').value;
        const floorName = document.getElementById('floorName').value.trim();
        
        if (!buildingId || !floorName) {
            UIHelper.showStatusMessage('Error', 'Building and floor name are required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch('/api/floor/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    building_id: buildingId,
                    floor_name: floorName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addFloorModal')).hide();
                // Clear the form
                document.getElementById('floorName').value = '';
                // Show success message
                UIHelper.showStatusMessage('Success', 'Floor added successfully.', 'success');
                // Reload floors if the current building is selected
                if (document.getElementById('buildingSelect').value === buildingId) {
                    LocationManager.loadFloors(buildingId);
                }
                // Update floor selects if needed
                if (document.getElementById('floorBuildingSelect').value === buildingId) {
                    LocationManager.loadFloorsForSelect(buildingId, document.getElementById('floorSelect'));
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to add floor.', 'danger');
            }
        } catch (error) {
            console.error('Error adding floor:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while adding the floor.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    editFloor: function(floorId, floorName, buildingId) {
        document.getElementById('floorName').value = floorName;
        document.getElementById('addFloorModalLabel').textContent = 'Edit Floor';
        
        // Set the building in the modal
        const buildingName = document.getElementById('buildingSelect').options[document.getElementById('buildingSelect').selectedIndex].text;
        document.getElementById('modalBuildingSelect').innerHTML = `<option value="${buildingId}" selected>${buildingName}</option>`;
        
        // Hide save button, show update button
        document.getElementById('saveFloorBtn').style.display = 'none';
        document.getElementById('updateFloorBtn').style.display = 'block';
        
        // Set up the update button click handler
        document.getElementById('updateFloorBtn').onclick = function() {
            LocationManager.updateFloor(floorId, buildingId);
        };
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addFloorModal'));
        modal.show();
    },
    
    updateFloor: async function(floorId, buildingId) {
        const floorName = document.getElementById('floorName').value.trim();
        
        if (!floorName) {
            UIHelper.showStatusMessage('Error', 'Floor name is required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch(`/api/floors/${floorId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    building_id: buildingId,
                    floor_name: floorName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addFloorModal')).hide();
                
                // Reset the modal for adding
                LocationManager.resetFloorModal();
                
                // Show success message
                UIHelper.showStatusMessage('Success', 'Floor updated successfully.', 'success');
                
                // Reload floors
                if (document.getElementById('buildingSelect').value === buildingId) {
                    LocationManager.loadFloors(buildingId);
                }
                
                // Update floor selects if needed
                if (document.getElementById('floorBuildingSelect').value === buildingId) {
                    LocationManager.loadFloorsForSelect(buildingId, document.getElementById('floorSelect'));
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to update floor.', 'danger');
            }
        } catch (error) {
            console.error('Error updating floor:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while updating the floor.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    deleteFloor: async function(floorId, floorName) {
        if (!confirm(`Are you sure you want to delete floor "${floorName}"? This will also delete all associated rooms.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/floor/${floorId}/delete`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', 'Floor deleted successfully.', 'success');
                // Reload floors for the current building if selected
                const currentBuildingId = document.getElementById('buildingSelect').value;
                if (currentBuildingId) {
                    LocationManager.loadFloors(currentBuildingId);
                }
                // Update floor selects if needed
                const floorBuildingId = document.getElementById('floorBuildingSelect').value;
                if (floorBuildingId) {
                    LocationManager.loadFloorsForSelect(floorBuildingId, document.getElementById('floorSelect'));
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to delete floor.', 'danger');
            }
        } catch (error) {
            console.error('Error deleting floor:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while deleting the floor.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    resetFloorModal: function() {
        document.getElementById('floorName').value = '';
        document.getElementById('addFloorModalLabel').textContent = 'Add New Floor';
        document.getElementById('saveFloorBtn').style.display = 'block';
        document.getElementById('updateFloorBtn').style.display = 'none';
    },
    
    // =============== ROOMS MANAGEMENT ===============
    loadRooms: async function(floorId) {
        const roomsTree = document.getElementById('roomsTree');
        
        try {
            roomsTree.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            
            const response = await fetch(`/api/floors/${floorId}/rooms`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            }
            
            const rooms = await response.json();
            
            if (rooms.length === 0) {
                roomsTree.innerHTML = '<div class="text-center py-4"><p>No rooms found for this floor. Add your first room.</p></div>';
                return;
            }
            
            // Render rooms list
            let roomsHtml = '';
            
            rooms.forEach(room => {
                roomsHtml += `
                    <div class="location-item" data-id="${room.room_id}">
                        <div class="location-name">${room.room_name}</div>
                        <div class="location-actions">
                            <button class="btn btn-sm btn-outline-primary edit-room-btn" 
                                data-id="${room.room_id}" 
                                data-name="${room.room_name}"
                                data-floor="${room.floor_id}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-room-btn" 
                                data-id="${room.room_id}" 
                                data-name="${room.room_name}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            roomsTree.innerHTML = roomsHtml;
            
            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-room-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.editRoom(
                        this.getAttribute('data-id'), 
                        this.getAttribute('data-name'),
                        this.getAttribute('data-floor')
                    );
                });
            });
            
            document.querySelectorAll('.delete-room-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    LocationManager.deleteRoom(this.getAttribute('data-id'), this.getAttribute('data-name'));
                });
            });
            
        } catch (error) {
            console.error('Error loading rooms:', error);
            roomsTree.innerHTML = '<div class="alert alert-danger">Error loading rooms. Please try again.</div>';
            UIHelper.cleanupModals();
        }
    },
    
    saveRoom: async function() {
        const floorId = document.getElementById('modalFloorSelect').value;
        const roomName = document.getElementById('roomName').value.trim();
        
        if (!floorId || !roomName) {
            UIHelper.showStatusMessage('Error', 'Floor and room name are required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    floor_id: floorId,
                    room_name: roomName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addRoomModal')).hide();
                // Clear the form
                document.getElementById('roomName').value = '';
                // Show success message
                UIHelper.showStatusMessage('Success', 'Room added successfully.', 'success');
                // Reload rooms if the current floor is selected
                if (document.getElementById('floorSelect').value === floorId) {
                    LocationManager.loadRooms(floorId);
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to add room.', 'danger');
            }
        } catch (error) {
            console.error('Error adding room:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while adding the room.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    editRoom: function(roomId, roomName, floorId) {
        document.getElementById('roomName').value = roomName;
        document.getElementById('addRoomModalLabel').textContent = 'Edit Room';
        
        // Set the building and floor in the modal
        const buildingId = document.getElementById('floorBuildingSelect').value;
        const buildingName = document.getElementById('floorBuildingSelect').options[document.getElementById('floorBuildingSelect').selectedIndex].text;
        document.getElementById('modalFloorBuildingSelect').innerHTML = `<option value="${buildingId}" selected>${buildingName}</option>`;
        
        const floorName = document.getElementById('floorSelect').options[document.getElementById('floorSelect').selectedIndex].text;
        document.getElementById('modalFloorSelect').innerHTML = `<option value="${floorId}" selected>${floorName}</option>`;
        
        // Hide save button, show update button
        document.getElementById('saveRoomBtn').style.display = 'none';
        document.getElementById('updateRoomBtn').style.display = 'block';
        
        // Set up the update button click handler
        document.getElementById('updateRoomBtn').onclick = function() {
            LocationManager.updateRoom(roomId, floorId);
        };
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('addRoomModal'));
        modal.show();
    },
    
    updateRoom: async function(roomId, floorId) {
        const roomName = document.getElementById('roomName').value.trim();
        
        if (!roomName) {
            UIHelper.showStatusMessage('Error', 'Room name is required.', 'danger');
            return;
        }
        
        try {
            const response = await fetch(`/api/rooms/${roomId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    floor_id: floorId,
                    room_name: roomName
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addRoomModal')).hide();
                
                // Reset the modal for adding
                LocationManager.resetRoomModal();
                
                // Show success message
                UIHelper.showStatusMessage('Success', 'Room updated successfully.', 'success');
                
                // Reload rooms
                if (document.getElementById('floorSelect').value === floorId) {
                    LocationManager.loadRooms(floorId);
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to update room.', 'danger');
            }
        } catch (error) {
            console.error('Error updating room:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while updating the room.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    deleteRoom: async function(roomId, roomName) {
        if (!confirm(`Are you sure you want to delete room "${roomName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/room/${roomId}/delete`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', 'Room deleted successfully.', 'success');
                // Reload rooms for the current floor if selected
                const currentFloorId = document.getElementById('floorSelect').value;
                if (currentFloorId) {
                    LocationManager.loadRooms(currentFloorId);
                }
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to delete room.', 'danger');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while deleting the room.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    resetRoomModal: function() {
        document.getElementById('roomName').value = '';
        document.getElementById('addRoomModalLabel').textContent = 'Add New Room';
        document.getElementById('saveRoomBtn').style.display = 'block';
        document.getElementById('updateRoomBtn').style.display = 'none';
    },
    
    // =============== BUILDING SELECT POPULATION ===============
    populateBuildingSelect: async function(selectId) {
        const selectElement = document.getElementById(selectId);
        
        try {
            selectElement.disabled = true;
            selectElement.innerHTML = '<option value="">Loading buildings...</option>';
            
            const response = await fetch('/api/buildings');
            
            if (!response.ok) {
                throw new Error('Failed to fetch buildings');
            }
            
            const buildings = await response.json();
            
            if (buildings.length === 0) {
                selectElement.innerHTML = '<option value="">No buildings available</option>';
                return;
            }
            
            // Populate select element
            let optionsHtml = '<option value="">Select a building...</option>';
            
            buildings.forEach(building => {
                optionsHtml += `<option value="${building.building_id}">${building.building_name}</option>`;
            });
            
            selectElement.innerHTML = optionsHtml;
            selectElement.disabled = false;
            
        } catch (error) {
            console.error('Error loading buildings for select:', error);
            selectElement.innerHTML = '<option value="">Error loading buildings</option>';
            UIHelper.cleanupModals();
        }
    }
};

/**
 * User Management Module
 * Handles user listing and creation
 */
const UserManager = {
    init: function() {
        // Load users when the tab is shown
        const userManagementTab = document.getElementById('user-management-tab');
        if (userManagementTab) {
            userManagementTab.addEventListener('shown.bs.tab', function() {
                UserManager.loadUsers();
            });
        }
        
        // Initialize create user form and button
        const createUserForm = document.getElementById('createUserForm');
        const saveUserBtn = document.getElementById('saveUserBtn');
        
        if (createUserForm) {
            // Ensure form never submits normally
            createUserForm.addEventListener('submit', function(e) {
                e.preventDefault();
                return false;
            });
        }
        
        if (saveUserBtn) {
            saveUserBtn.addEventListener('click', function() {
                UserManager.createUser();
            });
        }
        
        // Initialize password strength meter
        const passwordInput = document.getElementById('newUserPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                UserManager.updatePasswordStrength(this.value);
            });
        }
        
        // Initialize modal reset on close
        const addUserModal = document.getElementById('addUserModal');
        if (addUserModal) {
            addUserModal.addEventListener('hidden.bs.modal', function() {
                UserManager.resetUserModal();
            });
        }
    },
    
    loadUsers: async function() {
        const userList = document.getElementById('userList');
        if (!userList) return;
        
        try {
            userList.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            
            const response = await fetch('/api/users');
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const users = await response.json();
            
            if (users.length === 0) {
                userList.innerHTML = '<div class="no-users-message">No users found. Add your first user.</div>';
                return;
            }
            
            // Render users list
            let usersHtml = '';
            
            users.forEach(user => {
                usersHtml += `
                    <div class="user-card" data-id="${user.id}">
                        <div class="user-info">
                            <span class="user-email">${user.email}</span>
                            <span class="user-name">${user.username}</span>
                        </div>
                        <div class="user-actions">
                            <button class="btn btn-sm btn-outline-danger delete-user-btn" data-id="${user.id}" data-name="${user.username}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            userList.innerHTML = usersHtml;
            
            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    UserManager.deleteUser(this.getAttribute('data-id'), this.getAttribute('data-name'));
                });
            });
            
        } catch (error) {
            console.error('Error loading users:', error);
            userList.innerHTML = '<div class="alert alert-danger">Error loading users. Please try again.</div>';
            UIHelper.cleanupModals();
        }
    },
    
    createUser: async function() {
        const email = document.getElementById('newUserEmail').value.trim();
        const username = document.getElementById('newUserUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const confirmPassword = document.getElementById('confirmUserPassword').value;
        
        // Basic validation
        if (!email || !username || !password) {
            UIHelper.showStatusMessage('Error', 'All fields are required.', 'danger');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            UIHelper.showStatusMessage('Error', 'Please enter a valid email address.', 'danger');
            return;
        }
        
        // Password validation
        if (password !== confirmPassword) {
            UIHelper.showStatusMessage('Error', 'Passwords do not match.', 'danger');
            return;
        }
        
        if (password.length < 6) {
            UIHelper.showStatusMessage('Error', 'Password must be at least 6 characters long.', 'danger');
            return;
        }
        
        try {
            const response = await fetch('/api/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    username: username,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
                
                // Show success message
                UIHelper.showStatusMessage('Success', 'User created successfully.', 'success');
                
                // Reload users list
                UserManager.loadUsers();
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to create user.', 'danger');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while creating the user.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    deleteUser: async function(userId, username) {
        if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}/delete`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                UIHelper.showStatusMessage('Success', 'User deleted successfully.', 'success');
                // Reload users list
                UserManager.loadUsers();
            } else {
                UIHelper.showStatusMessage('Error', result.message || 'Failed to delete user.', 'danger');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            UIHelper.showStatusMessage('Error', 'An error occurred while deleting the user.', 'danger');
            UIHelper.cleanupModals();
        }
    },
    
    updatePasswordStrength: function(password) {
        const strengthMeter = document.getElementById('passwordStrengthMeter');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (!strengthMeter || !strengthText) return;
        
        const strength = this.calculatePasswordStrength(password);
        
        // Update the meter
        const strengthElement = strengthMeter.querySelector('.strength');
        strengthElement.className = 'strength';
        
        if (password.length === 0) {
            strengthElement.style.width = '0';
            strengthText.textContent = '';
            return;
        }
        
        if (strength < 40) {
            strengthElement.classList.add('strength-weak');
            strengthText.textContent = 'Weak';
            strengthText.className = 'password-feedback text-danger';
        } else if (strength < 80) {
            strengthElement.classList.add('strength-medium');
            strengthText.textContent = 'Medium';
            strengthText.className = 'password-feedback text-warning';
        } else {
            strengthElement.classList.add('strength-strong');
            strengthText.textContent = 'Strong';
            strengthText.className = 'password-feedback text-success';
        }
    },
    
    calculatePasswordStrength: function(password) {
        if (!password) return 0;
        
        let strength = 0;
        
        // Length contribution
        strength += password.length * 4;
        
        // Character variety contribution
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasDigit = /\d/.test(password);
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        
        const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
        strength += varietyCount * 10;
        
        // Cap at 100
        return Math.min(100, strength);
    },
    
    resetUserModal: function() {
        const form = document.getElementById('createUserForm');
        if (form) form.reset();
        
        const strengthMeter = document.getElementById('passwordStrengthMeter');
        if (strengthMeter) {
            const strengthElement = strengthMeter.querySelector('.strength');
            if (strengthElement) strengthElement.style.width = '0';
        }
        
        const strengthText = document.getElementById('passwordStrengthText');
        if (strengthText) strengthText.textContent = '';
    }
};