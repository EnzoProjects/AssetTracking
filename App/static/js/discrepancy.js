/**
 * Discrepancy Report Module
 * Handles displaying and managing discrepancies in asset locations
 */

// State management
const DiscrepancyState = {
    allDiscrepancies: [],
    allRooms: [],
    selectedAssets: new Set(),
    currentFilter: 'all',
    
    // Clear the selection state
    clearSelection() {
        this.selectedAssets.clear();
        document.querySelectorAll('.discrepancy-checkbox').forEach(cb => cb.checked = false);
        UI.updateSelectAllState();
        UI.updateBulkActionButtons();
    }
};

// API interaction module
const API = {
    /**
     * Loads all discrepancies from the server
     * @returns {Promise<Array>} Promise resolving to array of discrepancy objects
     */
    async getDiscrepancies() {
        try {
            const response = await fetch('/api/discrepancies');
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading discrepancies:', error);
            UI.showErrorMessage('Failed to load discrepancies. Please try again later.');
            throw error;
        }
    },
    
    /**
     * Loads all rooms from the server
     * @returns {Promise<Array>} Promise resolving to array of room objects
     */
    async getRooms() {
        try {
            const response = await fetch('/api/rooms');
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading rooms:', error);
            UI.showStatusMessage(
                'Warning',
                'Failed to load rooms for relocation. Some features may not work properly.',
                'warning'
            );
            return [];
        }
    },
    
    /**
     * Partially updates a single asset using the PATCH endpoint.
     * This is the new, consolidated function for all single-asset updates.
     * @param {string} assetId - The ID of the asset to update.
     * @param {object} updateData - An object with the fields to change (e.g., { status: 'Lost' }).
     * @returns {Promise<Object>} Promise resolving to the API response.
     */
    async updateAsset(assetId, updateData) {
        try {
            const response = await fetch(`/api/assets/${assetId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorResult = await this.parseJsonSafely(response);
                const message = errorResult ? errorResult.message : `API error: ${response.status}`;
                throw new Error(message);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error updating asset ${assetId}:`, error);
            throw error;
        }
    },

    
    /**
     * Performs a bulk partial update on a collection of assets.
     * This single function communicates with the PATCH /api/assets endpoint.
     * @param {string} action - The action to perform (e.g., 'mark_found', 'relocate').
     * @param {Array<string>} assetIds - Array of asset IDs to update.
     * @param {object} options - An object for additional data (e.g., { roomId, notes }).
     * @returns {Promise<Object>} A promise resolving to an object { ok: boolean, data: object }.
     */
    async bulkUpdateAssets(action, assetIds, options = {}) {
        try {
            // This is the single, consolidated endpoint
            const response = await fetch('/api/assets', {
                method: 'PATCH', // Using PATCH as defined in your Flask route
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: action,      // e.g., 'mark_found'
                    assetIds: assetIds,  // The array of IDs
                    ...options           // Merges in other properties like { roomId, notes }
                })
            });
            
            // Return a structured response for the Actions handler
            return {
                ok: response.ok,
                data: await this.parseJsonSafely(response)
            };
        } catch (error) {
            console.error(`Error during bulk action '${action}':`, error);
            throw error;
        }
    },
    
    /**
     * Safely parse JSON from a response, handling potential parsing errors
     * @param {Response} response - The fetch Response object
     * @returns {Object|null} Parsed JSON or null if parsing failed
     */
    async parseJsonSafely(response) {
        try {
            const text = await response.text();
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse server response as JSON:", e);
            return null;
        }
    },

    /**
     * Download current discrepancies as CSV
     * @param {string} filter - Optional filter ('all', 'missing', or 'misplaced')
     * @returns {Promise<void>} Promise that resolves when download starts
     */
    async downloadDiscrepancies(filter = 'all') {
        try {
            // Create the download URL with the current filter
            const downloadUrl = `/api/discrepancies/download?filter=${filter}`;
            
            // Create a timestamp for the filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Redirect to the download endpoint
            window.location.href = downloadUrl;
        } catch (error) {
            console.error('Error initiating download:', error);
            UI.showErrorMessage('Failed to download report. Please try again later.');
            throw error;
        }
    }
};

