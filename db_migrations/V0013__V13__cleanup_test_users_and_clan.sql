
-- Убираем командиров из рот
UPDATE companies SET commander_id = NULL;

-- Очищаем привязки к ротам у всех членов
UPDATE clan_members SET is_active = false;

-- Очищаем статистику тестовых пользователей (1-5)
UPDATE player_stats SET battles=0, wins=0, losses=0, draws=0, winrate=0, avg_damage=0, avg_xp=0, frags=0, rating=0, updated_at=NOW() WHERE user_id IN (1,2,3,4,5);

-- Понижаем роли у тестовых пользователей 1-5 до user
UPDATE users SET role = 'user', updated_at = NOW() WHERE id IN (1,2,3,4,5);

-- Деактивируем тестовых пользователей 1-5
UPDATE users SET is_active = false, updated_at = NOW() WHERE id IN (1,2,3,4,5);

-- noBeJlUlTeJlb_Pbl6uHcka остаётся admin и активным
UPDATE users SET is_active = true WHERE id = 6;
