class AssetStatus:
    GOOD = "Good"
    MISPLACED = "Misplaced"
    UNASSIGNED = "Unassigned"
    MISSING = "Missing"
    LOST = "Lost"
    FOUND = "Found" # This might be a transient status, but included if used.

class BulkAction:
    MARK_FOUND = 'mark_found'
    RELOCATE = 'relocate'
    MARK_MISSING = 'mark_missing'
