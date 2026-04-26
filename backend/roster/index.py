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
    """Состав клана: роты, участники, статистика."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn = get_conn()
    cur = conn.cursor()

    # Роты с командирами
    cur.execute("""
        SELECT c.id, c.name, c.description, c.icon, c.color,
               u.username as commander, u.wot_nickname as commander_wot
        FROM companies c
        LEFT JOIN users u ON u.id = c.commander_id
        ORDER BY c.id
    """)
    companies = [{
        'id': r[0], 'name': r[1], 'description': r[2],
        'icon': r[3], 'color': r[4],
        'commander': r[5], 'commander_wot': r[6],
        'members': []
    } for r in cur.fetchall()]
    company_map = {c['id']: c for c in companies}

    # Участники по ротам
    cur.execute("""
        SELECT cm.id, cm.user_id, u.username, u.wot_nickname, u.role, u.avatar_url,
               cm.company_id, cm.in_game_role, cm.joined_at, cm.notes,
               ps.battles, ps.wins, ps.winrate, ps.rating
        FROM clan_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN player_stats ps ON ps.user_id = cm.user_id
        WHERE cm.is_active = true AND u.is_active = true
        ORDER BY cm.company_id, ps.rating DESC NULLS LAST
    """)
    for r in cur.fetchall():
        member = {
            'id': r[0], 'user_id': r[1], 'username': r[2], 'wot_nickname': r[3],
            'role': r[4], 'avatar_url': r[5], 'company_id': r[6],
            'in_game_role': r[7], 'joined_at': str(r[8]) if r[8] else None,
            'notes': r[9], 'battles': r[10], 'wins': r[11],
            'winrate': float(r[12] or 0), 'rating': r[13]
        }
        if r[6] in company_map:
            company_map[r[6]]['members'].append(member)

    # Игроки без роты
    cur.execute("""
        SELECT u.id, u.username, u.wot_nickname, u.role, u.avatar_url,
               ps.battles, ps.wins, ps.winrate, ps.rating
        FROM users u
        LEFT JOIN clan_members cm ON cm.user_id = u.id AND cm.is_active = true
        LEFT JOIN player_stats ps ON ps.user_id = u.id
        WHERE cm.id IS NULL AND u.is_active = true
        ORDER BY ps.rating DESC NULLS LAST
    """)
    unassigned = [{
        'user_id': r[0], 'username': r[1], 'wot_nickname': r[2], 'role': r[3],
        'avatar_url': r[4], 'battles': r[5], 'wins': r[6],
        'winrate': float(r[7] or 0), 'rating': r[8], 'in_game_role': 'Не распределён'
    } for r in cur.fetchall()]

    conn.close()
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
        'companies': companies,
        'unassigned': unassigned
    })}
