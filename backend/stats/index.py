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
    """Статистика игроков: лидерборд и обновление данных."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})

    conn = get_conn()
    cur = conn.cursor()

    # GET / — лидерборд всех игроков
    if method == 'GET':
        cur.execute("""
            SELECT u.id, u.username, u.wot_nickname, u.role,
                   ps.battles, ps.wins, ps.losses, ps.draws,
                   ps.winrate, ps.avg_damage, ps.avg_xp, ps.frags, ps.rating,
                   ps.updated_at, c.name as company_name, cm.in_game_role
            FROM player_stats ps
            JOIN users u ON u.id = ps.user_id
            LEFT JOIN clan_members cm ON cm.user_id = u.id AND cm.is_active = true
            LEFT JOIN companies c ON c.id = cm.company_id
            WHERE u.is_active = true
            ORDER BY ps.rating DESC
        """)
        rows = cur.fetchall()
        conn.close()
        players = [{
            'id': r[0], 'username': r[1], 'wot_nickname': r[2], 'role': r[3],
            'battles': r[4], 'wins': r[5], 'losses': r[6], 'draws': r[7],
            'winrate': float(r[8] or 0), 'avg_damage': r[9], 'avg_xp': r[10],
            'frags': r[11], 'rating': r[12], 'updated_at': str(r[13]),
            'company_name': r[14], 'in_game_role': r[15]
        } for r in rows]
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(players)}

    # PUT / — обновить статистику (модератор+)
    if method == 'PUT':
        user_id_req = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id_req:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}
        cur.execute("SELECT role FROM users WHERE id = %s", (int(user_id_req),))
        req_row = cur.fetchone()
        if not req_row or req_row[0] not in ('admin', 'moderator'):
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Только модератор или администратор'})}

        body = json.loads(event.get('body') or '{}')
        uid = body.get('user_id')
        if not uid:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите user_id'})}

        battles = body.get('battles', 0)
        wins = body.get('wins', 0)
        losses = body.get('losses', 0)
        draws = body.get('draws', 0)
        winrate = round(wins / battles * 100, 2) if battles > 0 else 0
        avg_damage = body.get('avg_damage', 0)
        avg_xp = body.get('avg_xp', 0)
        frags = body.get('frags', 0)
        rating = body.get('rating', 0)

        cur.execute("SELECT id FROM player_stats WHERE user_id = %s", (int(uid),))
        exists = cur.fetchone()
        if exists:
            cur.execute("""
                UPDATE player_stats SET battles=%s, wins=%s, losses=%s, draws=%s,
                winrate=%s, avg_damage=%s, avg_xp=%s, frags=%s, rating=%s, updated_at=NOW()
                WHERE user_id=%s
            """, (battles, wins, losses, draws, winrate, avg_damage, avg_xp, frags, rating, int(uid)))
        else:
            cur.execute("""
                INSERT INTO player_stats (user_id, battles, wins, losses, draws, winrate, avg_damage, avg_xp, frags, rating)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (int(uid), battles, wins, losses, draws, winrate, avg_damage, avg_xp, frags, rating))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True, 'winrate': winrate})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найдено'})}
