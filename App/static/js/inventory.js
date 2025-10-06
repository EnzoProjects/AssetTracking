/**
 * Asset Inventory Management
 * Handles loading, filtering, sorting, and managing inventory assets
 */

// Filter state management
const filterState = {
    searchTerm: '',
    statusFilters: new Set(),
    columnFilter: null,
    columnNames: ['description', 'id', 'brandModel', 'location', 'status', 'assignee', 'lastUpdate'],
    
    // Apply filters to the table
    applyFilters: function() {
        handleSearch();
    },
    
    // Add a status filter
    addStatusFilter: function(status) {
        if (this.statusFilters.has(status)) {
            this.statusFilters.delete(status);
        } else {
            this.statusFilters.add(status);
        }
        this.applyFilters();
        this.updateFilterUI();
    },
    
    // Set column to filter on
    setColumnFilter: function(columnIndex) {
        this.columnFilter = this.columnFilter === columnIndex ? null : columnIndex;
        this.applyFilters();
        this.updateFilterUI();
    },
    
    // Reset all filters
    resetFilters: function() {
        this.searchTerm = '';
        this.statusFilters.clear();
        this.columnFilter = null;
        document.getElementById('searchInput').value = '';
        this.applyFilters();
        this.updateFilterUI();
    },
    
    // Update UI to show active filters
    updateFilterUI: function() {
        // Update status filter buttons
        document.querySelectorAll('.status-filter').forEach(button => {
            const status = button.getAttribute('data-status');
            if (this.statusFilters.has(status)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update column filter buttons
        document.querySelectorAll('.column-filter').forEach(button => {
            const column = parseInt(button.getAttribute('data-column'));
            if (this.columnFilter === column) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update filter tags
        this.updateFilterTags();
    },
    
    // Show visual representation of active filters
    updateFilterTags: function() {
        const filterTagsContainer = document.getElementById('activeFilters');
        if (!filterTagsContainer) return;
        
        filterTagsContainer.innerHTML = '';
        
        // Add status filter tags
        this.statusFilters.forEach(status => {
            const tagElement = document.createElement('div');
            tagElement.className = 'active-filter-tag';
            tagElement.innerHTML = `
                <span>Status: ${status}</span>
                <span class="remove-filter" data-filter-type="status" data-filter-value="${status}">×</span>
            `;
            filterTagsContainer.appendChild(tagElement);
        });
        
        // Add column filter tag
        if (this.columnFilter !== null) {
            const columnNames = [
                'Description', 'Asset Tag', 'Brand/Model', 
                'Location', 'Status', 'Assignee', 'Last Update'
            ];
            const tagElement = document.createElement('div');
            tagElement.className = 'active-filter-tag';
            tagElement.innerHTML = `
                <span>Column: ${columnNames[this.columnFilter]}</span>
                <span class="remove-filter" data-filter-type="column">×</span>
            `;
            filterTagsContainer.appendChild(tagElement);
        }
        
        // Add search term tag
        if (this.searchTerm) {
            const tagElement = document.createElement('div');
            tagElement.className = 'active-filter-tag';
            tagElement.innerHTML = `
                <span>Search: "${this.searchTerm}"</span>
                <span class="remove-filter" data-filter-type="search">×</span>
            `;
            filterTagsContainer.appendChild(tagElement);
        }
        
        // Show or hide the filters container
        const filtersContainer = document.getElementById('filtersContainer');
        if (filtersContainer) {
            if (this.statusFilters.size > 0 || this.columnFilter !== null || this.searchTerm) {
                filtersContainer.classList.remove('d-none');
            } else {
                filtersContainer.classList.add('d-none');
            }
        }
    }
};

/**
 * Utility Functions
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            // Handle string date formats
            if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                return dateString.split(' ')[0];
            }
            return dateString;
        }
        
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Date formatting error:", e);
        return dateString;
    }
}

function showLoading(show = true) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

function showMessage(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alertElement);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertElement.parentNode) {
            const bsAlert = new bootstrap.Alert(alertElement);
            bsAlert.close();
        }
    }, 5000);
}

/**
 * API Functions
 */
async function loadAssets() {
    try {
        showLoading(true);
        const response = await fetch('/api/assets');
        if (!response.ok) {
            throw new Error(`Failed to fetch assets: ${response.status} ${response.statusText}`);
        }
        const assets = await response.json();
        displayAssets(assets);
    } catch (error) {
        console.error('Error loading assets:', error);
        document.getElementById('assetTableBody').innerHTML = `
            <tr><td colspan="8" class="text-center">
                <div class="alert alert-danger mb-0">
                    Error loading assets. Please try again later.<br>
                    <small>${error.message}</small>
                </div>
            </td></tr>
        `;
    } finally {
        showLoading(false);
    }
}

async function loadRoomsForModal() {
    const selectElement = document.getElementById('addAssetRoomSelect');
    if (!selectElement) return;
    
    selectElement.innerHTML = '<option value="" selected disabled>Loading rooms...</option>';
    
    try {
        const response = await fetch('/api/rooms');
        if (!response.ok) {
            throw new Error('Failed to fetch rooms');
        }
        
        const rooms = await response.json();
        selectElement.innerHTML = '<option value="" selected disabled>Select Assigned Room *</option>';
        
        if (rooms && rooms.length > 0) {
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.room_id;
                option.textContent = room.room_name;
                selectElement.appendChild(option);
            });
        } else {
            selectElement.innerHTML = '<option value="" selected disabled>No rooms found</option>';
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        selectElement.innerHTML = '<option value="" selected disabled>Error loading rooms</option>';
    }
}

async function saveNewAsset() {
    const form = document.getElementById('addAssetForm');
    const errorDiv = document.getElementById('addAssetError');
    
    // Hide previous error
    if (errorDiv) {
        errorDiv.classList.add('d-none');
        errorDiv.textContent = '';
    }
    
    // Validate form
    const assetId = document.getElementById('addAssetId')?.value.trim();
    const description = document.getElementById('addAssetDescription')?.value.trim();
    const roomId = document.getElementById('addAssetRoomSelect')?.value;
    const assigneeName = document.getElementById('addAssetAssigneeInput')?.value.trim();
    
    if (!assetId || !description || !roomId || !assigneeName) {
        if (errorDiv) {
            errorDiv.textContent = 'Please fill in all required fields (*).';
            errorDiv.classList.remove('d-none');
        }
        return;
    }
    
    const assetData = {
        id: assetId,
        description: description,
        brand: document.getElementById('addAssetBrand')?.value.trim() || '',
        model: document.getElementById('addAssetModel')?.value.trim() || '',
        serial_number: document.getElementById('addAssetSerialNumber')?.value.trim() || '',
        room_id: roomId,
        assignee_name: assigneeName,
        notes: document.getElementById('addAssetNotes')?.value.trim() || '',
    };
    
    // Save button state
    const saveBtn = document.getElementById('saveNewAssetBtn');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    
    try {
        if (saveBtn) {
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
            saveBtn.disabled = true;
        }
        
        const response = await fetch('/api/assets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(assetData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Close modal
            const addModalInstance = bootstrap.Modal.getInstance(document.getElementById('addAssetModal'));
            if (addModalInstance) {
                addModalInstance.hide();
            }
            
            // Show success message
            showMessage(`Asset "${result.asset.description}" (${result.asset.id}) added successfully.`, 'success');
            
            // Reload assets
            loadAssets();
        } else {
            // Show error
            if (errorDiv) {
                errorDiv.textContent = result.message || 'An unknown error occurred.';
                errorDiv.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.error('Error saving asset:', error);
        if (errorDiv) {
            errorDiv.textContent = 'A network or server error occurred. Please try again.';
            errorDiv.classList.remove('d-none');
        }
    } finally {
        // Reset button state
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
}

/**
 * UI Functions
 */
function displayAssets(assets) {
    const tableBody = document.getElementById('assetTableBody');
    if (!tableBody) return;
    
    if (!assets || assets.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="8" class="text-center">
                <div class="py-4">
                    <i class="bi bi-box text-muted" style="font-size: 2rem;"></i>
                    <p class="mt-2 text-muted">No assets found</p>
                </div>
            </td></tr>
        `;
        return;
    }
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Create rows
    assets.forEach(asset => {
        // Extract data
        const description = asset.description || 'Unknown Asset';
        const assetId = asset.id || asset['id:'] || '';
        const roomName = asset.room_name || `Room Id: ${asset.room_id}` || 'N/A';
        const assigneeName = asset.assignee_name || 'Unassigned';
        const brandModel = `${asset.brand || ''} ${asset.model || ''}`.trim() || 'N/A';
        const status = asset.status || 'Unknown';
        const lastUpdate = formatDate(asset.last_update);
        
        // Create row
        const row = document.createElement('tr');
        row.setAttribute('data-asset-id', assetId);
        
        // Set data attributes for filtering
        row.setAttribute('data-description', description.toLowerCase());
        row.setAttribute('data-id', assetId.toLowerCase());
        row.setAttribute('data-brand-model', brandModel.toLowerCase());
        row.setAttribute('data-location', roomName.toLowerCase());
        row.setAttribute('data-status', status.toLowerCase());
        row.setAttribute('data-assignee', assigneeName.toLowerCase());
        row.setAttribute('data-last-update', asset.last_update || '');
        
        // Build row HTML
        row.innerHTML = `
            <td>${description}</td>
            <td>${assetId}</td>
            <td>${brandModel}</td>
            <td>${roomName}</td>
            <td>
                <div class="status-indicator status-${status.toLowerCase()}">
                    <span class="status-dot status-${status.toLowerCase()}"></span>
                    ${status}
                </div>
            </td>
            <td>${assigneeName}</td>
            <td>${lastUpdate}</td>
            <td>
                <a href="/inventory/asset/${assetId}" class="btn btn-sm btn-outline-primary" title="Edit Asset">
                    <i class="bi bi-pencil"></i>
                </a>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Apply any active filters
    if (filterState.searchTerm || filterState.statusFilters.size > 0 || filterState.columnFilter !== null) {
        filterState.applyFilters();
    }
}

function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    filterState.searchTerm = searchTerm;
    
    const rows = document.querySelectorAll('#assetTableBody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        // Skip the "no results" row if it exists
        if (row.id === 'noResultsRow') return;
        
        let shouldDisplay = true;
        
        // Check status filters
        if (filterState.statusFilters.size > 0) {
            const rowStatus = row.getAttribute('data-status');
            if (!filterState.statusFilters.has(rowStatus)) {
                shouldDisplay = false;
            }
        }
        
        // Apply text search if still visible
        if (shouldDisplay && searchTerm) {
            if (filterState.columnFilter !== null) {
                // Search in specific column
                const columnName = filterState.columnNames[filterState.columnFilter];
                const attributeName = `data-${columnName.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                const cellValue = row.getAttribute(attributeName) || '';
                
                if (!cellValue.includes(searchTerm)) {
                    shouldDisplay = false;
                }
            } else {
                // Search across all text content
                const rowText = row.textContent.toLowerCase();
                if (!rowText.includes(searchTerm)) {
                    shouldDisplay = false;
                }
            }
        }
        
        // Update visibility
        row.style.display = shouldDisplay ? '' : 'none';
        
        if (shouldDisplay) {
            visibleCount++;
        }
    });
    
    // Show or hide "no results" message
    const tableBody = document.getElementById('assetTableBody');
    if (tableBody) {
        let noResultsRow = document.getElementById('noResultsRow');
        
        if (visibleCount === 0) {
            if (!noResultsRow) {
                noResultsRow = document.createElement('tr');
                noResultsRow.id = 'noResultsRow';
                noResultsRow.innerHTML = `
                    <td colspan="8" class="text-center py-4">
                        <i class="bi bi-search text-muted" style="font-size: 2rem;"></i>
                        <p class="mt-2 text-muted">No assets match your search criteria</p>
                        <button class="btn btn-sm btn-outline-secondary mt-2" onclick="filterState.resetFilters()">
                            <i class="bi bi-x-circle me-1"></i> Clear Filters
                        </button>
                    </td>
                `;
                tableBody.appendChild(noResultsRow);
            } else {
                noResultsRow.style.display = '';
            }
        } else if (noResultsRow) {
            noResultsRow.style.display = 'none';
        }
    }
    
    // Update filter UI
    filterState.updateFilterUI();
    
    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        resultsCount.textContent = `${visibleCount} asset${visibleCount !== 1 ? 's' : ''} found`;
    }
}

function sortTable(columnIndex) {
    const table = document.querySelector('.inventory-table table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr:not(#noResultsRow)'));
    if (rows.length === 0) return;
    
    // Update sort icons
    const icons = table.querySelectorAll('th i.bi');
    icons.forEach((icon, index) => {
        if (index !== columnIndex) {
            icon.classList.remove('bi-sort-up');
            icon.classList.add('bi-sort-down');
        }
    });
    
    const icon = icons[columnIndex];
    const isCurrentlyAscending = icon.classList.contains('bi-sort-up');
    const isAscending = !isCurrentlyAscending;
    
    // Update icon
    if (isAscending) {
        icon.classList.remove('bi-sort-down');
        icon.classList.add('bi-sort-up');
    } else {
        icon.classList.remove('bi-sort-up');
        icon.classList.add('bi-sort-down');
    }
    
    // Sort rows
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();
        
        // Special handling for date columns
        if (columnIndex === 6) { // Last update
            const dateA = new Date(aValue);
            const dateB = new Date(bValue);
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return isAscending ? dateA - dateB : dateB - dateA;
            }
        }
        
        // Default string comparison
        return isAscending
            ? aValue.localeCompare(bValue, undefined, {numeric: true, sensitivity: 'base'})
            : bValue.localeCompare(aValue, undefined, {numeric: true, sensitivity: 'base'});
    });
    
    // Preserve the "no results" row
    const noResultsRow = document.getElementById('noResultsRow');
    if (noResultsRow && noResultsRow.parentNode === tbody) {
        tbody.removeChild(noResultsRow);
    }
    
    // Reorder rows
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
    
    // Re-add the "no results" row if needed
    if (noResultsRow) {
        tbody.appendChild(noResultsRow);
    }
}

function clearAddAssetForm() {
    const form = document.getElementById('addAssetForm');
    if (form) form.reset();
    
    const errorDiv = document.getElementById('addAssetError');
    if (errorDiv) {
        errorDiv.classList.add('d-none');
        errorDiv.textContent = '';
    }
}

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterState.searchTerm = searchInput.value.toLowerCase();
        });
        
        searchInput.addEventListener('keyup', event => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    // Search button
    const searchButton = document.querySelector('.search-button');
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }
    
    // Status filter buttons
    document.querySelectorAll('.status-filter').forEach(button => {
        button.addEventListener('click', () => {
            const status = button.getAttribute('data-status');
            filterState.addStatusFilter(status);
        });
    });
    
    // Column filter buttons
    document.querySelectorAll('.column-filter').forEach(button => {
        button.addEventListener('click', () => {
            const column = parseInt(button.getAttribute('data-column'));
            filterState.setColumnFilter(column);
        });
    });
    
    // Reset filters button
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filterState.resetFilters();
        });
    }
    
    // Active filters container - delegate event handling
    const activeFiltersContainer = document.getElementById('activeFilters');
    if (activeFiltersContainer) {
        activeFiltersContainer.addEventListener('click', event => {
            const target = event.target;
            if (target.classList.contains('remove-filter')) {
                const filterType = target.getAttribute('data-filter-type');
                const filterValue = target.getAttribute('data-filter-value');
                
                if (filterType === 'status' && filterValue) {
                    filterState.addStatusFilter(filterValue); // Toggle off
                } else if (filterType === 'column') {
                    filterState.setColumnFilter(filterState.columnFilter); // Toggle off
                } else if (filterType === 'search') {
                    filterState.searchTerm = '';
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) searchInput.value = '';
                    filterState.applyFilters();
                    filterState.updateFilterUI();
                }
            }
        });
    }
    
    // Modal events
    const addAssetModal = document.getElementById('addAssetModal');
    if (addAssetModal) {
        addAssetModal.addEventListener('show.bs.modal', loadRoomsForModal);
        addAssetModal.addEventListener('hidden.bs.modal', clearAddAssetForm);
    }
    
    // Save asset button
    const saveBtn = document.getElementById('saveNewAssetBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveNewAsset);
    }
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAssets();
});