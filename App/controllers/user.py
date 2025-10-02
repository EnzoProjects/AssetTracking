import os
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from App.models import User
from App.database import db
from werkzeug.security import generate_password_hash

def create_user(email, username, password):
    # Check if email already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return None
        
    # Create new user
    new_user = User(email=email, username=username, password=password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return new_user
    except Exception as e:
        db.session.rollback()
        print(f"Error creating user: {e}")
        return None

def get_user_by_username(username):
    return User.query.filter_by(username=username).first()

def get_user_by_email(email):
    return User.query.filter_by(email=email).first()

def get_user(id):
    return User.query.get(id)

def get_all_users():
    return User.query.all()

def get_all_users_json():
    users = User.query.all()
    if not users:
        return []
    users = [user.get_json() for user in users]
    return users

def _update_user_credentials(user, current_password, new_password):
    """Handles only the password change logic."""
    if not new_password:
        return None, 200 # No error, nothing to do
    if not current_password or not user.check_password(current_password):
        return "Current password is incorrect", 401
    user.set_password(new_password)
    return None, 200

def _update_user_details(user, username, email):
    """Handles only the username/email change logic."""
    if username and username != user.username:
        if User.query.filter(User.id != user.id, User.username == username).first():
            return "Username already taken", 409
        user.username = username
    if email and email != user.email:
        if User.query.filter(User.id != user.id, User.email == email).first():
            return "Email already taken", 409
        user.email = email
    return None, 200

# This is your main public-facing controller function
def update_user(user_id, email=None, username=None, current_password=None, new_password=None):
    user = User.query.get(user_id)
    if not user:
        return None, "User not found", 404

    # Call helper functions
    error_msg, status_code = _update_user_credentials(user, current_password, new_password)
    if error_msg:
        return None, error_msg, status_code

    error_msg, status_code = _update_user_details(user, username, email)
    if error_msg:
        return None, error_msg, status_code
        
    try:
        # One single commit for all changes
        db.session.commit()
        return user, None, 200
    except Exception as e:
        db.session.rollback()
        return None, "An internal error occurred", 500

def delete_user(id):
    try:
        user = get_user(id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting user: {e}")
        return False
       
  
def generate_reset_token(email):
    """Generate a secure time-limited token for password reset"""
    secret_key = os.environ.get('SECRET_KEY', 'default-secret-key')
    serializer = URLSafeTimedSerializer(secret_key)
    return serializer.dumps(email, salt='password-reset-salt')

def verify_reset_token(token, expiration=3600):
    """Verify the reset token and return the associated email"""
    secret_key = os.environ.get('SECRET_KEY', 'default-secret-key')
    serializer = URLSafeTimedSerializer(secret_key)
    try:
        email = serializer.loads(
            token,
            salt='password-reset-salt',
            max_age=expiration
        )
        return email
    except (SignatureExpired, BadSignature):
        return None

def reset_password(email, new_password):
    """Reset a user's password using their email"""
    user = get_user_by_email(email)
    if user:
        user.set_password(new_password)
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error resetting password: {e}")
            return False
    return False

