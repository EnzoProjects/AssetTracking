from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from App.database import db
from App.controllers import (
    get_asset,
    mark_asset_lost,
    mark_asset_found,
    update_asset_location,
    bulk_mark_assets_found,
    bulk_relocate_assets,
    get_room,
    add_scan_event
)
from datetime import datetime

asset_views = Blueprint('asset_views', __name__, template_folder='../templates')

@asset_views.route('/api/assets/<asset_id>', methods=['PATCH'])
@jwt_required()
def update_asset(asset_id):
    """
    API endpoint to partially update an asset.
    This handles marking as lost, found, and relocating.
    """
    data = request.json
    
    asset = get_asset(asset_id)
    if not asset:
        return jsonify({'success': False, 'message': 'Asset not found'}), 404

    # Handle status change: marking as lost or found
    if 'status' in data:
        new_status = data['status']
        if new_status == 'Lost':
            updated_asset = mark_asset_lost(asset_id, current_user.id)
            if not updated_asset:
                return jsonify({'success': False, 'message': 'Failed to mark asset as lost.'}), 500
            return jsonify({
                'success': True, 
                'message': 'Asset marked as lost', 
                'asset': updated_asset.get_json()
            })
        
        elif new_status == 'Good':
            # Check if this is a simple "mark found" or a relocation
            if 'roomId' not in data:
                updated_asset = mark_asset_found(asset_id, current_user.id, return_to_room=True)
                if not updated_asset:
                    return jsonify({'success': False, 'message': 'Failed to mark asset as found.'}), 500
                return jsonify({
                    'success': True,
                    'message': 'Asset marked as found and returned to its assigned room',
                    'asset': updated_asset.get_json()
                })
        else:
            return jsonify({'success': False, 'message': f'Invalid status "{new_status}" provided.'}), 400

    # Handle relocation (which also marks an asset as "Good")
    if 'roomId' in data:
        new_room_id = data['roomId']
        user_notes = data.get('notes', '')
        
        updated_asset = update_asset_location(asset_id, new_room_id, current_user.id, user_notes)
        if not updated_asset:
             return jsonify({'success': False, 'message': 'Failed to relocate asset.'}), 500
        
        room = get_room(new_room_id)
        room_name = room.room_name if room else f"Room {new_room_id}"
        return jsonify({
            'success': True,
            'message': f'Asset successfully updated and assigned to {room_name}',
            'asset': updated_asset.get_json()
        })
        
    return jsonify({'success': False, 'message': 'No valid update data provided (e.g., "status" or "roomId").'}), 400


@asset_views.route('/api/assets', methods=['PATCH'])
@jwt_required()
def bulk_update_assets():
    """
    API endpoint for bulk updating assets.
    Distinguishes actions via an 'action' field in the body.
    """
    data = request.json
    action = data.get('action')
    asset_ids = data.get('assetIds')
    notes = data.get('notes', '')

    if not all([action, asset_ids, isinstance(asset_ids, list)]):
        return jsonify({'success': False, 'message': 'Invalid input. "action", and "assetIds" (list) are required.'}), 400

    # Bulk Mark Found Action
    if action == 'mark_found':
        processed, errors, error_list = bulk_mark_assets_found(asset_ids, current_user.id, notes)
        if processed > 0:
            return jsonify({
                'success': True,
                'message': f'{processed} asset(s) marked as found.',
                'processed_count': processed,
                'error_count': errors,
                'errors': error_list[:10]
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to mark assets as found.',
                'errors': error_list[:10]
            }), 500
    
    # Bulk Relocate Action
    elif action == 'relocate':
        new_room_id = data.get('roomId')
        if not new_room_id:
            return jsonify({'success': False, 'message': '"roomId" is required for relocate action.'}), 400
            
        processed, errors, error_list = bulk_relocate_assets(asset_ids, new_room_id, current_user.id, notes)
        if errors == 0:
            room_name = get_room(new_room_id).room_name if get_room(new_room_id) else f"Room {new_room_id}"
            return jsonify({
                'success': True,
                'message': f'{processed} asset(s) relocated to {room_name}.'
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Processed {processed} asset(s), but {errors} failed.',
                'errors': error_list[:10]
            }), 500
            
    return jsonify({'success': False, 'message': f'Invalid action "{action}". Valid actions are "mark_found", "relocate".'}), 400