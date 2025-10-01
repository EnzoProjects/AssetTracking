from flask import Blueprint, render_template
from flask_jwt_extended import jwt_required

settings_views = Blueprint('settings_views', __name__, template_folder='../templates')

@settings_views.route('/settings', methods=['GET'])
@jwt_required()
def settings_page():
    """Renders the main settings page."""
    return render_template('settings.html')