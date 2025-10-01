from flask import Blueprint, render_template, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from App.controllers.building import get_all_building_json
from App.controllers.floor import get_floors_by_building
from App.controllers.room import get_rooms_by_floor, get_room
from App.controllers.asset import (
    get_all_assets, 
    get_all_assets_by_room_json, 
    get_asset, 
    update_asset_location,
    mark_assets_missing
)
from App.controllers.assignee import get_assignee_by_id

audit_views = Blueprint('audit_views', __name__, template_folder='../templates')

@audit_views.route('/audit')
@jwt_required()
def audit_page():
    """Render the audit page with building data"""
    buildings = get_all_building_json()
    return render_template('audit.html', buildings=buildings)

@audit_views.route('/api/floors/<building_id>')
@jwt_required()
def get_floors(building_id):
    """Get all floors for a given building"""
    floors = get_floors_by_building(building_id)
    
    # Handle case with no floors
    if not floors:
        return jsonify([])
        
    floors_json = [floor.get_json() for floor in floors]
    return jsonify(floors_json)

@audit_views.route('/api/rooms/<floor_id>')
@jwt_required()
def get_rooms(floor_id):
    """Get all rooms for a given floor"""
    rooms = get_rooms_by_floor(floor_id)
    
    # Handle case with no rooms
    if not rooms:
        return jsonify([])
        
    rooms_json = [room.get_json() for room in rooms]
    return jsonify(rooms_json)

@audit_views.route('/api/assets/<room_id>')
@jwt_required()
def get_room_assets(room_id):
    """Get all assets for a given room"""
    try:
        room_assets = get_all_assets_by_room_json(room_id)
        
        for asset in room_assets:
            if 'room_id' in asset:
                room = get_room(asset['room_id'])
                if room:
                    asset['room_name'] = room.room_name
            
            if 'last_located' in asset:
                last_room = get_room(asset['last_located'])
                if last_room:
                    asset['last_located_name'] = last_room.room_name
            
            if asset.get('assignee_id'):
                assignee = get_assignee_by_id(asset['assignee_id'])
                if assignee:
                    asset['assignee_name'] = str(assignee) 
                else:
                    asset['assignee_name'] = f"Assignee ID: {asset['assignee_id']}"
            else:
                asset['assignee_name'] = "Unassigned"
        
        return jsonify(room_assets)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@audit_views.route('/api/asset/<asset_id>', methods=['GET'])
@jwt_required()
def get_asset_by_id(asset_id):
    """Get a single asset by ID"""
    asset = get_asset(asset_id)
    
    if not asset:
        return jsonify({'message': 'Asset not found'}), 404
    
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
        if assignee:
            asset_json['assignee_name'] = str(assignee) 
            asset_json['assignee_name'] = f"Assignee ID: {asset.assignee_id}"
    else:
        asset_json['assignee_name'] = "Unassigned"
    
    return jsonify(asset_json)

@audit_views.route('/api/mark-assets-missing', methods=['POST'])
@jwt_required()
def mark_missing():
    """Mark multiple assets as missing"""
    data = request.json
    
    if not data or 'assetIds' not in data:
        return jsonify({
            'success': False, 
            'message': 'Invalid request data: missing assetIds field'
        }), 400
    
    asset_ids = data['assetIds']
    
    if not isinstance(asset_ids, list):
        return jsonify({
            'success': False, 
            'message': 'assetIds must be a list'
        }), 400
    
    processed_count, error_count, errors = mark_assets_missing(asset_ids, current_user.id)
    
    if processed_count == 0:
        return jsonify({
            'success': False,
            'message': f'Failed to mark assets as missing: {errors[0] if errors else "Unknown error"}',
            'errors': errors[:10] if errors else [],
            'processed_count': 0,
            'error_count': error_count
        }), 500
    
    return jsonify({
        'success': True,
        'message': f'{processed_count} assets marked as missing',
        'processed_count': processed_count,
        'error_count': error_count,
        'errors': errors[:10] if errors else []
    })
    
@audit_views.route('/api/update-asset-location', methods=['POST'])
@jwt_required()
def update_location():
    """Update an asset's location"""
    data = request.json
    
    if not data or 'assetId' not in data or 'roomId' not in data:
        return jsonify({'success': False, 'message': 'Invalid request data'}), 400
    
    asset_id = data['assetId']
    room_id = data['roomId']
    
    user_id = current_user.id if current_user else None
    updated_asset = update_asset_location(asset_id, room_id, user_id)
    
    if not updated_asset:
        return jsonify({'success': False, 'message': 'Failed to update asset location'}), 500
    
    asset_json = updated_asset.get_json()
    
    if updated_asset.room_id:
        room = get_room(updated_asset.room_id)
        if room:
            asset_json['room_name'] = room.room_name
            
    if updated_asset.last_located:
        last_room = get_room(updated_asset.last_located)
        if last_room:
            asset_json['last_located_name'] = last_room.room_name
    
    if updated_asset.assignee_id:
        assignee = get_assignee_by_id(updated_asset.assignee_id)
        if assignee:
            asset_json['assignee_name'] = str(assignee)
        else:
            asset_json['assignee_name'] = f"Assignee ID: {updated_asset.assignee_id}"
    else:
        asset_json['assignee_name'] = "Unassigned"
    
    return jsonify({
        'success': True,
        'message': 'Asset location updated',
        'asset': asset_json
    })