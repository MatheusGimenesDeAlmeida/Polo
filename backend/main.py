import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db
from feeds import fetch_and_store_articles
from models import FeedCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_FEEDS = [
    {"name": "a16z", "url": "https://a16z.com/feed/", "category": "startups"},
    {"name": "Sequoia", "url": "https://www.sequoiacap.com/articles/feed.xml", "category": "startups"},
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


@app.get("/articles")
def list_articles(
    category: str = None,
    feed_id: int = None,
    limit: int = 60,
    offset: int = 0,
):
    db = get_db()
    query = """
        SELECT a.*, f.name as feed_name, f.category
        FROM articles a
        JOIN feeds f ON a.feed_id = f.id
        WHERE 1=1
    """
    params: list = []
    if category:
        query += " AND f.category = ?"
        params.append(category)
    if feed_id:
        query += " AND a.feed_id = ?"
        params.append(feed_id)
    query += " ORDER BY a.published_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    articles = [dict(r) for r in db.execute(query, params).fetchall()]
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
