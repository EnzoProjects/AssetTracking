from App.models import Floor
from App.database import db
from App.controllers.room import *

def create_floor(floor_id, building_id, floor_name):
    new_floor = Floor(floor_id=floor_id, building_id=building_id, floor_name=floor_name)
    db.session.add(new_floor)
    db.session.commit()
    return new_floor

def get_floor(floor_id):
    return Floor.query.get(floor_id)

def get_floors_by_building(building_id):
    return Floor.query.filter_by(building_id=building_id).all()

def get_all_floors():
    return Floor.query.filter(Floor.floor_id != "DEFAULT").all()

def get_all_floors_json():
    floors=get_all_floors()
    if not floors: return None
    floors = [floor.get_json() for floor in floors]
    return floors

def update_floor(floor_id, building_id=None, floor_name=None):
    floor = get_floor(floor_id)
    if not floor:
        return None

    if building_id:
        floor.building_id = building_id
    
    if floor_name:
        floor.floor_name = floor_name

    try:
        db.session.commit()
        return floor 
    except Exception as e:
        db.session.rollback()
        print(f"Error updating floor: {e}")
        return None

def delete_floor(floor_id):
    floor = get_floor(floor_id)
    if not floor:
        return False  # Floor not found

    try:
        db.session.delete(floor)
        db.session.commit()
        return True  # Floor deleted successfully
    except Exception as e:
        db.session.rollback()
        log.error(f"Error deleting floor: {e}")
        return False

