# blue prints are imported 
# explicitly instead of using *
from .user import user_views
from .index import index_views
from .auth import auth_views
from .audit import audit_views
from .admin import setup_admin
from .inventory import inventory_views
from .discrepancy import discrepancy_views
from .settings import settings_views
from .location import location_views
from .import_export import import_export_views
from .asset import asset_views


views = [user_views, index_views, auth_views, inventory_views, audit_views, 
                        discrepancy_views, settings_views, location_views, import_export_views,
                        asset_views] 
# blueprints must be added to this list