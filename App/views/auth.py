from flask import Blueprint, render_template, jsonify, request, flash, send_from_directory, flash, redirect, url_for
from flask_jwt_extended import jwt_required, current_user, unset_jwt_cookies, set_access_cookies

from App.controllers.user import (
    generate_reset_token,
    get_all_users,
    verify_reset_token,
    reset_password,
    get_user_by_email
)

from App.controllers import (
    login
)

auth_views = Blueprint('auth_views', __name__, template_folder='../templates')

'''
Page/Action Routes
'''
@auth_views.route('/users', methods=['GET'])
def get_user_page():
    users = get_all_users()
    return render_template('users.html', users=users)

@auth_views.route('/identify', methods=['GET'])
@jwt_required()
def identify_page():
    return render_template('message.html', title="Identify", message=f"You are logged in as {current_user.id} - {current_user.username}")
    
@auth_views.route('/login', methods=['POST'])
def login_action():
    data = request.form
    token = login(data['email'], data['password'])
    
    if not token:
        flash('Invalid email or password')
        return redirect(url_for('auth_views.login_page'))
        
    response = redirect(url_for('inventory_views.inventory_page'))
    set_access_cookies(response, token)
    flash('Login Successful')
    return response

@auth_views.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@auth_views.route('/logout', methods=['GET'])
@jwt_required()
def logout_action():
    response = redirect(url_for("auth_views.login_page")) 
    flash("Logged Out!")
    unset_jwt_cookies(response)
    return response

@auth_views.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    return render_template('forgot_password.html')

@auth_views.route('/forgot-password', methods=['POST'])
def forgot_password_action():
    email = request.form.get('email')
    user = get_user_by_email(email)
    
    # Securely handle user existence to prevent email enumeration
    if not user:
        flash('If an account with that email exists, a password reset link has been sent.')
        return redirect(url_for('auth_views.login_page'))
    
    token = generate_reset_token(email)
    reset_url = url_for('auth_views.reset_password_page', token=token, _external=True)
    
    from App.controllers.mail import send_password_reset_email
    if send_password_reset_email(email, reset_url):
        flash('A password reset link has been sent to your email address.')
    else:
        flash('There was an issue sending the password reset email. Please try again later.')
    
    return redirect(url_for('auth_views.login_page'))

@auth_views.route('/reset-password/<token>', methods=['GET'])
def reset_password_page(token):
    if not verify_reset_token(token):
        flash('The password reset link is invalid or has expired.')
        return redirect(url_for('auth_views.login_page'))
    return render_template('reset_password.html', token=token)

@auth_views.route('/reset-password/<token>', methods=['POST'])
def reset_password_action(token):
    email = verify_reset_token(token)
    if not email:
        flash('The password reset link is invalid or has expired.')
        return redirect(url_for('auth_views.login_page'))
    
    password = request.form.get('password')
    if len(password) < 6:
        flash('Password must be at least 6 characters long')
        return redirect(url_for('auth_views.reset_password_page', token=token))
    
    if password != request.form.get('confirm_password'):
        flash('Passwords do not match')
        return redirect(url_for('auth_views.reset_password_page', token=token))
    
    if reset_password(email, password):
        flash('Your password has been reset successfully. You can now log in.')
        return redirect(url_for('auth_views.login_page'))
    else:
        flash('An error occurred while resetting your password. Please try again.')
        return redirect(url_for('auth_views.reset_password_page', token=token))


'''
API Routes (RESTful)
'''

@auth_views.route('/api/login', methods=['POST'])
def user_login_api():
  """
  Creates a new session/token.
  """
  data = request.json
  token = login(data['email'], data['password'])
  if not token:
    return jsonify(message='Bad email or password given'), 401
  response = jsonify(access_token=token) 
  set_access_cookies(response, token)
  return response

@auth_views.route('/api/users/me', methods=['GET']) # CHANGED
@jwt_required()
def get_current_user_api():
    """
    fetches the authenticated user's resource.
    """
    return jsonify({
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    })

@auth_views.route('/api/logout', methods=['POST']) # CHANGED
@jwt_required()
def logout_api():
    """
    Logs out the user.
    """
    response = jsonify(message="Logout successful")
    unset_jwt_cookies(response)
    return response