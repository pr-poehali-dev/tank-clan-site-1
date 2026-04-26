import json
import os
import hashlib
import psycopg2
from datetime import datetime

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def handler(event: dict, context) -> dict:
    """Аутентификация: вход, регистрация, получение текущего пользователя."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    # GET ?action=profile — получить профиль по токену
    if method == 'GET' and ('profile' in path or action == 'profile'):
        user_id = headers.get('X-User-Id') or headers.get('x-user-id')
        token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
        if not user_id or not token:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT u.id, u.username, u.role, u.wot_nickname, u.avatar_url, u.created_at, cm.in_game_role, c.name as company_name FROM users u LEFT JOIN clan_members cm ON cm.user_id = u.id AND cm.is_active = true LEFT JOIN companies c ON c.id = cm.company_id WHERE u.id = %s AND u.is_active = true",
            (int(user_id),)
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь не найден'})}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'id': row[0], 'username': row[1], 'role': row[2],
            'wot_nickname': row[3], 'avatar_url': row[4],
            'created_at': str(row[5]), 'in_game_role': row[6],
            'company_name': row[7]
        })}

    # POST ?action=login
    if method == 'POST' and ('login' in path or action == 'login' or not action):
        body = json.loads(event.get('body') or '{}')
        username = body.get('username', '').strip()
        password = body.get('password', '')
        if not username or not password:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите логин и пароль'})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, role, wot_nickname, avatar_url FROM users WHERE username = %s AND password_hash = %s AND is_active = true",
            (username, hash_password(password))
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный логин или пароль'})}
        token = hashlib.sha256(f"{row[0]}{row[1]}{os.environ.get('DATABASE_URL','')}".encode()).hexdigest()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'token': token, 'user_id': row[0], 'username': row[1],
            'role': row[2], 'wot_nickname': row[3], 'avatar_url': row[4]
        })}

    # POST ?action=register
    if method == 'POST' and ('register' in path or action == 'register'):
        body = json.loads(event.get('body') or '{}')
        username = body.get('username', '').strip()
        password = body.get('password', '')
        wot_nickname = body.get('wot_nickname', '').strip()
        if not username or not password:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите логин и пароль'})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Логин уже занят'})}
        cur.execute(
            "INSERT INTO users (username, password_hash, wot_nickname) VALUES (%s, %s, %s) RETURNING id",
            (username, hash_password(password), wot_nickname or None)
        )
        new_id = cur.fetchone()[0]
        cur.execute("INSERT INTO player_stats (user_id) VALUES (%s)", (new_id,))
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({'id': new_id, 'username': username, 'role': 'user'})}

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}