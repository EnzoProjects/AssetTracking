from flask import Blueprint, render_template
from flask_jwt_extended import jwt_required
from App.controllers.asset import get_asset
from App.controllers.assignee import get_assignee_by_id
from App.controllers.room import get_room
from App.controllers.scanevent import get_scans_by_asset
from datetime import datetime

inventory_views = Blueprint('inventory_views', __name__, template_folder='../templates')

@inventory_views.route('/inventory', methods=['GET'])
@jwt_required()
def inventory_page():
    """Renders the main inventory management page."""
    return render_template('inventory.html')

@inventory_views.route('/inventory/asset/<asset_id>', methods=['GET'])
@jwt_required()
def asset_report_page(asset_id):
    """Renders the detailed report page for a single asset."""
    asset = get_asset(asset_id)
    if not asset:
        return render_template('message.html', title="Asset Not Found", message=f"Asset with ID {asset_id} not found.")

    # Enrich asset data for the template
    room_name = get_room(asset.room_id).room_name if asset.room_id and get_room(asset.room_id) else "Unknown"
    last_location_name = get_room(asset.last_located).room_name if asset.last_located and get_room(asset.last_located) else room_name
    assignee_name = str(get_assignee_by_id(asset.assignee_id)) if asset.assignee_id and get_assignee_by_id(asset.assignee_id) else "Unassigned"
    
    # Process scan events
    scan_events = get_scans_by_asset(asset_id)
    enriched_scan_events = []
    for event in scan_events:
        event_dict = event.get_json()
        scan_room = get_room(event.room_id)
        event_dict['room_name'] = scan_room.room_name if scan_room else f"Room {event.room_id}"
        enriched_scan_events.append(event_dict)

    enriched_scan_events.sort(key=lambda e: e.get('scan_time', datetime.min), reverse=True)

    return render_template('asset.html',
                          asset=asset,
                          room_name=room_name,
                          last_location_name=last_location_name,
                          assignee_name=assignee_name,
                          scan_events=enriched_scan_events)