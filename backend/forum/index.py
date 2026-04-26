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
    """Форум: категории, темы, ответы."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    action = params.get('action', '')
    topic_id = params.get('topic_id')
    category_id = params.get('category_id')

    conn = get_conn()
    cur = conn.cursor()

    # GET ?action=categories — все категории
    if method == 'GET' and (action == 'categories' or not action):
        cur.execute("""
            SELECT fc.id, fc.name, fc.description, fc.icon, fc.color, fc.sort_order,
                   COUNT(ft.id) as topics_count
            FROM forum_categories fc
            LEFT JOIN forum_topics ft ON ft.category_id = fc.id
            GROUP BY fc.id ORDER BY fc.sort_order
        """)
        rows = cur.fetchall()
        conn.close()
        cats = [{
            'id': r[0], 'name': r[1], 'description': r[2],
            'icon': r[3], 'color': r[4], 'sort_order': r[5], 'topics_count': r[6]
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(cats)}

    # GET ?action=topics&category_id=X — темы категории
    if method == 'GET' and action == 'topics':
        if not category_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите category_id'})}
        cur.execute("""
            SELECT t.id, t.title, t.content, t.author_id, u.username, u.role,
                   t.is_pinned, t.is_locked, t.views, t.replies_count,
                   t.last_reply_at, t.created_at
            FROM forum_topics t
            JOIN users u ON u.id = t.author_id
            WHERE t.category_id = %s
            ORDER BY t.is_pinned DESC, t.last_reply_at DESC
        """, (int(category_id),))
        rows = cur.fetchall()
        conn.close()
        topics = [{
            'id': r[0], 'title': r[1], 'content': r[2], 'author_id': r[3],
            'author': r[4], 'author_role': r[5], 'is_pinned': r[6], 'is_locked': r[7],
            'views': r[8], 'replies_count': r[9],
            'last_reply_at': str(r[10]), 'created_at': str(r[11])
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(topics)}

    # GET ?action=topic&topic_id=X — тема с ответами
    if method == 'GET' and action == 'topic':
        if not topic_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите topic_id'})}
        cur.execute("""
            SELECT t.id, t.title, t.content, t.author_id, u.username, u.role,
                   t.is_pinned, t.is_locked, t.views, t.replies_count, t.created_at,
                   t.category_id
            FROM forum_topics t JOIN users u ON u.id = t.author_id
            WHERE t.id = %s
        """, (int(topic_id),))
        trow = cur.fetchone()
        if not trow:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Тема не найдена'})}

        cur.execute("UPDATE forum_topics SET views = views + 1 WHERE id = %s", (int(topic_id),))

        cur.execute("""
            SELECT r.id, r.author_id, u.username, u.role, r.content, r.created_at
            FROM forum_replies r JOIN users u ON u.id = r.author_id
            WHERE r.topic_id = %s AND r.hidden = false
            ORDER BY r.created_at
        """, (int(topic_id),))
        replies = [{
            'id': rr[0], 'author_id': rr[1], 'author': rr[2], 'author_role': rr[3],
            'content': rr[4], 'created_at': str(rr[5])
        } for rr in cur.fetchall()]

        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'id': trow[0], 'title': trow[1], 'content': trow[2], 'author_id': trow[3],
            'author': trow[4], 'author_role': trow[5], 'is_pinned': trow[6],
            'is_locked': trow[7], 'views': trow[8], 'replies_count': trow[9],
            'created_at': str(trow[10]), 'category_id': trow[11], 'replies': replies
        })}

    # POST ?action=topic — создать тему
    if method == 'POST' and action == 'topic':
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
        body = json.loads(event.get('body') or '{}')
        title = body.get('title', '').strip()
        content = body.get('content', '').strip()
        cat_id = body.get('category_id')
        if not title or not content or not cat_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
        cur.execute("""
            INSERT INTO forum_topics (category_id, title, content, author_id)
            VALUES (%s, %s, %s, %s) RETURNING id
        """, (int(cat_id), title, content, int(user_id)))
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({'id': new_id})}

    # POST ?action=reply — ответить на тему
    if method == 'POST' and action == 'reply':
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
        body = json.loads(event.get('body') or '{}')
        tid = body.get('topic_id')
        content = body.get('content', '').strip()
        if not tid or not content:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}

        # Проверяем мьют
        cur.execute("SELECT id FROM user_moderation WHERE user_id = %s AND action = 'mute' AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())", (int(user_id),))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Вы заглушены'})}

        cur.execute("""
            INSERT INTO forum_replies (topic_id, author_id, content) VALUES (%s, %s, %s) RETURNING id
        """, (int(tid), int(user_id), content))
        new_id = cur.fetchone()[0]
        cur.execute("UPDATE forum_topics SET replies_count = replies_count + 1, last_reply_at = NOW() WHERE id = %s", (int(tid),))
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({'id': new_id})}

    # PUT ?action=lock — закрыть/открыть тему (модератор+)
    if method == 'PUT' and action == 'lock':
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id),))
        rrow = cur.fetchone()
        if not rrow or rrow[0] not in ('admin', 'moderator'):
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        body = json.loads(event.get('body') or '{}')
        tid = body.get('topic_id')
        locked = body.get('is_locked', True)
        cur.execute("UPDATE forum_topics SET is_locked = %s WHERE id = %s", (locked, int(tid)))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}
