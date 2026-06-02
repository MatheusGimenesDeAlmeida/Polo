import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "polo.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL DEFAULT 'uncategorized',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            summary TEXT,
            published_at TIMESTAMP,
            image_url TEXT,
            author TEXT,
            FOREIGN KEY (feed_id) REFERENCES feeds(id)
        );
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS article_tags (
            article_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (article_id, tag_id),
            FOREIGN KEY (article_id) REFERENCES articles(id),
            FOREIGN KEY (tag_id) REFERENCES tags(id)
        );
        CREATE INDEX IF NOT EXISTS idx_article_tags_article ON article_tags(article_id);
    """)
    for migration in [
        "ALTER TABLE articles ADD COLUMN author TEXT",
        "ALTER TABLE articles ADD COLUMN read_at TIMESTAMP",
        "ALTER TABLE feeds ADD COLUMN last_fetched_at TIMESTAMP",
        "ALTER TABLE articles ADD COLUMN read_time_minutes INTEGER",
    ]:
        try:
            db.execute(migration)
        except Exception:
            pass
    db.commit()
    db.close()
