# Add necessary imports at the top
from App.controllers.room import get_room
from App.controllers.assignee import get_assignee_by_id # Assuming this function exists

def enrich_asset_json(asset):
    """Adds related entity names (room, assignee) to a single asset's JSON representation."""
    if not asset:
        return None
        
    asset_json = asset.get_json()
    
    if asset.room_id:
        room = get_room(asset.room_id)
        asset_json['room_name'] = room.room_name if room else "Unknown Room"
    
    if asset.last_located:
        last_room = get_room(asset.last_located)
        asset_json['last_located_name'] = last_room.room_name if last_room else "Unknown"
    
    if asset.assignee_id:
        assignee = get_assignee_by_id(asset.assignee_id)
        asset_json['assignee_name'] = str(assignee) if assignee else "Unknown Assignee"
    else:
        asset_json['assignee_name'] = "Unassigned"
        
    return asset_json

def enrich_asset_collection(assets):
    """
    Takes a list of Asset MODEL OBJECTS and returns a list of enriched JSON objects.
    This is much more efficient than enriching a list of already-serialized JSON.
    """
    if not assets:
        return []

    # More efficient approach: Fetch all unique room/assignee IDs first
    # For simplicity, we will enrich one by one here, but for performance,
    # a bulk fetch of related entities would be even better.
    
    return [enrich_asset_json(asset) for asset in assets]