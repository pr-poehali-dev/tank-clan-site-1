import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Модерация: бан, мьют, разбан, размьют пользователей."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}
    mod_id = headers.get('X-User-Id') or headers.get('x-user-id')

    if not mod_id:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT role FROM users WHERE id = %s", (int(mod_id),))
    mrow = cur.fetchone()
    if not mrow or mrow[0] not in ('admin', 'moderator'):
        conn.close()
        return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только модератор или администратор'})}

    # GET — список активных модераций
    if method == 'GET':
        cur.execute("""
            SELECT m.id, m.user_id, u.username, u.wot_nickname, m.action, m.reason,
                   m.expires_at, m.is_active, m.created_at,
                   mod_u.username as moderator_name
            FROM user_moderation m
            JOIN users u ON u.id = m.user_id
            LEFT JOIN users mod_u ON mod_u.id = m.moderator_id
            WHERE m.is_active = true
            ORDER BY m.created_at DESC
        """)
        rows = cur.fetchall()
        conn.close()
        result = [{
            'id': r[0], 'user_id': r[1], 'username': r[2], 'wot_nickname': r[3],
            'action': r[4], 'reason': r[5], 'expires_at': str(r[6]) if r[6] else None,
            'is_active': r[7], 'created_at': str(r[8]), 'moderator': r[9]
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(result)}

    # POST — применить модерацию (ban / mute)
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        target_id = body.get('user_id')
        action = body.get('action')
        reason = body.get('reason', '')
        expires_at = body.get('expires_at')

        if not target_id or action not in ('ban', 'mute'):
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите user_id и action (ban/mute)'})}

        # Нельзя банить администраторов
        cur.execute("SELECT role FROM users WHERE id = %s", (int(target_id),))
        trow = cur.fetchone()
        if trow and trow[0] == 'admin':
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нельзя банить администратора'})}

        # Деактивируем предыдущую аналогичную запись
        cur.execute("UPDATE user_moderation SET is_active = false WHERE user_id = %s AND action = %s AND is_active = true", (int(target_id), action))

        if expires_at:
            cur.execute("""
                INSERT INTO user_moderation (user_id, action, reason, moderator_id, expires_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (int(target_id), action, reason, int(mod_id), expires_at))
        else:
            cur.execute("""
                INSERT INTO user_moderation (user_id, action, reason, moderator_id)
                VALUES (%s, %s, %s, %s)
            """, (int(target_id), action, reason, int(mod_id)))

        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({'success': True, 'action': action})}

    # PUT — снять модерацию (unban / unmute)
    if method == 'PUT':
        body = json.loads(event.get('body') or '{}')
        target_id = body.get('user_id')
        action = body.get('action')

        if not target_id or action not in ('ban', 'mute'):
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите user_id и action'})}

        cur.execute("UPDATE user_moderation SET is_active = false WHERE user_id = %s AND action = %s AND is_active = true", (int(target_id), action))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}
