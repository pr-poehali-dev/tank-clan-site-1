
INSERT INTO users (username, password_hash, role, wot_nickname) VALUES
  ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 'Commander_X'),
  ('moder1', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'moderator', 'Steel_Wolf'),
  ('player1', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'user', 'IronFist_77'),
  ('player2', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'user', 'BlazeKing'),
  ('player3', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'user', 'DarkArmor');

INSERT INTO companies (name, description, icon, color) VALUES
  ('Альфа', 'Ударная рота первого эшелона', 'Sword', '#ef4444'),
  ('Браво', 'Разведка и поддержка', 'Eye', '#eab308'),
  ('Чарли', 'Тяжёлая бронетехника', 'Shield', '#22c55e'),
  ('Дельта', 'Резервный состав', 'Star', '#3b82f6');

INSERT INTO player_stats (user_id, battles, wins, losses, winrate, avg_damage, avg_xp, frags, rating) VALUES
  (1, 15420, 9252, 5400, 60.00, 2150, 890, 18300, 4250),
  (2, 8730, 4800, 3500, 54.98, 1820, 720, 9100, 3100),
  (3, 3200, 1632, 1400, 51.00, 1200, 580, 3000, 1800),
  (4, 5600, 3024, 2300, 54.00, 1650, 660, 5800, 2400),
  (5, 1200, 588, 560, 49.00, 980, 420, 1100, 900);

INSERT INTO clan_members (user_id, company_id, in_game_role) VALUES
  (1, 1, 'Командир'),
  (2, 1, 'Заместитель'),
  (3, 2, 'Боец'),
  (4, 2, 'Разведчик'),
  (5, 3, 'Боец');

UPDATE companies SET commander_id = 1 WHERE id = 1;
UPDATE companies SET commander_id = 2 WHERE id = 2;
