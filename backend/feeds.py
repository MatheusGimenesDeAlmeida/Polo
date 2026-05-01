import re
import asyncio
import logging
from datetime import datetime

import feedparser

from database import get_db

logger = logging.getLogger(__name__)


def _extract_image(entry) -> str | None:
    if hasattr(entry, "media_content") and entry.media_content:
        return entry.media_content[0].get("url")
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image/"):
                return enc.get("href")
    return None


def _parse_date(entry) -> str | None:
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return datetime(*val[:6]).isoformat()
            except Exception:
                pass
    return None


async def fetch_and_store_articles(feed: dict):
    loop = asyncio.get_event_loop()
    parsed = await loop.run_in_executor(None, feedparser.parse, feed["url"])

    db = get_db()
    count = 0
    for entry in parsed.entries[:30]:
        title = (entry.get("title") or "").strip()
        url = (entry.get("link") or "").strip()
        if not title or not url:
            continue

        summary_raw = entry.get("summary") or entry.get("description") or ""
        summary = re.sub(r"<[^>]+>", "", summary_raw)[:500].strip() or None

        try:
            db.execute(
                "INSERT OR IGNORE INTO articles "
                "(feed_id, title, url, summary, published_at, image_url) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (feed["id"], title, url, summary, _parse_date(entry), _extract_image(entry)),
            )
            count += 1
        except Exception as e:
            logger.warning(f"Skipping article '{title}': {e}")

    db.commit()
    db.close()
    logger.info(f"Stored {count} new articles from {feed['name']}")
