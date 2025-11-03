"""
Controllers for managing assets, including CRUD operations, CSV imports,
and bulk actions like marking assets as missing, found, or relocated.
"""

from datetime import datetime, timedelta
import csv
from flask_jwt_extended import current_user
from sqlalchemy.exc import IntegrityError
from App.database import db
from App.models import Asset, Room, ScanEvent, User # Assuming User model exists for type hinting
from App.controllers.room import get_room
from App.controllers.scanevent import add_scan_event
from App.constants import AssetStatus

# --- Helper Functions ---

def _get_current_user_id() -> str:
    """Gets the current user's ID or returns a system default."""
    if current_user:
        return current_user.id
    return "SYSTEM"

def _create_scan_event(asset_id: str, user_id: str, room_id: str, status: str, notes: str) -> ScanEvent | None:
    """Helper to create a scan event and handle potential errors."""
    try:
        return add_scan_event(
            asset_id=asset_id,
            user_id=user_id,
            room_id=room_id,
            status=status,
            notes=notes
        )
    except Exception as e:
        print(f"Warning: Failed to create scan event for asset {asset_id}. Error: {e}")
        return None

# --- Core Asset Controllers ---

def get_asset(asset_id: str) -> Asset | None:
    """Retrieves an asset by its ID."""
    return Asset.query.get(asset_id) # .get() is optimized for primary key lookups

def get_all_assets() -> list[Asset]:
    """Retrieves all assets."""
    return Asset.query.all()

def get_all_assets_by_room_id(room_id: str) -> list[Asset]:
    """Retrieves all assets assigned to a specific room."""
    return Asset.query.filter_by(room_id=room_id).all()

def get_all_assets_json() -> list[dict]:
    """Retrieves all assets in JSON format."""
    assets = get_all_assets()
    return [asset.get_json() for asset in assets]

def get_all_assets_by_room_json(room_id: str) -> list[dict]:
    """Retrieves all assets for a room in JSON format."""
    assets = get_all_assets_by_room_id(room_id)
    return [asset.get_json() for asset in assets]

def add_asset(**kwargs) -> Asset | None:
    """
    Adds a new asset to the database.
    Accepts keyword arguments matching the Asset model.
    """
    asset_id = kwargs.get('id')
    room_id = kwargs.get('room_id')

    # Validate that the assigned room exists, otherwise assign to UNKNOWN
    if not get_room(room_id):
        print(f"Warning: Room '{room_id}' not found for asset '{asset_id}'. Assigning to UNKNOWN.")
        kwargs['room_id'] = "UNKNOWN"
        kwargs['last_located'] = "UNKNOWN"
        kwargs['status'] = AssetStatus.UNASSIGNED
    else:
        # Determine status based on location
        if kwargs.get('last_located') == room_id:
            kwargs['status'] = AssetStatus.GOOD
        else:
            kwargs['status'] = AssetStatus.MISPLACED
            
    # Ensure last_update is set
    kwargs.setdefault('last_update', datetime.now())

    new_asset = Asset(**kwargs)
    db.session.add(new_asset)

    try:
        db.session.commit()
        return new_asset
    except IntegrityError:
        db.session.rollback()
        print(f"Error: Asset with ID '{asset_id}' already exists.")
        return None
    except Exception as e:
        db.session.rollback()
        print(f"Error adding asset '{asset_id}': {e}")
        return None

