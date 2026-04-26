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
    """Новости: список, создание, обновление. Поддерживает фильтр по категории."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {})
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    cur = conn.cursor()

    # GET — список новостей
    if method == 'GET':
        category = params.get('category')
        if category and category != 'all':
            cur.execute("""
                SELECT n.id, n.title, n.content, n.category, n.source, n.image_url,
                       n.is_published, n.created_at, u.username as author
                FROM news n LEFT JOIN users u ON u.id = n.author_id
                WHERE n.is_published = true AND n.category = %s
                ORDER BY n.created_at DESC LIMIT 50
            """, (category,))
        else:
            cur.execute("""
                SELECT n.id, n.title, n.content, n.category, n.source, n.image_url,
                       n.is_published, n.created_at, u.username as author
                FROM news n LEFT JOIN users u ON u.id = n.author_id
                WHERE n.is_published = true
                ORDER BY n.created_at DESC LIMIT 50
            """)
        rows = cur.fetchall()
        conn.close()
        news = [{
            'id': r[0], 'title': r[1], 'content': r[2], 'category': r[3],
            'source': r[4], 'image_url': r[5], 'is_published': r[6],
            'created_at': str(r[7]), 'author': r[8]
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(news)}

    # POST — создать новость (модератор+)
    if method == 'POST':
        user_id = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id),))
        req_row = cur.fetchone()
        if not req_row or req_row[0] not in ('admin', 'moderator'):
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только модератор или администратор'})}

        body = json.loads(event.get('body') or '{}')
        title = body.get('title', '').strip()
        content = body.get('content', '').strip()
        category = body.get('category', 'general')
        source = body.get('source', 'редакция')
        image_url = body.get('image_url')

        if not title or not content:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите заголовок и текст'})}

        cur.execute("""
            INSERT INTO news (title, content, category, source, image_url, author_id)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (title, content, category, source, image_url, int(user_id)))
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS, 'body': json.dumps({'id': new_id, 'title': title})}

    # PUT — скрыть/опубликовать новость (admin)
    if method == 'PUT':
        user_id = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id),))
        req_row = cur.fetchone()
        if not req_row or req_row[0] != 'admin':
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только администратор'})}

        body = json.loads(event.get('body') or '{}')
        news_id = body.get('id')
        is_published = body.get('is_published', True)
        cur.execute("UPDATE news SET is_published = %s WHERE id = %s", (is_published, int(news_id)))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}
