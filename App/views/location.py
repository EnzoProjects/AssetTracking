from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
from App.controllers import (
    create_building, get_building, get_all_building_json, edit_building, delete_building,
    create_floor, get_floors_by_building, update_floor, delete_floor, get_rooms_by_floor,
    create_room, get_rooms_by_floor, update_room, delete_room, get_all_assets_by_room_id
)

location_views = Blueprint('location_views', __name__, template_folder='../templates')

# === BUILDINGS ===
@location_views.route('/api/buildings', methods=['GET'])
@jwt_required()
def get_buildings():
    return jsonify(get_all_building_json())

@location_views.route('/api/buildings', methods=['POST'])
@jwt_required()
def add_building():
    data = request.json
    name = data.get('building_name', '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Building name is required'}), 400
    
    new_id = f"B{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    building = create_building(new_id, name)
    if building:
        return jsonify({'success': True, 'message': 'Building created', 'building': building.get_json()}), 201
    return jsonify({'success': False, 'message': 'Failed to create building'}), 500

@location_views.route('/api/buildings/<building_id>', methods=['PATCH'])
@jwt_required()
def update_building(building_id):
    data = request.json
    name = data.get('building_name', '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Building name is required'}), 400

    building = edit_building(building_id, name)
    if building:
        return jsonify({'success': True, 'message': 'Building updated', 'building': building.get_json()})
    return jsonify({'success': False, 'message': 'Building not found or error updating'}), 404

@location_views.route('/api/buildings/<building_id>', methods=['DELETE'])
@jwt_required()
def remove_building(building_id):
    if get_floors_by_building(building_id):
        return jsonify({'success': False, 'message': 'Cannot delete building with associated floors.'}), 400
    
    if delete_building(building_id):
        return jsonify({'success': True, 'message': 'Building deleted successfully'})
    return jsonify({'success': False, 'message': 'Building not found or failed to delete'}), 404

# === FLOORS ===
@location_views.route('/api/buildings/<building_id>/floors', methods=['GET'])
@jwt_required()
def get_floors(building_id):
    floors = get_floors_by_building(building_id)
    return jsonify([f.get_json() for f in floors])

@location_views.route('/api/floors/<floor_id>', methods=['PATCH'])
@jwt_required()
def edit_floor(floor_id):
    data = request.json
    building_id = data.get('building_id')
    name = data.get('floor_name', '').strip()

    # Ensure at least one field is being updated
    if not building_id and not name:
        return jsonify({'success': False, 'message': 'No update information provided'}), 400

    floor = update_floor(floor_id, building_id, name)
    if floor:
        return jsonify({'success': True, 'message': 'Floor updated', 'floor': floor.get_json()})
    
    return jsonify({'success': False, 'message': 'Floor not found or error updating'}), 404

@location_views.route('/api/floors', methods=['POST'])
@jwt_required()
def add_floor():
    data = request.json
    building_id = data.get('building_id')
    name = data.get('floor_name', '').strip()
    if not all([building_id, name]):
        return jsonify({'success': False, 'message': 'Building ID and floor name are required'}), 400
    
    new_id = f"F{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    floor = create_floor(new_id, building_id, name)
    if floor:
        return jsonify({'success': True, 'message': 'Floor created', 'floor': floor.get_json()}), 201
    return jsonify({'success': False, 'message': 'Failed to create floor, check if building exists'}), 400


# === ROOMS ===
@location_views.route('/api/floors/<floor_id>/rooms', methods=['GET'])
@jwt_required()
def get_rooms(floor_id):
    rooms = get_rooms_by_floor(floor_id)
    return jsonify([r.get_json() for r in rooms])


@location_views.route('/api/rooms', methods=['POST'])
@jwt_required()
def add_room():
    data = request.json
    floor_id = data.get('floor_id')
    name = data.get('room_name', '').strip()
    if not all([floor_id, name]):
        return jsonify({'success': False, 'message': 'Floor ID and room name are required'}), 400

    new_id = f"R{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    room = create_room(new_id, floor_id, name)
    if room:
        return jsonify({'success': True, 'message': 'Room created', 'room': room.get_json()}), 201
    return jsonify({'success': False, 'message': 'Failed to create room, check if floor exists'}), 400

@location_views.route('/api/rooms/<room_id>', methods=['PATCH'])
@jwt_required()
def edit_room(room_id):
    data = request.json
    name = data.get('room_name', '').strip()
    floor_id = data.get('floor_id',' ').strip()

    if not name:
        return jsonify({'success': False, 'message': 'Room name is required'}), 400

    room = update_room(room_id, floor_id, name)
    if room:
        return jsonify({'success': True, 'message': 'Room updated', 'room': room.get_json()})
    return jsonify({'success': False, 'message': 'Room not found or error updating'}), 404