def update_asset_location(asset_id: str, new_location_id: str, user_id: str = None) -> Asset | None:
    """Updates an asset's last known location and creates a scan event."""
    asset = get_asset(asset_id)
    if not asset:
        print(f"Error: Asset '{asset_id}' not found for location update.")
        return None

    user_id = user_id or _get_current_user_id()
    old_status = asset.status
    old_location_id = asset.last_located

    # No change in location
    if old_location_id == new_location_id:
        return asset

    asset.last_located = new_location_id
    asset.last_update = datetime.now()
    asset.status = AssetStatus.GOOD if asset.room_id == new_location_id else AssetStatus.MISPLACED

    # Create descriptive notes for the scan event
    old_room_name = get_room(old_location_id).room_name if get_room(old_location_id) else f"ID {old_location_id}"
    new_room_name = get_room(new_location_id).room_name if get_room(new_location_id) else f"ID {new_location_id}"
    notes = f"Asset found in {new_room_name} (moved from {old_room_name}). Status changed from {old_status} to {asset.status}."

    _create_scan_event(asset_id, user_id, new_location_id, asset.status, notes)

    try:
        db.session.commit()
        return asset
    except Exception as e:
        db.session.rollback()
        print(f"Error committing location update for asset '{asset_id}': {e}")
        return None
    
def update_asset_details(asset_id: str, **update_data) -> Asset | None:
    """
    Updates the non-status, non-location details of an asset.
    Accepts a dictionary of fields to update via keyword arguments.
    
    Args:
        asset_id: The ID of the asset to update.
        **update_data: Keyword arguments where the key is the attribute
                       to update (e.g., description, model, notes).

    Returns:
        The updated Asset object if successful, None otherwise.
    """
    asset = get_asset(asset_id)
    if not asset:
        print(f"Error: Asset '{asset_id}' not found for detail update.")
        return None

    # Define which fields are allowed to be updated through this function
    # This prevents accidental changes to controlled fields like 'status' or 'room_id'.
    updatable_fields = [
        'description',
        'model',
        'brand',
        'serial_number',
        'assignee_id',
        'notes'
    ]

    # Iterate through the provided data and update the asset object
    for field, value in update_data.items():
        if field in updatable_fields:
            setattr(asset, field, value)
        else:
            print(f"Warning: Attempted to update non-updatable field '{field}'. Ignoring.")

    # Always update the timestamp when any change is made
    asset.last_update = datetime.now()

    try:
        # A scan event is not typically needed for a simple detail change,
        # but you could add an audit log entry here if desired.
        db.session.commit()
        return asset
    except Exception as e:
        db.session.rollback()
        print(f"Error committing detail update for asset '{asset_id}': {e}")
        return None


def delete_asset(asset_id: str) -> tuple[bool, str]:
    """Deletes an asset and its associated scan history."""
    asset = get_asset(asset_id)
    if not asset:
        return False, f"Asset '{asset_id}' not found."

    try:
        # Cascade delete is often better handled by the database schema,
        # but explicit deletion is safer if not configured.
        ScanEvent.query.filter_by(asset_id=asset_id).delete()
        db.session.delete(asset)
        db.session.commit()
        return True, f"Asset '{asset_id}' and its scan history were successfully deleted."
    except Exception as e:
        db.session.rollback()
        return False, f"Failed to delete asset '{asset_id}'. Error: {e}"

# --- CSV Import ---

def upload_csv(file_path: str) -> dict:
    """Imports assets from a CSV file."""
    results = {'total': 0, 'imported': 0, 'skipped': 0, 'errors': []}
    expected_columns = ["Asset Tag", "Item", "Location"]
    
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            actual_columns = [col.strip() for col in reader.fieldnames or []]

            if not all(col in actual_columns for col in expected_columns):
                missing = [col for col in expected_columns if col not in actual_columns]
                results['errors'].append(f"Missing required columns: {', '.join(missing)}")
                return results

            for row_num, row in enumerate(reader, 2):
                results['total'] += 1
                try:
                    asset_data = {key.strip(): val.strip() for key, val in row.items()}
                    asset_id = asset_data.get('Asset Tag')
                    
                    if not asset_id or not asset_data.get('Item'):
                        results['errors'].append(f"Row {row_num}: Skipped due to missing Asset Tag or Item description.")
                        results['skipped'] += 1
                        continue

                    new_asset = add_asset(
                        id=asset_id,
                        description=asset_data.get('Item'),
                        model=asset_data.get('Model'),
                        brand=asset_data.get('Brand'),
                        serial_number=asset_data.get('Serial Number'),
                        room_id=asset_data.get('Location'),
                        last_located=asset_data.get('Location'),
                        assignee_id=asset_data.get('Assignee')
                    )

                    if new_asset:
                        # Override status if a specific condition is provided in the CSV
                        condition = asset_data.get('Condition')
                        if condition and condition not in [AssetStatus.GOOD, AssetStatus.MISPLACED]:
                            new_asset.status = condition
                            db.session.commit()
                        results['imported'] += 1
                    else:
                        results['errors'].append(f"Row {row_num}: Asset Tag '{asset_id}' already exists or failed to add.")
                        results['skipped'] += 1

                except Exception as e:
                    results['errors'].append(f"Row {row_num}: An unexpected error occurred: {e}")
                    results['skipped'] += 1
                    db.session.rollback() # Ensure rollback on row-level error

    except FileNotFoundError:
        results['errors'].append("CSV file not found.")
    except Exception as e:
        results['errors'].append(f"An error occurred while processing the file: {e}")

    return results

