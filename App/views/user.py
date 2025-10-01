from flask import Blueprint, render_template, jsonify, request, send_from_directory, flash, redirect, url_for
from flask_jwt_extended import jwt_required, current_user

from App.controllers.user import (
    create_user,
    get_all_users,
    get_all_users_json,
    get_user_by_email,
    delete_user,
    update_user
)

user_views = Blueprint('user_views', __name__, template_folder='../templates')


'''
UI Page Routes
- These routes handle form submissions, render templates, and are not part of the REST API.
'''

@user_views.route('/users', methods=['GET'])
def get_user_page():
    """Renders the user management page for the web UI."""
    users = get_all_users()
    return render_template('users.html', users=users)

@user_views.route('/users', methods=['POST'])
def create_user_action():
    """Handles the form submission for creating a user from the web UI."""
    data = request.form
    if get_user_by_email(data['email']):
        flash(f"User with email {data['email']} already exists.")
    else:
        create_user(data['email'], data['username'], data['password'])
        flash(f"User {data['username']} created!")
    return redirect(url_for('user_views.get_user_page'))

@user_views.route('/static/users', methods=['GET'])
def static_user_page():
  """Serves a static HTML page."""
  return send_from_directory('static', 'static-user.html')


'''
API Routes
'''

@user_views.route('/api/users', methods=['GET'])
@jwt_required()
def get_all_users_api():
    """Get the collection of all users."""
    users = get_all_users_json()
    return jsonify(users)

@user_views.route('/api/users', methods=['POST'])
@jwt_required()
def create_user_api():
    """
    Create a new user in the collection.
    """
    data = request.json
    if not all(key in data for key in ['email', 'username', 'password']):
        return jsonify({'success': False, 'message': 'Email, username, and password are required'}), 400
        
    if get_user_by_email(data['email']):
        return jsonify({'success': False, 'message': 'A user with this email already exists'}), 409
        
    user = create_user(data['email'], data['username'], data['password'])
    if user:
        return jsonify({'success': True, 'message': 'User created successfully', 'user': user.get_json()}), 201
    
    return jsonify({'success': False, 'message': 'Failed to create user'}), 500

@user_views.route('/api/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user_api(user_id):
    """
    Delete a user by their ID.
    """
    if current_user.id == user_id:
        return jsonify({'success': False, 'message': 'You cannot delete your own account'}), 403 # 403 Forbidden is more accurate
        
    if delete_user(user_id):
        return jsonify({'success': True, 'message': 'User deleted successfully'})
    
    return jsonify({'success': False, 'message': 'User not found or could not be deleted'}), 404

@user_views.route('/api/users/me', methods=['PATCH'])
@jwt_required()
def update_current_user_api():
    """
    Update the currently authenticated user's profile.
    """
    data = request.json
    username = data.get('username')
    email = data.get('email')
    
    if not all([username, email]):
        return jsonify({'success': False, 'message': 'Username and email are required'}), 400
        
    new_password = data.get('new_password')
    if new_password:
        current_password = data.get('current_password')
        if not current_password:
            return jsonify({'success': False, 'message': 'Current password is required to set a new one'}), 400
        if not current_user.check_password(current_password):
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
    
    updated_user = update_user(current_user.id, email, username, new_password)
    
    if updated_user:
        return jsonify({'success': True, 'message': 'Your profile has been updated successfully'})
    
    return jsonify({'success': False, 'message': 'Failed to update user. The new email may already be in use.'}), 500