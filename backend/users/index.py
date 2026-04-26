import json
import os
import hashlib
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def check_admin(headers, conn):
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return None, False, False
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE id = %s AND is_active = true", (int(user_id),))
    row = cur.fetchone()
    if not row:
        return None, False, False
    role = row[0]
    return int(user_id), role == 'admin', role in ('admin', 'moderator')

def handler(event: dict, context) -> dict:
    """Управление пользователями: список, назначение роли, обновление, удаление."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    user_id, is_admin, is_mod = check_admin(headers, conn)

    action = params.get('action', '')
    # GET — список всех пользователей (модератор+)
    if method == 'GET':
        if not is_mod:
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.username, u.role, u.wot_nickname, u.avatar_url, u.is_active, u.created_at,
                   cm.in_game_role, co.name as company_name, co.id as company_id,
                   ps.battles, ps.wins, ps.winrate, ps.rating
            FROM users u
            LEFT JOIN clan_members cm ON cm.user_id = u.id AND cm.is_active = true
            LEFT JOIN companies co ON co.id = cm.company_id
            LEFT JOIN player_stats ps ON ps.user_id = u.id
            ORDER BY u.id
        """)
        rows = cur.fetchall()
        conn.close()
        users = [{
            'id': r[0], 'username': r[1], 'role': r[2], 'wot_nickname': r[3],
            'avatar_url': r[4], 'is_active': r[5], 'created_at': str(r[6]),
            'in_game_role': r[7], 'company_name': r[8], 'company_id': r[9],
            'battles': r[10], 'wins': r[11], 'winrate': float(r[12] or 0), 'rating': r[13]
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(users)}

    # PUT ?action=role — назначить роль (только admin)
    if method == 'PUT' and (action == 'role' or 'role' in path):
        if not is_admin:
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только администратор может менять роли'})}
        body = json.loads(event.get('body') or '{}')
        target_id = body.get('user_id')
        new_role = body.get('role')
        if not target_id or new_role not in ('admin', 'moderator', 'user'):
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите user_id и роль (admin/moderator/user)'})}
        cur = conn.cursor()
        cur.execute("UPDATE users SET role = %s, updated_at = NOW() WHERE id = %s", (new_role, int(target_id)))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True, 'user_id': target_id, 'role': new_role})}

    # PUT ?action=company — назначить роту (модератор+)
    if method == 'PUT' and (action == 'company' or 'company' in path):
        if not is_mod:
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        body = json.loads(event.get('body') or '{}')
        target_id = body.get('user_id')
        company_id = body.get('company_id')
        in_game_role = body.get('in_game_role', 'Боец')
        cur = conn.cursor()
        cur.execute("UPDATE clan_members SET is_active = false WHERE user_id = %s", (int(target_id),))
        if company_id:
            cur.execute(
                "INSERT INTO clan_members (user_id, company_id, in_game_role) VALUES (%s, %s, %s)",
                (int(target_id), int(company_id), in_game_role)
            )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    # PUT ?action=activate — активировать/деактивировать (модератор+)
    if method == 'PUT' and (action == 'activate' or 'activate' in path):
        if not is_mod:
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        body = json.loads(event.get('body') or '{}')
        target_id = body.get('user_id')
        is_active = body.get('is_active', True)
        cur = conn.cursor()
        cur.execute("UPDATE users SET is_active = %s, updated_at = NOW() WHERE id = %s", (is_active, int(target_id)))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}