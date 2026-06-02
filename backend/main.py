import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db
from feeds import fetch_and_store_articles
from models import FeedCreate, TagCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_FEEDS = [
    {"name": "a16z", "url": "https://a16z.com/feed/", "category": "startups"},
    {"name": "Sequoia", "url": "https://www.sequoiacap.com/articles/feed.xml", "category": "startups"},
    {"name": "Stratechery", "url": "https://stratechery.com/feed/", "category": "startups"},
    {"name": "Not Boring", "url": "https://www.notboring.co/feed", "category": "startups"},
    {"name": "The Generalist", "url": "https://thegeneralist.substack.com/feed", "category": "startups"},
    {"name": "The Rundown AI", "url": "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml", "category": "startups"},
    {"name": "a16z Speedrun", "url": "https://speedrun.substack.com/feed", "category": "startups"},
    {"name": "a16z", "url": "https://a16z.substack.com/feed", "category": "startups"},
    {"name": "pmarca", "url": "https://pmarca.substack.com/feed", "category": "startups"},
    {"name": "Sequoia Capital", "url": "https://sequoiacap.com/stories/", "category": "startups"},
    {"name": "First Round Review", "url": "https://review.firstround.com/rss/", "category": "startups"},
    {"name": "Import AI", "url": "https://jack-clark.net/feed/", "category": "startups"},
    {"name": "Startupi", "url": "https://startupi.com.br/feed/", "category": "brasil"},
    {"name": "Brazil Journal", "url": "https://braziljournal.com/feed/", "category": "brasil"},
    {"name": "Poder360", "url": "https://poder360.com.br/feed/", "category": "brasil"},
    {"name": "The Economist", "url": "https://www.economist.com/rss", "category": "macro"},
]


async def _seed_and_refresh():
    db = get_db()
    for feed_data in DEFAULT_FEEDS:
        if not db.execute("SELECT id FROM feeds WHERE url = ?", (feed_data["url"],)).fetchone():
            db.execute(
                "INSERT INTO feeds (name, url, category) VALUES (?, ?, ?)",
                (feed_data["name"], feed_data["url"], feed_data["category"]),
            )
    db.commit()
    feeds = [dict(r) for r in db.execute("SELECT * FROM feeds").fetchall()]
    db.close()

    for feed in feeds:
        try:
            await fetch_and_store_articles(feed)
        except Exception as e:
            logger.error(f"Error fetching {feed['name']}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(_seed_and_refresh())
    yield


app = FastAPI(title="Polo RSS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/feeds")
def list_feeds():
    db = get_db()
    feeds = [dict(r) for r in db.execute("SELECT * FROM feeds ORDER BY name").fetchall()]
    db.close()
    return feeds


@app.post("/feeds", status_code=201)
async def add_feed(feed: FeedCreate):
    db = get_db()
    if db.execute("SELECT id FROM feeds WHERE url = ?", (str(feed.url),)).fetchone():
        db.close()
        raise HTTPException(409, "Feed already exists")
    cursor = db.execute(
        "INSERT INTO feeds (name, url, category) VALUES (?, ?, ?)",
        (feed.name, str(feed.url), feed.category),
    )
    db.commit()
    new_feed = dict(db.execute("SELECT * FROM feeds WHERE id = ?", (cursor.lastrowid,)).fetchone())
    db.close()
    asyncio.create_task(fetch_and_store_articles(new_feed))
    return new_feed


def _parse_tags(tags_raw: str | None) -> list:
    if not tags_raw:
        return []
    return [
        {"id": int(p.split("|")[0]), "name": p.split("|")[1]}
        for p in tags_raw.split(",")
        if "|" in p
    ]


@app.get("/articles")
def list_articles(
    category: str = None,
    feed_id: int = None,
    tag_id: int = None,
    limit: int = 60,
    offset: int = 0,
):
    db = get_db()
    query = """
        SELECT a.*, f.name as feed_name, f.category,
               GROUP_CONCAT(t.id || '|' || t.name) as tags_raw
        FROM articles a
        JOIN feeds f ON a.feed_id = f.id
        LEFT JOIN article_tags atag ON a.id = atag.article_id
        LEFT JOIN tags t ON atag.tag_id = t.id
        WHERE 1=1
    """
    params: list = []
    if category:
        query += " AND f.category = ?"
        params.append(category)
    if feed_id:
        query += " AND a.feed_id = ?"
        params.append(feed_id)
    if tag_id:
        query += " AND a.id IN (SELECT article_id FROM article_tags WHERE tag_id = ?)"
        params.append(tag_id)
    query += " GROUP BY a.id ORDER BY a.published_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    articles = []
    for row in db.execute(query, params).fetchall():
        a = dict(row)
        a["tags"] = _parse_tags(a.pop("tags_raw", None))
        articles.append(a)
    db.close()
    return articles


@app.post("/refresh")
async def refresh():
    db = get_db()
    feeds = [dict(r) for r in db.execute("SELECT * FROM feeds").fetchall()]
    db.close()
    asyncio.create_task(_refresh_all(feeds))
    return {"message": "Refresh started"}


async def _refresh_all(feeds: list):
    for feed in feeds:
        try:
            await fetch_and_store_articles(feed)
        except Exception as e:
            logger.error(f"Error refreshing {feed['name']}: {e}")


# ── Tags ──────────────────────────────────────────

@app.get("/tags")
def list_tags():
    db = get_db()
    tags = [dict(r) for r in db.execute("SELECT * FROM tags ORDER BY name").fetchall()]
    db.close()
    return tags


@app.post("/tags", status_code=201)
def create_tag(body: TagCreate):
    name = body.name.strip().lower()
    if not name:
        raise HTTPException(400, "Tag name cannot be empty")
    db = get_db()
    existing = db.execute("SELECT * FROM tags WHERE name = ?", (name,)).fetchone()
    if existing:
        db.close()
        return dict(existing)
    cursor = db.execute("INSERT INTO tags (name) VALUES (?)", (name,))
    db.commit()
    tag = dict(db.execute("SELECT * FROM tags WHERE id = ?", (cursor.lastrowid,)).fetchone())
    db.close()
    return tag


@app.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int):
    db = get_db()
    db.execute("DELETE FROM article_tags WHERE tag_id = ?", (tag_id,))
    db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    db.commit()
    db.close()


@app.post("/articles/{article_id}/tags/{tag_id}", status_code=204)
def add_tag_to_article(article_id: int, tag_id: int):
    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
        (article_id, tag_id),
    )
    db.commit()
    db.close()


@app.delete("/articles/{article_id}/tags/{tag_id}", status_code=204)
def remove_tag_from_article(article_id: int, tag_id: int):
    db = get_db()
    db.execute(
        "DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?",
        (article_id, tag_id),
    )
    db.commit()
    db.close()


@app.patch("/articles/{article_id}/read")
def toggle_read(article_id: int):
    db = get_db()
    row = db.execute("SELECT read_at FROM articles WHERE id = ?", (article_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Article not found")
    if row["read_at"]:
        db.execute("UPDATE articles SET read_at = NULL WHERE id = ?", (article_id,))
        read_at = None
    else:
        db.execute("UPDATE articles SET read_at = CURRENT_TIMESTAMP WHERE id = ?", (article_id,))
        read_at = db.execute("SELECT read_at FROM articles WHERE id = ?", (article_id,)).fetchone()["read_at"]
    db.commit()
    db.close()
    return {"read_at": read_at}