// Template utilities module
const Templates = {
    /**
     * Clone a template by its ID and return the element
     * @param {string} templateId - ID of the template element
     * @returns {DocumentFragment} Cloned template content
     */
    clone(templateId) {
        const template = document.getElementById(templateId);
        if (!template) {
            console.error(`Template with ID '${templateId}' not found`);
            return document.createDocumentFragment();
        }
        return template.content.cloneNode(true);
    },
    
    /**
     * Get the first element from a template by selector
     * @param {DocumentFragment} template - The cloned template
     * @param {string} selector - CSS selector for the desired element
     * @returns {Element|null} The first matching element or null
     */
    getElement(template, selector) {
        return template.querySelector(selector);
    },
    
    /**
     * Create an instance of the discrepancy item template
     * @param {Object} asset - Asset data object
     * @returns {DocumentFragment} Populated template content
     */
    createDiscrepancyItem(asset) {
        const template = this.clone('discrepancy-item-template');
        const item = this.getElement(template, '.discrepancy-item');
        const checkbox = this.getElement(template, '.discrepancy-checkbox');
        const icon = this.getElement(template, '.discrepancy-icon i');
        const title = this.getElement(template, '.discrepancy-title');
        const details = this.getElement(template, '.discrepancy-details');
        const actionButtons = this.getElement(template, '.action-buttons');
        
        // Asset data
        const assetId = asset.id || asset['id:'] || '';
        const description = asset.description || 'Unknown Asset';
        const status = asset.status || 'Unknown';
        
        // Set up the item
        item.classList.add(`${status.toLowerCase()}-item`);
        item.dataset.status = status.toLowerCase();
        item.dataset.assetId = assetId;
        
        // Set up the checkbox
        checkbox.id = `check-${assetId}`;
        checkbox.value = assetId;
        checkbox.dataset.assetId = assetId;
        
        // Set up the icon
        icon.className = status === 'Missing' ? 
            'bi bi-exclamation-circle-fill' : 
            'bi bi-geo-alt-fill';
        
        icon.parentElement.classList.add(`${status.toLowerCase()}-icon`);
        
        // Set up the content
        title.textContent = `${description} - ${assetId}`;
        
        // Generate details text based on status
        if (status === 'Missing') {
            details.textContent = `Expected in ${asset.room_name || 'Unknown location'}, not found`;
        } else if (status === 'Misplaced') {
            details.textContent = `Expected in ${asset.room_name || 'Unknown location'}, found in ${asset.last_located_name || asset.last_located || 'Unknown location'}`;
        }
        
        // Add action buttons
        if (status === 'Missing') {
            const actionTemplate = this.clone('missing-actions-template');
            this.setupMissingActionButtons(actionTemplate, assetId, description);
            actionButtons.appendChild(actionTemplate);
        } else if (status === 'Misplaced') {
            const actionTemplate = this.clone('misplaced-actions-template');
            this.setupMisplacedActionButtons(actionTemplate, assetId, description, asset.last_located);
            actionButtons.appendChild(actionTemplate);
        }
        
        return template;
    },
    
    /**
     * Set up action buttons for a missing asset
     * @param {DocumentFragment} template - The action buttons template
     * @param {string} assetId - Asset ID
     * @param {string} description - Asset description
     */
    setupMissingActionButtons(template, assetId, description) {
        // Mark as Found button
        const foundBtn = template.querySelector('.mark-found-btn');
        foundBtn.dataset.assetId = assetId;
        foundBtn.dataset.assetName = description;
        
        // Relocate button
        const relocateBtn = template.querySelector('.found-relocate-btn');
        relocateBtn.dataset.assetId = assetId;
        relocateBtn.dataset.assetName = description;
        
        // Mark as Lost button
        const lostBtn = template.querySelector('.mark-lost-btn');
        lostBtn.dataset.assetId = assetId;
        lostBtn.dataset.assetName = description;
        
        // Details link
        const detailsLink = template.querySelector('.asset-details-link');
        detailsLink.href = `/asset/${assetId}`;
    },
    
    /**
     * Set up action buttons for a misplaced asset
     * @param {DocumentFragment} template - The action buttons template
     * @param {string} assetId - Asset ID
     * @param {string} description - Asset description
     * @param {string} currentLocation - Current location ID
     */
    setupMisplacedActionButtons(template, assetId, description, currentLocation) {
        // Mark as Found button
        const foundBtn = template.querySelector('.mark-found-btn');
        foundBtn.dataset.assetId = assetId;
        foundBtn.dataset.assetName = description;
        
        // Reassign button
        const reassignBtn = template.querySelector('.misplaced-reassign-btn');
        reassignBtn.dataset.assetId = assetId;
        reassignBtn.dataset.assetName = description;
        reassignBtn.dataset.currentLocation = currentLocation;
        
        // Details link
        const detailsLink = template.querySelector('.asset-details-link');
        detailsLink.href = `/asset/${assetId}`;
    },
    
    /**
     * Create an empty state element
     * @returns {DocumentFragment} The empty state template
     */
    createEmptyState() {
        return this.clone('empty-state-template');
    },
    
    /**
     * Create a loading spinner element
     * @returns {DocumentFragment} The loading spinner template
     */
    createLoadingSpinner() {
        return this.clone('loading-template');
    },
    
    /**
     * Create an error message element
     * @param {string} message - The error message
     * @returns {DocumentFragment} The error template
     */
    createErrorMessage(message) {
        const template = this.clone('error-template');
        template.querySelector('.error-message').textContent = message;
        return template;
    }
};

