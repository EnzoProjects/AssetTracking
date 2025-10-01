from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from App.controllers import (
    get_asset,
    mark_asset_lost,
    mark_asset_found,
    update_asset_location,
    bulk_mark_assets_found,
    bulk_relocate_assets,
    mark_assets_missing,
    get_room,
    get_assignee_by_id
)

asset_views = Blueprint('asset_views', __name__, template_folder='../templates')

def enrich_asset_json(asset):
    """Helper function to add related names (room, assignee) to asset JSON."""
    if not asset:
        return None
    asset_json = asset.get_json()
    
    if asset.room_id:
        room = get_room(asset.room_id)
        if room:
            asset_json['room_name'] = room.room_name
    
    if asset.last_located:
        last_room = get_room(asset.last_located)
        if last_room:
            asset_json['last_located_name'] = last_room.room_name
    
    if asset.assignee_id:
        assignee = get_assignee_by_id(asset.assignee_id)
        asset_json['assignee_name'] = str(assignee) if assignee else "Unknown Assignee"
    else:
        asset_json['assignee_name'] = "Unassigned"
        
    return asset_json

# === SINGLE ASSET OPERATIONS ===

@asset_views.route('/api/assets/<asset_id>', methods=['GET'])
@jwt_required()
def get_single_asset(asset_id):
    """RESTful: Get a single asset by its ID"""
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({'success': False, 'message': 'Asset not found'}), 404
    
    return jsonify(enrich_asset_json(asset))

@asset_views.route('/api/assets/<asset_id>', methods=['PATCH'])
@jwt_required()
def update_single_asset(asset_id):
    """
    RESTful: Partially update a single asset.
    This endpoint handles all single-asset updates:
    - Relocating (changing roomId)
    - Marking as lost/found (changing status)
    """
    data = request.json
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({'success': False, 'message': 'Asset not found'}), 404

    # Action 1: Relocate the asset
    if 'roomId' in data:
        new_room_id = data['roomId']
        user_notes = data.get('notes', '')
        updated_asset = update_asset_location(asset_id, new_room_id, current_user.id, user_notes)
        if not updated_asset:
            return jsonify({'success': False, 'message': 'Failed to relocate asset.'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Asset relocated successfully',
            'asset': enrich_asset_json(updated_asset)
        })

    # Action 2: Change the asset's status
    if 'status' in data:
        new_status = data['status']
        if new_status == 'Lost':
            updated_asset = mark_asset_lost(asset_id, current_user.id)
            message = 'Asset marked as lost'
        elif new_status == 'Good':
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
        
    return jsonify({'success': False, 'message': 'No valid update data provided (e.g., "roomId" or "status").'}), 400

# === BULK (COLLECTION) ASSET OPERATIONS ===

@asset_views.route('/api/assets', methods=['PATCH'])
@jwt_required()
def bulk_update_assets():
    """
    RESTful: Perform bulk partial updates on the assets collection.
    The 'action' field in the request body determines the operation.
    """
    data = request.json
    action = data.get('action')
    asset_ids = data.get('assetIds')
    notes = data.get('notes', '')

    if not all([action, asset_ids, isinstance(asset_ids, list)]):
        return jsonify({'success': False, 'message': 'Invalid input. "action", and "assetIds" (list) are required.'}), 400

    # Action 1: Bulk Mark Found
    if action == 'mark_found':
        processed, errors, error_list = bulk_mark_assets_found(asset_ids, current_user.id, notes)
        if processed > 0:
            return jsonify({
                'success': True, 'message': f'{processed} asset(s) marked as found.',
                'processed_count': processed, 'error_count': errors, 'errors': error_list[:10]
            })
        return jsonify({'success': False, 'message': 'Failed to mark assets as found.', 'errors': error_list[:10]}), 500
    
    # Action 2: Bulk Relocate
    elif action == 'relocate':
        new_room_id = data.get('roomId')
        if not new_room_id:
            return jsonify({'success': False, 'message': '"roomId" is required for relocate action.'}), 400
        
        processed, errors, error_list = bulk_relocate_assets(asset_ids, new_room_id, current_user.id, notes)
        room_name = get_room(new_room_id).room_name if get_room(new_room_id) else f"Room {new_room_id}"
        if errors == 0:
            return jsonify({'success': True, 'message': f'{processed} asset(s) relocated to {room_name}.'})
        return jsonify({
            'success': False, 'message': f'Processed {processed} asset(s), but {errors} failed.',
            'errors': error_list[:10]
        }), 500

    # Action 3: Bulk Mark Missing
    elif action == 'mark_missing':
        processed, errors, error_list = mark_assets_missing(asset_ids, current_user.id)
        if processed > 0:
            return jsonify({
                'success': True, 'message': f'{processed} asset(s) marked as missing.',
                'processed_count': processed, 'error_count': errors, 'errors': error_list[:10]
            })
        return jsonify({'success': False, 'message': 'Failed to mark assets as missing.', 'errors': error_list[:10]}), 500
            
    return jsonify({'success': False, 'message': f'Invalid action "{action}". Valid actions: "mark_found", "relocate", "mark_missing".'}), 400