# --- Status-Based Retrieval ---

def get_assets_by_status(status: str) -> list[dict]:
    """Retrieves all assets with a given status in JSON format."""
    assets = Asset.query.filter_by(status=status).all()
    return [asset.get_json() for asset in assets]

def get_discrepant_assets() -> list[dict]:
    """Retrieves all 'Missing' or 'Misplaced' assets in JSON format."""
    discrepant_statuses = [AssetStatus.MISSING, AssetStatus.MISPLACED]
    assets = Asset.query.filter(Asset.status.in_(discrepant_statuses)).all()
    return [asset.get_json() for asset in assets]

# --- Single Asset Status Changes ---

def mark_asset_lost(asset_id: str, user_id: str = None) -> Asset | None:
    """Marks a single asset as Lost and records a scan event."""
    asset = get_asset(asset_id)
    if not asset:
        print(f"Error: Asset '{asset_id}' not found.")
        return None
    
    if asset.status == AssetStatus.LOST:
        return asset # No change needed

    user_id = user_id or _get_current_user_id()
    old_status = asset.status
    asset.status = AssetStatus.LOST
    asset.last_update = datetime.now()
    
    notes = f"Asset marked as Lost. Previous status: {old_status}."
    _create_scan_event(asset_id, user_id, asset.room_id, asset.status, notes)

    try:
        db.session.commit()
        return asset
    except Exception as e:
        db.session.rollback()
        print(f"Error committing 'Lost' status for asset '{asset_id}': {e}")
        return None

def mark_asset_found(asset_id: str, user_id: str = None, reassign_to_current_location: bool = False) -> Asset | None:
    """
    Marks a found asset as 'Good'.
    - By default, it's marked as returned to its assigned room.
    - If reassign_to_current_location is True, its assigned room is updated to where it was found.
    """
    asset = get_asset(asset_id)
    if not asset:
        print(f"Error: Asset '{asset_id}' not found.")
        return None

    user_id = user_id or _get_current_user_id()
    old_status = asset.status
    action_desc = ""

    if reassign_to_current_location:
        asset.room_id = asset.last_located
        action_desc = f"reassigned to its current location ({get_room(asset.room_id).room_name if get_room(asset.room_id) else asset.room_id})"
    else:
        asset.last_located = asset.room_id
        action_desc = "returned to its assigned room"
    
    asset.status = AssetStatus.GOOD
    asset.last_update = datetime.now()

    notes = f"Asset marked as Found and {action_desc}. Previous status: {old_status}."
    _create_scan_event(asset_id, user_id, asset.room_id, asset.status, notes)

    try:
        db.session.commit()
        return asset
    except Exception as e:
        db.session.rollback()
        print(f"Error committing 'Found' status for asset '{asset_id}': {e}")
        return None

# --- Bulk Action Controllers ---

