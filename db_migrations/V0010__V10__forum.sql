CREATE TABLE forum_categories (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, icon VARCHAR(30) DEFAULT 'MessageSquare', color VARCHAR(20) DEFAULT '#f97316', sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE forum_topics (id SERIAL PRIMARY KEY, category_id INT, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, author_id INT, is_pinned BOOLEAN DEFAULT false, is_locked BOOLEAN DEFAULT false, views INT DEFAULT 0, replies_count INT DEFAULT 0, last_reply_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE forum_replies (id SERIAL PRIMARY KEY, topic_id INT, author_id INT, content TEXT NOT NULL, hidden BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());