import datetime
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required
from App.controllers.asset import upload_csv
import io, csv, os
from werkzeug.utils import secure_filename

from App.controllers.building import create_building, get_all_building_json, get_building
from App.controllers.floor import create_floor, get_floor, get_floors_by_building
from App.controllers.room import create_room, get_room, get_rooms_by_floor

import_export_views = Blueprint('import_export_views', __name__, template_folder='../templates')

@import_export_views.route('/api/imports/assets', methods=['POST'])
@jwt_required()
def upload_assets_csv():
    if 'csvFile' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['csvFile']
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
    
    if file and file.filename.endswith('.csv'):
        try:
            os.makedirs('App/uploads', exist_ok=True)
            
            filename = secure_filename(file.filename)
            filepath = os.path.join('App/uploads', filename)
            file.save(filepath)
            
            result = upload_csv(filepath)
            
            if os.path.exists(filepath):
                os.remove(filepath)
            
            if result['success']:
                return jsonify({
                    'success': True, 
                    'message': f"Successfully imported {result['imported']} assets. {result['skipped']} skipped.",
                    'details': result
                })
            else:
                return jsonify({
                    'success': False, 
                    'message': f"Failed to import assets: {result['errors'][0] if result['errors'] else 'Unknown error'}",
                    'details': result
                }), 400
        except Exception as e:
            return jsonify({'success': False, 'message': f'Error processing CSV: {str(e)}'}), 500
    else:
        return jsonify({'success': False, 'message': 'File must be a CSV'}), 400

@import_export_views.route('/api/imports/locations', methods=['POST'])
@jwt_required()
def upload_locations_csv():
    if 'csvFile' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['csvFile']
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
    
    if file and file.filename.endswith('.csv'):
        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            
            buildings_created = 0
            floors_created = 0
            rooms_created = 0
            skipped_rows = 0
            errors = []
            
            processed_buildings = {} 
            processed_floors = {}  
            processed_rooms = {}
            
            for row_num, row in enumerate(csv_reader, start=2):
                try:
                    building_id = row.get('building_id', '').strip()
                    building_name = row.get('building_name', '').strip()
                    floor_id = row.get('floor_id', '').strip()
                    floor_name = row.get('floor_name', '').strip()
                    room_id = row.get('room_id', '').strip()
                    room_name = row.get('room_name', '').strip()
                    
                    if not building_name:
                        errors.append(f"Row {row_num}: Missing building name (required)")
                        skipped_rows += 1
                        continue
                    
                    current_building = None
                    
                    if building_id:
                        existing_building = get_building(building_id)
                        if existing_building:
                            current_building = existing_building
                            
                            if existing_building.building_name != building_name:
                                errors.append(f"Row {row_num}: Building ID {building_id} exists but with name '{existing_building.building_name}' (not '{building_name}')")
                                skipped_rows += 1
                                continue
                        else:
                            current_building = create_building(building_id, building_name)
                            buildings_created += 1
                    else:
                        buildings = get_all_building_json()
                        existing_building = next((b for b in buildings if b['building_name'].lower() == building_name.lower()), None)
                        
                        if existing_building:
                            current_building = get_building(existing_building['building_id'])
                        else:
                            new_building_id = f"B{datetime.now().strftime('%Y%m%d%H%M%S')}"
                            current_building = create_building(new_building_id, building_name)
                            buildings_created += 1
                    
                    processed_buildings[current_building.building_id] = current_building
                    
                    if not floor_name:
                        continue
                    
                    # FLOOR HANDLING
                    current_floor = None
                    
                    if floor_id:
                        existing_floor = get_floor(floor_id)
                        if existing_floor:
                            current_floor = existing_floor
                            
                            if existing_floor.building_id != current_building.building_id:
                                errors.append(f"Row {row_num}: Floor ID {floor_id} exists but belongs to building {existing_floor.building_id} (not {current_building.building_id})")
                                skipped_rows += 1
                                continue
                                
                            if existing_floor.floor_name != floor_name:
                                errors.append(f"Row {row_num}: Floor ID {floor_id} exists but with name '{existing_floor.floor_name}' (not '{floor_name}')")
                                skipped_rows += 1
                                continue
                        else:
                            current_floor = create_floor(floor_id, current_building.building_id, floor_name)
                            floors_created += 1
                    else:
                        floors = get_floors_by_building(current_building.building_id)
                        existing_floor = next((f for f in floors if f.floor_name.lower() == floor_name.lower()), None)
                        
                        if existing_floor:
                            current_floor = existing_floor
                        else:
                            new_floor_id = f"F{datetime.now().strftime('%Y%m%d%H%M%S')}"
                            current_floor = create_floor(new_floor_id, current_building.building_id, floor_name)
                            floors_created += 1
                    
                    processed_floors[current_floor.floor_id] = current_floor
                    
                    if not room_name:
                        continue
                    
                    current_room = None
                    
                    if room_id:
                        existing_room = get_room(room_id)
                        if existing_room:
                            current_room = existing_room
                            
                            if existing_room.floor_id != current_floor.floor_id:
                                errors.append(f"Row {row_num}: Room ID {room_id} exists but belongs to floor {existing_room.floor_id} (not {current_floor.floor_id})")
                                skipped_rows += 1
                                continue
                                
                            if existing_room.room_name != room_name:
                                errors.append(f"Row {row_num}: Room ID {room_id} exists but with name '{existing_room.room_name}' (not '{room_name}')")
                                skipped_rows += 1
                                continue
                        else:
                            current_room = create_room(room_id, current_floor.floor_id, room_name)
                            rooms_created += 1
                    else:
                        rooms = get_rooms_by_floor(current_floor.floor_id)
                        existing_room = next((r for r in rooms if r.room_name.lower() == room_name.lower()), None)
                        
                        if existing_room:
                            current_room = existing_room
                        else:
                            new_room_id = f"R{datetime.now().strftime('%Y%m%d%H%M%S')}"
                            current_room = create_room(new_room_id, current_floor.floor_id, room_name)
                            rooms_created += 1
                    
                    processed_rooms[current_room.room_id] = current_room
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: Error - {str(e)}")
                    skipped_rows += 1
            
            response_data = {
                'success': buildings_created > 0 or floors_created > 0 or rooms_created > 0,
                'message': f'Successfully imported {buildings_created} buildings, {floors_created} floors, and {rooms_created} rooms. {skipped_rows} rows skipped.',
                'buildings_created': buildings_created,
                'floors_created': floors_created,
                'rooms_created': rooms_created,
                'skipped_rows': skipped_rows,
                'errors': errors[:10]
            }
            
            if errors and len(errors) > 10:
                response_data['message'] += f" Showing first 10 of {len(errors)} errors."
            
            return jsonify(response_data)
            
        except Exception as e:
            return jsonify({'success': False, 'message': f'Error processing CSV: {str(e)}'}), 500
    else:
        return jsonify({'success': False, 'message': 'File must be a CSV'}), 400