def bulk_update_asset_status(asset_ids: list[str], new_status: str, user_id: str, notes_template: str) -> tuple[int, int, list]:
    """
    Generic helper to bulk-update asset statuses.
    `notes_template` can use placeholders like {old_status}.
    """
    processed_count, error_count, errors = 0, 0, []
    user_id = user_id or _get_current_user_id()
    
    assets = Asset.query.filter(Asset.id.in_(asset_ids)).all()
    asset_map = {asset.id: asset for asset in assets}

    for asset_id in asset_ids:
        asset = asset_map.get(asset_id)
        if not asset:
            errors.append(f"Asset '{asset_id}' not found.")
            error_count += 1
            continue
        
        if asset.status == new_status:
            continue # No change needed

        old_status = asset.status
        asset.status = new_status
        asset.last_update = datetime.now()
        
        notes = notes_template.format(old_status=old_status)
        _create_scan_event(asset_id, user_id, asset.room_id, new_status, notes)
        processed_count += 1
    
    if processed_count > 0:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return 0, len(asset_ids), [f"Database commit error: {e}"]
            
    return processed_count, error_count, errors

def mark_assets_missing(asset_ids: list[str], user_id: str = None, misplaced_threshold_days: int = 30) -> tuple[int, int, list]:
    """Marks a list of assets as 'Missing' after an audit."""
    processed_count, error_count, errors = 0, 0, []
    user_id = user_id or _get_current_user_id()
    threshold_date = datetime.now() - timedelta(days=misplaced_threshold_days)
    
    assets = Asset.query.filter(Asset.id.in_(asset_ids)).all()

    for asset in assets:
        if asset.status == AssetStatus.LOST:
            errors.append(f"Asset {asset.id} is already Lost, skipping.")
            error_count += 1
            continue

        if asset.status == AssetStatus.MISPLACED and asset.last_update >= threshold_date:
            errors.append(f"Asset {asset.id} was recently misplaced, skipping.")
            error_count += 1
            continue
        
        old_status = asset.status
        asset.status = AssetStatus.MISSING
        asset.last_update = datetime.now()
        
        notes = f"Audit complete: Asset marked as Missing. Previous status: {old_status}."
        _create_scan_event(asset.id, user_id, asset.room_id, AssetStatus.MISSING, notes)
        processed_count += 1
    
    if processed_count > 0:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return 0, len(asset_ids), [f"Database commit error: {e}"]
            
    return processed_count, error_count, errors

def bulk_relocate_assets(asset_ids: list[str], new_room_id: str, user_id: str = None, notes: str = "") -> tuple[int, int, list]:
    """Relocates and reassigns multiple assets to a new room, marking them as 'Good'."""
    processed_count, error_count, errors = 0, 0, []
    user_id = user_id or _get_current_user_id()

    target_room = get_room(new_room_id)
    if not target_room:
        return 0, len(asset_ids), [f"Target room '{new_room_id}' not found."]

    assets_to_update = Asset.query.filter(Asset.id.in_(asset_ids)).all()
    
    for asset in assets_to_update:
        old_status = asset.status
        old_room_name = get_room(asset.room_id).room_name if get_room(asset.room_id) else asset.room_id

        asset.room_id = new_room_id
        asset.last_located = new_room_id
        asset.status = AssetStatus.GOOD
        asset.last_update = datetime.now()
        
        scan_note = f"Bulk Relocate: Moved from {old_room_name} to {target_room.room_name}. Previous status: {old_status}."
        if notes:
            scan_note += f" Note: {notes}"
            
        _create_scan_event(asset.id, user_id, new_room_id, AssetStatus.GOOD, scan_note)
        processed_count += 1
    
    if processed_count > 0:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return 0, processed_count, [f"Database commit error: {e}"]
            
    # Calculate errors for assets not found
    found_ids = {asset.id for asset in assets_to_update}
    for asset_id in asset_ids:
        if asset_id not in found_ids:
            errors.append(f"Asset '{asset_id}' not found.")
            error_count += 1
            
    return processed_count, error_count, errors