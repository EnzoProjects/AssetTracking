from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime
import logging

from App.controllers import (
    get_all_assets_json, add_asset, get_asset,
    mark_asset_lost, mark_asset_found, update_asset_location,
    bulk_relocate_assets, mark_assets_missing,
    get_room, get_assignee_by_id, get_or_create_assignee_by_name, add_scan_event
)
from App.controllers.asset import bulk_update_asset_status, update_asset_details
from App.constants import *
from App.utils import enrich_asset_collection, enrich_asset_json

# --- Blueprint Setup ---
asset_views = Blueprint('asset_views', __name__, template_folder='../templates')

# === API Endpoints: Asset Collection ===

@asset_views.route('/api/assets', methods=['GET'])
@jwt_required()
def get_assets_collection():
    """Get the entire collection of assets, enriched with related data."""
    assets = get_all_assets_json()
    return jsonify(enrich_asset_collection(assets))

@asset_views.route('/api/assets', methods=['POST'])
@jwt_required()
def create_asset():
    """Create a new asset."""
    data = request.json
    required_fields = ['id', 'description', 'room_id', 'assignee_name']
    if not all(k in data for k in required_fields):
        return jsonify({
            'success': False, 
            'message': f'Missing required fields: {", ".join(required_fields)}'
        }), 400

    assignee = get_or_create_assignee_by_name(data['assignee_name'])
    if not assignee:
        return jsonify({'success': False, 'message': f'Could not process assignee "{data["assignee_name"]}".'}), 400

    try:
        new_asset = add_asset(
            id=data['id'],
            description=data['description'],
            room_id=data['room_id'],
            assignee_id=assignee.id,
            model=data.get('model'),
            brand=data.get('brand'),
            serial_number=data.get('serial_number'),
            notes=data.get('notes'),
            last_located=data['room_id'],
            last_update=datetime.now()
        )
        if not new_asset:
            return jsonify({'success': False, 'message': f'Asset with ID "{data["id"]}" already exists or Room ID is invalid.'}), 409
        
        # Log the creation event
        add_scan_event(
            asset_id=new_asset.id, user_id=current_user.id, room_id=new_asset.room_id,
            status=new_asset.status, notes=f"Asset created by {current_user.username}"
        )
        return jsonify({'success': True, 'asset': new_asset.get_json()}), 201

    except Exception as e:
        logging.error(f"Error creating asset: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'An internal server error occurred.'}), 500

# === API Endpoints: Single Asset Operations ===

@asset_views.route('/api/assets/<asset_id>', methods=['GET'])
@jwt_required()
def get_single_asset(asset_id):
    """Get a single asset by its ID."""
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({'success': False, 'message': 'Asset not found'}), 404
    
    return jsonify(enrich_asset_json(asset))

@asset_views.route('/api/assets/<asset_id>', methods=['PATCH'])
@jwt_required()
def update_single_asset(asset_id):
    """
    Partially updates a single asset. Dispatches to handler based on request data.
    """
    data = request.json
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({'success': False, 'message': 'Asset not found'}), 404

    if 'roomId' in data:
        return _handle_asset_relocation(asset_id, data)
    elif 'status' in data:
        return _handle_asset_status_change(asset_id, data)
    else:
        core_fields = ['description', 'model', 'brand', 'serial_number', 'assignee_id', 'notes']
        if any(key in data for key in core_fields):
            return _handle_asset_details_update(asset_id, data)
    
    return jsonify({'success': False, 'message': 'No valid update data provided.'}), 400

# --- Private Handler Functions for Single Asset Updates ---

def _handle_asset_relocation(asset_id, data):
    """Handles the logic for relocating an asset."""
    new_room_id = data['roomId']
    notes = data.get('notes', '')
    
    updated_asset = update_asset_location(asset_id, new_room_id, current_user.id, notes)
    if not updated_asset:
        return jsonify({'success': False, 'message': 'Failed to relocate asset.'}), 500
        
    return jsonify({
        'success': True,
        'message': 'Asset relocated successfully',
        'asset': enrich_asset_json(updated_asset)
    })

def _handle_asset_status_change(asset_id, data):
    """Handles logic for changing an asset's status."""
    new_status = data['status']
    
    if new_status == AssetStatus.LOST:
        updated_asset = mark_asset_lost(asset_id, current_user.id)
        message = 'Asset marked as lost'
    elif new_status == AssetStatus.GOOD:
        updated_asset = mark_asset_found(asset_id, current_user.id, return_to_room=True)
        message = 'Asset marked as found and returned to its assigned room'
    else:
        return jsonify({'success': False, 'message': f'Invalid status "{new_status}" provided.'}), 400

    if not updated_asset:
        return jsonify({'success': False, 'message': 'Failed to update asset status.'}), 500
        
    return jsonify({
        'success': True, 
        'message': message, 
        'asset': enrich_asset_json(updated_asset)
    })

def _handle_asset_details_update(asset_id, data):
    """Handles logic for updating core asset details."""
    core_fields_to_update = ['description', 'model', 'brand', 'serial_number', 'assignee_id', 'notes']
    update_data = {key: data[key] for key in core_fields_to_update if key in data}
      
    updated_asset = update_asset_details(asset_id, **update_data)
    if not updated_asset:
        return jsonify({'success': False, 'message': 'Failed to update asset details.'}), 500
        
    add_scan_event(
        asset_id=asset_id, user_id=current_user.id, room_id=updated_asset.room_id,
        status=updated_asset.status, notes=f"Asset details updated by {current_user.username}"
    )
    return jsonify({'success': True, 'message': 'Asset details updated', 'asset': updated_asset.get_json()})

# === API Endpoints: Bulk Asset Operations ===

# Using a dictionary to map actions to functions is a scalable and clean pattern.
def _handle_bulk_mark_found(data):
    asset_ids = data['assetIds']
    notes = data.get('notes', '')
    processed, errors, error_list = bulk_update_asset_status(asset_ids, AssetStatus.GOOD, current_user.id, notes)
    if processed > 0:
        return jsonify({
            'success': True, 'message': f'{processed} asset(s) marked as found.',
            'processed_count': processed, 'error_count': errors, 'errors': error_list[:10]
        })
    return jsonify({'success': False, 'message': 'Failed to mark assets as found.', 'errors': error_list[:10]}), 500

def _handle_bulk_relocate(data):
    asset_ids = data['assetIds']
    notes = data.get('notes', '')
    new_room_id = data.get('roomId')
    if not new_room_id:
        return jsonify({'success': False, 'message': '"roomId" is required for relocate action.'}), 400
    
    processed, errors, error_list = bulk_relocate_assets(asset_ids, new_room_id, current_user.id, notes)
    room = get_room(new_room_id)
    room_name = room.room_name if room else f"Room {new_room_id}"
    
    if errors > 0:
        return jsonify({
            'success': False, 'message': f'Processed {processed} asset(s), but {errors} failed to relocate.',
            'processed_count': processed, 'error_count': errors, 'errors': error_list[:10]
        }), 500
        
    return jsonify({
        'success': True, 'message': f'{processed} asset(s) relocated to {room_name}.',
        'processed_count': processed, 'error_count': 0, 'errors': []
    })

def _handle_bulk_mark_missing(data):
    asset_ids = data['assetIds']
    processed, errors, error_list = mark_assets_missing(asset_ids, current_user.id)
    if processed > 0:
        return jsonify({
            'success': True, 'message': f'{processed} asset(s) marked as missing.',
            'processed_count': processed, 'error_count': errors, 'errors': error_list[:10]
        })
    return jsonify({'success': False, 'message': 'Failed to mark assets as missing.', 'errors': error_list[:10]}), 500

# Action dispatcher map
BULK_ACTION_HANDLERS = {
    BulkAction.MARK_FOUND: _handle_bulk_mark_found,
    BulkAction.RELOCATE: _handle_bulk_relocate,
    BulkAction.MARK_MISSING: _handle_bulk_mark_missing,
}

@asset_views.route('/api/assets', methods=['PATCH'])
@jwt_required()
def bulk_update_assets():
    """Performs bulk updates on assets based on the specified 'action'."""
    data = request.json
    action = data.get('action')
    asset_ids = data.get('assetIds')

    if not all([action, asset_ids, isinstance(asset_ids, list)]):
        return jsonify({'success': False, 'message': 'Request must include "action" and a list of "assetIds".'}), 400

    handler = BULK_ACTION_HANDLERS.get(action)
    if not handler:
        valid_actions = ", ".join(BULK_ACTION_HANDLERS.keys())
        return jsonify({
            'success': False, 
            'message': f'Invalid action "{action}". Valid actions are: {valid_actions}.'
        }), 400
        
    return handler(data)