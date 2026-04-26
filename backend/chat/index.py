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
    """Чат клана: получение и отправка сообщений, загрузка файлов."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    conn = get_conn()
    cur = conn.cursor()

    # GET — получить последние 100 сообщений
    if method == 'GET':
        cur.execute("""
            SELECT m.id, m.user_id, m.username, m.user_role, m.wot_nickname,
                   m.content, m.file_url, m.file_name, m.file_type, m.created_at
            FROM chat_messages m
            WHERE m.hidden = false
            ORDER BY m.created_at DESC LIMIT 100
        """)
        rows = cur.fetchall()
        conn.close()
        messages = [{
            'id': r[0], 'user_id': r[1], 'username': r[2], 'role': r[3],
            'wot_nickname': r[4], 'content': r[5],
            'file_url': r[6], 'file_name': r[7], 'file_type': r[8],
            'created_at': str(r[9])
        } for r in reversed(rows)]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(messages)}

    # POST — отправить сообщение
    if method == 'POST':
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        # Проверяем мьют
        cur.execute("""
            SELECT id FROM user_moderation
            WHERE user_id = %s AND action = 'mute' AND is_active = true
            AND (expires_at IS NULL OR expires_at > NOW())
        """, (int(user_id),))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Вы заглушены модератором'})}

        cur.execute("SELECT username, user_role, wot_nickname FROM users WHERE id = %s", (int(user_id),))
        urow = cur.fetchone()
        if not urow:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь не найден'})}

        # users.role column is called 'role', select it properly
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id),))
        rrow = cur.fetchone()
        user_role = rrow[0] if rrow else 'user'

        body = json.loads(event.get('body') or '{}')
        content = body.get('content', '').strip()
        file_url = body.get('file_url')
        file_name = body.get('file_name')
        file_type = body.get('file_type')

        if not content and not file_url:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Сообщение пустое'})}

        cur.execute("""
            INSERT INTO chat_messages (user_id, username, user_role, wot_nickname, content, file_url, file_name, file_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at
        """, (int(user_id), urow[0], user_role, urow[2], content or None, file_url, file_name, file_type))
        new_id, created_at = cur.fetchone()
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({
            'id': new_id, 'user_id': int(user_id), 'username': urow[0],
            'role': user_role, 'wot_nickname': urow[2],
            'content': content, 'file_url': file_url, 'file_name': file_name,
            'file_type': file_type, 'created_at': str(created_at)
        })}

    # PUT — скрыть сообщение (модератор+)
    if method == 'PUT':
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id),))
        rrow = cur.fetchone()
        if not rrow or rrow[0] not in ('admin', 'moderator'):
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        body = json.loads(event.get('body') or '{}')
        msg_id = body.get('id')
        cur.execute("UPDATE chat_messages SET hidden = true WHERE id = %s", (int(msg_id),))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}