// UI management module
const UI = {
    /**
     * Initialize the UI elements and event listeners
     */
    init() {
        this.setupEventListeners();
        
        // Initial UI state
        document.getElementById('bulk-actions-toolbar').style.display = 'none';
    },
    
    /**
     * Set up all event listeners for the page
     */
    setupEventListeners() {
        // Filter clicks
        document.getElementById('filter-all').addEventListener('click', e => {
            e.preventDefault();
            this.filterDiscrepancies('all');
        });
        
        document.getElementById('filter-missing').addEventListener('click', e => {
            e.preventDefault();
            this.filterDiscrepancies('missing');
        });
        
        document.getElementById('filter-misplaced').addEventListener('click', e => {
            e.preventDefault();
            this.filterDiscrepancies('misplaced');
        });
        
        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', this.handleSelectAllChange.bind(this));
        }
        
        // Bulk action buttons
        document.getElementById('bulkMarkFoundBtn').addEventListener('click', this.bulkMarkFound.bind(this));
        document.getElementById('bulkRelocateBtn').addEventListener('click', this.showBulkRelocateModal.bind(this));
        document.getElementById('cancelSelectionBtn').addEventListener('click', () => DiscrepancyState.clearSelection());
        
        // Relocation modal confirm button
        document.getElementById('confirmRelocationBtn').addEventListener('click', this.handleRelocateConfirm.bind(this));
        
        // Individual asset action buttons (delegated)
        document.addEventListener('click', this.handleAssetActions.bind(this));

        // Download report button
        document.getElementById('downloadReportBtn').addEventListener('click', this.handleDownloadReport.bind(this));
    },

    /**
     * Handle download report button click
     * @param {Event} e - The click event
     */
    handleDownloadReport(e) {
        e.preventDefault();
        // Use the current filter when downloading
        API.downloadDiscrepancies(DiscrepancyState.currentFilter);
    },
    
    /**
     * Handle delegated clicks on asset action buttons
     * @param {Event} e - The click event
     */
    handleAssetActions(e) {
        // Mark as Lost button (Single)
        if (e.target.closest('.mark-lost-btn')) {
            const button = e.target.closest('.mark-lost-btn');
            const assetId = button.dataset.assetId;
            const assetName = button.dataset.assetName;

            if (confirm(`Are you sure you want to mark ${assetName} (${assetId}) as Lost? This action cannot be undone.`)) {
                Actions.markAssetAsLost(assetId, assetName);
            }
        }

        // Mark as Found button (Single)
        if (e.target.closest('.mark-found-btn')) {
            const button = e.target.closest('.mark-found-btn');
            const assetId = button.dataset.assetId;
            const assetName = button.dataset.assetName;

            if (confirm(`Mark ${assetName} (${assetId}) as Found and return to its assigned room?`)) {
                Actions.markAssetAsFound(assetId, assetName);
            }
        }

        // Misplaced Reassign button (Single)
        if (e.target.closest('.misplaced-reassign-btn')) {
            const button = e.target.closest('.misplaced-reassign-btn');
            const assetId = button.dataset.assetId;
            const assetName = button.dataset.assetName;
            const currentLocation = button.dataset.currentLocation;

            this.showRelocateModal({
                mode: 'single',
                assetId,
                assetName,
                currentLocation,
                type: 'reassign'
            });
        }

        // Found and Relocated button (Single - for missing assets)
        if (e.target.closest('.found-relocate-btn')) {
            const button = e.target.closest('.found-relocate-btn');
            const assetId = button.dataset.assetId;
            const assetName = button.dataset.assetName;

            this.showRelocateModal({
                mode: 'single',
                assetId,
                assetName,
                type: 'relocate'
            });
        }
        
        // Checkbox for individual asset
        if (e.target.classList.contains('discrepancy-checkbox')) {
            this.handleCheckboxChange(e);
        }
    },
    
    /**
     * Handle individual checkbox changes
     * @param {Event} event - The change event
     */
    handleCheckboxChange(event) {
        const checkbox = event.target;
        const assetId = checkbox.value;

        if (checkbox.checked) {
            DiscrepancyState.selectedAssets.add(assetId);
        } else {
            DiscrepancyState.selectedAssets.delete(assetId);
        }
        
        this.updateBulkActionButtons();
        this.updateSelectAllState();
    },
    
    /**
     * Handle "Select All" checkbox change
     * @param {Event} event - The change event
     */
    handleSelectAllChange(event) {
        const isChecked = event.target.checked;
        const visibleCheckboxes = document.querySelectorAll('.discrepancy-checkbox:not([style*="display: none"])');

        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const assetId = checkbox.value;
            
            if (isChecked) {
                DiscrepancyState.selectedAssets.add(assetId);
            } else {
                DiscrepancyState.selectedAssets.delete(assetId);
            }
        });
        
        this.updateBulkActionButtons();
    },
    
    /**
     * Update the bulk action buttons state based on selection
     */
    updateBulkActionButtons() {
        // Get the selection count
        const numSelected = DiscrepancyState.selectedAssets.size;
        
        // Update the selection counter
        const selectionCount = document.getElementById('selection-count');
        if (selectionCount) {
            selectionCount.textContent = numSelected === 1 ? "1 selected" : `${numSelected} selected`;
            
            // Show/hide the selection count based on selection
            if (numSelected > 0) {
                selectionCount.classList.add('active');
            } else {
                selectionCount.classList.remove('active');
            }
        }
        
        // Update the toolbar highlight
        const toolbar = document.getElementById('bulk-actions-toolbar');
        if (toolbar) {
            if (numSelected > 0) {
                toolbar.classList.add('active');
            } else {
                toolbar.classList.remove('active');
            }
        }
        
        // Enable/disable action buttons
        const bulkMarkFoundBtn = document.getElementById('bulkMarkFoundBtn');
        const bulkRelocateBtn = document.getElementById('bulkRelocateBtn');
        const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
        
        const hasSelection = numSelected > 0;
        
        if (bulkMarkFoundBtn) bulkMarkFoundBtn.disabled = !hasSelection;
        if (bulkRelocateBtn) bulkRelocateBtn.disabled = !hasSelection;
        if (cancelSelectionBtn) cancelSelectionBtn.disabled = !hasSelection;
    },
    
    /**
     * Update the state of the "Select All" checkbox
     */
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;

        const visibleCheckboxes = document.querySelectorAll('.discrepancy-checkbox');
        const visibleItems = Array.from(visibleCheckboxes).filter(cb => {
            const item = cb.closest('.discrepancy-item');
            return item && item.style.display !== 'none';
        });

        if (visibleItems.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }

        const allVisibleSelected = visibleItems.every(checkbox => checkbox.checked);
        const someVisibleSelected = visibleItems.some(checkbox => checkbox.checked);

        if (allVisibleSelected) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (someVisibleSelected) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true; // Indicate partial selection
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    },
    
    /**
     * Filter discrepancy items by type
     * @param {string} type - The filter type ('all', 'missing', or 'misplaced')
     */
    filterDiscrepancies(type) {
        // Reset all filters visually
        document.querySelectorAll('.filter-badge').forEach(badge => {
            badge.classList.remove('Good');
        });

        // Activate selected filter visually
        const activeFilter = document.getElementById(`filter-${type}`);
        if (activeFilter) {
            activeFilter.classList.add('Good');
        }
        
        DiscrepancyState.currentFilter = type;
        DiscrepancyState.clearSelection(); // Clear selection when filter changes

        let filteredDiscrepancies;
        if (type === 'all') {
            filteredDiscrepancies = DiscrepancyState.allDiscrepancies;
        } else {
            // Filter by status
            filteredDiscrepancies = DiscrepancyState.allDiscrepancies.filter(asset =>
                asset.status && asset.status.toLowerCase() === type
            );
        }

        this.renderDiscrepancies(filteredDiscrepancies);
    },
    
    /**
     * Render discrepancy items to the DOM
     * @param {Array} discrepancies - Array of discrepancy objects to render
     */
    renderDiscrepancies(discrepancies) {
        const discrepancyList = document.getElementById('discrepancy-list');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const toolbar = document.getElementById('bulk-actions-toolbar');

        // Clear the list
        discrepancyList.innerHTML = '';

        // Reset select all checkbox
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        // Handle empty state
        if (!discrepancies || discrepancies.length === 0) {
            // Show empty message using template
            discrepancyList.appendChild(Templates.createEmptyState());
            
            // Hide toolbar when no items
            if (toolbar) toolbar.style.display = 'none';
            return;
        } else {
            // Show toolbar when items exist
            if (toolbar) toolbar.style.display = 'flex';
        }

        // Sort discrepancies - missing first, then misplaced
        discrepancies.sort((a, b) => {
            if (a.status === "Missing" && b.status !== "Missing") return -1;
            if (a.status !== "Missing" && b.status === "Missing") return 1;
            return 0; // Keep original order if statuses are the same
        });

        // Create a document fragment to hold all items for efficient DOM manipulation
        const fragment = document.createDocumentFragment();
        
        // Add each discrepancy item to the fragment
        discrepancies.forEach(asset => {
            fragment.appendChild(Templates.createDiscrepancyItem(asset));
        });
        
        // Add the fragment to the DOM
        discrepancyList.appendChild(fragment);
        
        // Re-check selected items after rendering
        DiscrepancyState.selectedAssets.forEach(id => {
            const checkbox = discrepancyList.querySelector(`#check-${id}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        this.updateSelectAllState();
    },
    
    /**
     * Show relocation modal with appropriate configuration
     * @param {Object} config - Configuration object
     */
    showRelocateModal(config) {
        const { mode, assetId, assetName, currentLocation, type } = config;
        const modal = new bootstrap.Modal(document.getElementById('relocationModal'));
        const roomSelect = document.getElementById('roomSelect');
        
        // Store current asset info on the modal for later use
        document.getElementById('confirmRelocationBtn').dataset.mode = mode;
        document.getElementById('confirmRelocationBtn').dataset.assetId = assetId || '';
        document.getElementById('confirmRelocationBtn').dataset.assetName = assetName || '';
        
        // Configure modal title and text based on operation type
        if (mode === 'single') {
            if (type === 'reassign') {
                document.getElementById('relocationModalLabel').textContent = 'Reassign Asset to Current Location';
                document.querySelector('#relocationModal .asset-info').textContent = `Asset: ${assetName} (${assetId})`;
                document.getElementById('relocationInfoText').textContent = 'The asset was found here. Confirm reassignment to this location.';
                document.getElementById('locationUpdateText').textContent = 'The asset\'s assigned location will be updated to match its current found location.';
                
                // Pre-select current location in the dropdown
                this.populateRoomSelect(roomSelect, DiscrepancyState.allRooms, currentLocation, true);
            } else {
                document.getElementById('relocationModalLabel').textContent = 'Find Asset & Move to New Location';
                document.querySelector('#relocationModal .asset-info').textContent = `Asset: ${assetName} (${assetId})`;
                document.getElementById('relocationInfoText').textContent = 'Select the new location where the asset was found.';
                document.getElementById('locationUpdateText').textContent = 'The asset will be marked as Found and its assigned location updated.';
                
                this.populateRoomSelect(roomSelect, DiscrepancyState.allRooms);
            }
            
            document.getElementById('confirmRelocationBtn').textContent = 'Confirm Location Update';
        } else {
            // Bulk mode
            document.getElementById('relocationModalLabel').textContent = 'Bulk Found & Relocate Assets';
            document.querySelector('#relocationModal .asset-info').textContent = `${DiscrepancyState.selectedAssets.size} asset(s) selected.`;
            document.getElementById('relocationInfoText').textContent = 'Select a single new location where all selected assets were found.';
            document.getElementById('locationUpdateText').textContent = 'All selected assets will be marked as Found and their assigned location updated to the selected room.';
            document.getElementById('confirmRelocationBtn').textContent = 'Confirm Bulk Relocation';
            
            this.populateRoomSelect(roomSelect, DiscrepancyState.allRooms);
        }
        
        // Clear notes field
        document.getElementById('relocationNotes').value = '';
        
        modal.show();
    },
    
    /**
     * Handle relocation confirm button click
     * @param {Event} event - The click event
     */
    handleRelocateConfirm(event) {
        const roomSelect = document.getElementById('roomSelect');
        const selectedRoomId = roomSelect.value;
        const notes = document.getElementById('relocationNotes').value;
        const mode = event.target.dataset.mode;
        
        if (!selectedRoomId) {
            alert('Please select a room');
            return;
        }
        
        if (mode === 'bulk') {
            Actions.executeBulkRelocate(selectedRoomId, notes);
        } else if (mode === 'single') {
            const assetId = event.target.dataset.assetId;
            const assetName = event.target.dataset.assetName;
            
            if (assetId) {
                Actions.markAssetAsFoundAndRelocated(assetId, assetName, selectedRoomId, notes);
            }
        }
    },
    
    /**
     * Update the counters in the filter badges
     */
    updateCounters() {
        const missingCount = DiscrepancyState.allDiscrepancies.filter(asset =>
            asset.status && asset.status === 'Missing'
        ).length;

        const misplacedCount = DiscrepancyState.allDiscrepancies.filter(asset =>
            asset.status && asset.status === 'Misplaced'
        ).length;

        const totalCount = missingCount + misplacedCount;

        document.querySelector('#filter-all .count-badge').textContent = totalCount;
        document.querySelector('#filter-missing .count-badge').textContent = missingCount;
        document.querySelector('#filter-misplaced .count-badge').textContent = misplacedCount;
    },
    
    /**
     * Show status message in modal
     * @param {string} title - The modal title
     * @param {string} message - The message content
     * @param {string} type - The message type ('success', 'danger', or 'warning')
     */
    showStatusMessage(title, message, type) {
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
    
    /**
     * Show error message in the discrepancy list
     * @param {string} message - The error message
     */
    showErrorMessage(message) {
        const discrepancyList = document.getElementById('discrepancy-list');
        discrepancyList.innerHTML = '';
        discrepancyList.appendChild(Templates.createErrorMessage(message));
        
        // Hide toolbar in case of error
        document.getElementById('bulk-actions-toolbar').style.display = 'none';
    },
    
    /**
     * Show bulk mark found UI
     */
    bulkMarkFound() {
        const assetIds = Array.from(DiscrepancyState.selectedAssets);
        if (assetIds.length === 0) return;

        // Show a confirmation with the count of selected assets
        if (!confirm(`Mark ${assetIds.length} selected asset(s) as Found and return to their assigned rooms?`)) {
            return;
        }

        Actions.executeBulkMarkFound();
    },
    
    /**
     * Show bulk relocate modal
     */
    showBulkRelocateModal() {
        const assetIds = Array.from(DiscrepancyState.selectedAssets);
        if (assetIds.length === 0) return;

        this.showRelocateModal({
            mode: 'bulk'
        });
    },
    
    /**
     * Display loading state in the discrepancy list
     */
    showLoading() {
        const discrepancyList = document.getElementById('discrepancy-list');
        discrepancyList.innerHTML = '';
        discrepancyList.appendChild(Templates.createLoadingSpinner());
    },
    
    /**
     * Populate room select dropdown
     * @param {HTMLElement} selectElement - The select element to populate
     * @param {Array} rooms - Array of room objects
     * @param {string|null} defaultRoomId - Optional default room ID to select
     * @param {boolean} isReassignMode - Whether in reassign mode
     */
    populateRoomSelect(selectElement, rooms, defaultRoomId = null, isReassignMode = false) {
        selectElement.innerHTML = '<option value="">Select a room...</option>'; // Clear existing options

        if (!rooms || rooms.length === 0) {
            console.warn("No rooms available to populate select dropdown.");
            selectElement.innerHTML = '<option value="">No rooms available</option>';
            return;
        }

        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.room_id; // Ensure you use the correct property name ('room_id')

            let optionText = room.room_name; // Default text

            // Check if this is the default room AND we are in reassign mode
            if (isReassignMode && defaultRoomId != null && room.room_id == defaultRoomId) {
                optionText = `${room.room_name} (Confirm reassignment)`;
                option.selected = true; // Ensure it's selected
            }

            option.textContent = optionText; // Set the potentially modified text
            selectElement.appendChild(option);
        });
    }
};

// Action handlers module
const Actions = {
     /**
     * Mark an asset as lost
     */
    async markAssetAsLost(assetId, assetName) {
        try {
            const result = await API.updateAsset(assetId, { status: 'Lost' });
            
            UI.showStatusMessage(
                'Asset Marked as Lost',
                `${assetName} (${assetId}) has been marked as Lost. This asset will be moved to the Lost Assets report.`,
                'success'
            );

            await loadDiscrepancies();
        } catch (error) {
            UI.showStatusMessage('Error', error.message || 'Failed to mark asset as lost.', 'danger');
        }
    },
    
    /**
     * Mark an asset as found (return to assigned room)
     */
    async markAssetAsFound(assetId, assetName) {
        try {
            const result = await API.updateAsset(assetId, { status: 'Good' });
            
            UI.showStatusMessage(
                'Asset Marked as Found',
                `${assetName} (${assetId}) has been marked as Found and returned to its assigned room.`,
                'success'
            );

            await loadDiscrepancies();
        } catch (error) {
            UI.showStatusMessage('Error', error.message || 'Failed to mark asset as found.', 'danger');
        }
    },
    
    /**
     * Mark an asset as found and relocated to a new room
     */
    async markAssetAsFoundAndRelocated(assetId, assetName, newRoomId, notes) {
        try {
            const result = await API.updateAsset(assetId, { roomId: newRoomId, notes: notes });
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('relocationModal'));
            if (modal) modal.hide();
            
            UI.showStatusMessage(
                'Asset Relocated',
                `${assetName} (${assetId}) has been marked as Found and relocated/reassigned.`,
                'success'
            );

            await loadDiscrepancies();
        } catch (error) {
            UI.showStatusMessage('Error', error.message || 'Failed to relocate/reassign asset.', 'danger');
        }
    },

    
    /**
     * Execute bulk mark found operation
     */
    async executeBulkMarkFound() {
        const assetIds = Array.from(DiscrepancyState.selectedAssets);
        if (assetIds.length === 0) return;

        // Show processing indicator
        const bulkMarkFoundBtn = document.getElementById('bulkMarkFoundBtn');
        const originalBtnText = bulkMarkFoundBtn.innerHTML;
        bulkMarkFoundBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Processing...';
        bulkMarkFoundBtn.disabled = true;

        try {
            const { ok, data } = await API.bulkUpdateAssets('mark_found', assetIds);
            
            // Even with some errors, treat as success if some assets were processed
            if (ok && data) {
                const processedCount = data.processed_count || 0;
                
                if (processedCount > 0) {
                    // Show success message, but note any errors
                    if (data.error_count && data.error_count > 0) {
                        const message = `Successfully marked ${processedCount} of ${assetIds.length} assets as Found. ${data.error_count} assets had issues but may have been partially updated.`;
                        UI.showStatusMessage('Partial Success', message, 'warning');
                    } else {
                        // All successful
                        const message = `All ${processedCount} selected asset(s) marked as Found.`;
                        UI.showStatusMessage('Bulk Action Success', message, 'success');
                    }
                    
                    // Reload the list to show updated status
                    setTimeout(() => {
                        loadDiscrepancies();
                    }, 500);
                } else {
                    // No assets were processed
                    const errorMsg = data.message || `Failed to mark any assets as Found.`;
                    UI.showStatusMessage('Bulk Action Failed', errorMsg, 'danger');
                }
            } else {
                // Server returned an error status
                const errorMsg = data ? data.message : 'Unknown error occurred';
                UI.showStatusMessage('Bulk Action Failed', errorMsg, 'danger');
            }
        } catch (error) {
            UI.showStatusMessage('Error', 'An error occurred during the bulk action. Check the console for details.', 'danger');
        } finally {
            // Restore the button state
            bulkMarkFoundBtn.innerHTML = originalBtnText;
            bulkMarkFoundBtn.disabled = false;
        }
    },
    
    /**
     * Execute bulk relocate operation
     * @param {string} newRoomId - The ID of the destination room
     * @param {string} notes - Optional notes
     */
    async executeBulkRelocate(newRoomId, notes) {
        const assetIds = Array.from(DiscrepancyState.selectedAssets);
        if (assetIds.length === 0 || !newRoomId) return;

        // Show processing state in the button
        const confirmBtn = document.getElementById('confirmRelocationBtn');
        const originalBtnText = confirmBtn.textContent;
        confirmBtn.textContent = 'Processing...';
        confirmBtn.disabled = true;

        try {
            const { ok, data } = await API.bulkUpdateAssets('relocate', assetIds, { 
                roomId: newRoomId, 
                notes: notes 
            });
            
            // Hide modal regardless of outcome
            const modal = bootstrap.Modal.getInstance(document.getElementById('relocationModal'));
            modal.hide();

            if (ok && data) {
                // Even with some errors, treat as success if some assets were processed
                const processedCount = data.processed_count || 0;
                
                if (processedCount > 0) {
                    // Show success message, but note any errors
                    if (data.error_count && data.error_count > 0) {
                        const message = `Successfully relocated ${processedCount} of ${assetIds.length} assets. ${data.error_count} assets had issues but may have been partially updated.`;
                        UI.showStatusMessage('Partial Success', message, 'warning');
                    } else {
                        // All successful
                        const message = `All ${processedCount} selected asset(s) marked as Found and relocated.`;
                        UI.showStatusMessage('Bulk Action Success', message, 'success');
                    }
                    
                    // Reload the list to show updated status
                    setTimeout(() => {
                        loadDiscrepancies();
                    }, 500);
                } else {
                    // No assets were processed
                    const errorMsg = data.message || `Failed to relocate any assets.`;
                    UI.showStatusMessage('Bulk Action Failed', errorMsg, 'danger');
                }
            } else {
                // Server returned an error status
                const errorMsg = data ? data.message : 'Unknown error occurred';
                UI.showStatusMessage('Bulk Action Failed', errorMsg, 'danger');
            }
        } catch (error) {
            UI.showStatusMessage('Error', 'An error occurred during the bulk relocation.', 'danger');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('relocationModal'));
            if (modal) modal.hide();
        } finally {
            // Restore the button state
            confirmBtn.textContent = originalBtnText;
            confirmBtn.disabled = false;
        }
    }
};

/**
 * Load discrepancies from the server
 */
async function loadDiscrepancies() {
    UI.showLoading();
    
    try {
        DiscrepancyState.allDiscrepancies = await API.getDiscrepancies();
        DiscrepancyState.clearSelection();
        UI.renderDiscrepancies(DiscrepancyState.allDiscrepancies);
        UI.updateCounters();
    } catch (error) {
        // Error handling is done in API.getDiscrepancies
    }
}

/**
 * Load all rooms from the server
 */
async function loadRooms() {
    try {
        DiscrepancyState.allRooms = await API.getRooms();
    } catch (error) {
        // Error handling is done in API.getRooms
    }
}

/**
 * Initialize the page
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI
    UI.init();
    
    // Load data
    loadDiscrepancies();
    loadRooms();
});