@import_export_views.route('/api/exports/asset-template', methods=['GET'])
@jwt_required()
def download_asset_template():
    csv_content = io.StringIO()
    writer = csv.writer(csv_content)
    
    writer.writerow(['Item', 'Asset Tag', 'Brand', 'Model', 'Serial Number', 'Location', 'Condition', 'Assignee'])
    
    writer.writerow(['Laptop', 'A001', 'Dell', 'XPS 15', 'SN12345', '1', 'Good', '1'])
    
    csv_content.seek(0)
    return send_file(
        io.BytesIO(csv_content.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='asset_template.csv'
    )

@import_export_views.route('/api/exports/location-template', methods=['GET'])
@jwt_required()
def download_location_template():
    csv_content = io.StringIO()
    writer = csv.writer(csv_content)
    
    writer.writerow(['building_id', 'building_name', 'floor_id', 'floor_name', 'room_id', 'room_name'])
    
    writer.writerow(['B001', 'Main Building', 'F001', '1st Floor', 'R001', 'Room 101'])
    writer.writerow(['B001', 'Main Building', 'F001', '1st Floor', 'R002', 'Room 102'])
    writer.writerow(['B001', 'Main Building', 'F002', '2nd Floor', 'R003', 'Room 201'])
    writer.writerow(['B002', 'Annex Building', 'F003', 'Ground Floor', 'R004', 'Meeting Room'])
    
    writer.writerow(['', 'IT Building', '', '3rd Floor', '', 'Server Room'])
    
    csv_content.seek(0)
    return send_file(
        io.BytesIO(csv_content.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='location_template.csv'
    )