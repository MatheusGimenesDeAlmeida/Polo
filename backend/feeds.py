import re
import asyncio
import logging
import urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser

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


def _html_to_text(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _reading_time(text: str) -> int:
    return max(1, round(len(text.split()) / 200))


def _stratechery_is_free(entry) -> bool:
    content_list = getattr(entry, "content", None)
    if content_list:
        raw = content_list[0].get("value", "")
    else:
        raw = entry.get("summary") or entry.get("description") or ""
    text = re.sub(r"<[^>]+>", "", raw)
    return len(text) >= 800


_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; PoloBot/1.0)"}

_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Registry of feeds that require scraping instead of RSS.
# article_re: pattern matched against href values to identify article links.
# base_url: prepended to relative hrefs.
# author: stored in the author column (None = omit).
_SCRAPED_FEEDS: dict[str, dict] = {
    "https://sequoiacap.com/stories/": {
        "article_re": re.compile(r"/article/", re.IGNORECASE),
        "base_url": "https://sequoiacap.com",
        "author": "Sequoia Capital",
    },
}


class _ArticleLinkParser(HTMLParser):
    """Walks an HTML document and collects (url, title) pairs for article links."""

    def __init__(self, article_re: re.Pattern, base_url: str):
        super().__init__()
        self._article_re = article_re
        self._base_url = base_url
        self.articles: list[tuple[str, str]] = []
        self._current_url: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href", "")
        if self._article_re.search(href):
            self._current_url = href if href.startswith("http") else f"{self._base_url}{href}"
            self._buf = []

    def handle_endtag(self, tag: str):
        if tag == "a" and self._current_url:
            title = " ".join("".join(self._buf).split())
            if title:
                self.articles.append((self._current_url, title))
            self._current_url = None

    def handle_data(self, data: str):
        if self._current_url is not None:
            self._buf.append(data)


async def fetch_scraped_feed(feed: dict, article_re: re.Pattern, base_url: str, author: str | None = None):
    """Generic scraper for sites without RSS. Respects a 24 h refetch interval."""
    last_fetched = feed.get("last_fetched_at")
    if last_fetched:
        try:
            if datetime.now() - datetime.fromisoformat(last_fetched) < timedelta(hours=24):
                logger.debug(f"Skipping scrape for {feed['name']} — fetched less than 24 h ago")
                return
        except Exception:
            pass

    loop = asyncio.get_event_loop()
    req = urllib.request.Request(feed["url"], headers=_BROWSER_HEADERS)
    try:
        html = await loop.run_in_executor(
            None, lambda: urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")
        )
    except Exception as e:
        logger.error(f"Scrape failed for {feed['name']}: {e}")
        return

    parser = _ArticleLinkParser(article_re, base_url)
    parser.feed(html)

    db = get_db()
    count = 0
    seen: set[str] = set()
    now = datetime.now().isoformat()

    for url, title in parser.articles:
        if url in seen:
            continue
        seen.add(url)
        try:
            db.execute(
                "INSERT OR IGNORE INTO articles "
                "(feed_id, title, url, summary, published_at, image_url, author) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (feed["id"], title, url, None, now, None, author),
            )
            count += 1
        except Exception as e:
            logger.warning(f"Skipping article '{title}': {e}")

    db.execute("UPDATE feeds SET last_fetched_at = ? WHERE id = ?", (now, feed["id"]))
    db.commit()
    db.close()
    logger.info(f"Stored {count} new articles from {feed['name']}")


async def fetch_and_store_articles(feed: dict):
    if feed["url"] in _SCRAPED_FEEDS:
        cfg = _SCRAPED_FEEDS[feed["url"]]
        await fetch_scraped_feed(feed, cfg["article_re"], cfg["base_url"], cfg.get("author"))
        return

    loop = asyncio.get_event_loop()
    parsed = await loop.run_in_executor(
        None, lambda: feedparser.parse(feed["url"], request_headers=_HEADERS)
    )

    is_stratechery = feed["name"] == "Stratechery"
    is_not_boring = feed["name"] == "Not Boring"
    is_generalist = feed["name"] == "The Generalist"
    is_rundown = feed["name"] == "The Rundown AI"
    is_a16z_speedrun = feed["name"] == "a16z Speedrun"
    # URL-based para não colidir com o feed a16z.com já existente
    is_a16z_substack = feed["url"] == "https://a16z.substack.com/feed"
    is_pmarca = feed["name"] == "pmarca"
    is_first_round = feed["name"] == "First Round Review"
    is_import_ai = feed["name"] == "Import AI"
    is_startupi = feed["name"] == "Startupi"
    db = get_db()
    count = 0
    entry_limit = 15 if is_startupi else 30
    for entry in parsed.entries[:entry_limit]:
        title = (entry.get("title") or "").strip()
        url = (entry.get("link") or "").strip()
        if not title or not url:
            continue

        if is_stratechery and not _stratechery_is_free(entry):
            continue

        read_time_minutes = None
        if is_not_boring or is_generalist or is_rundown or is_a16z_speedrun or is_a16z_substack or is_pmarca or is_first_round or is_import_ai or is_startupi:
            content_list = getattr(entry, "content", None)
            raw_html = content_list[0].get("value", "") if content_list else (entry.get("summary") or entry.get("description") or "")
            full_text = _html_to_text(raw_html)
            summary = full_text[:300].strip() or None
            if is_not_boring:
                author = "Packy McCormick"
            elif is_generalist:
                author = "Mario Gabriele"
            elif is_a16z_speedrun or is_a16z_substack:
                author = feed["name"]
            elif is_pmarca:
                author = "Marc Andreessen"
            elif is_first_round:
                author = "First Round Capital"
                read_time_minutes = _reading_time(full_text)
            elif is_import_ai:
                author = "Jack Clark"
                read_time_minutes = _reading_time(full_text)
            elif is_startupi:
                author = None
            else:
                author = None
        else:
            summary_raw = entry.get("summary") or entry.get("description") or ""
            summary = re.sub(r"<[^>]+>", "", summary_raw)[:500].strip() or None
            author = "Ben Thompson" if is_stratechery else None

        try:
            db.execute(
                "INSERT OR IGNORE INTO articles "
                "(feed_id, title, url, summary, published_at, image_url, author, read_time_minutes) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (feed["id"], title, url, summary, _parse_date(entry), _extract_image(entry), author, read_time_minutes),
            )
            count += 1
        except Exception as e:
            logger.warning(f"Skipping article '{title}': {e}")

    db.commit()
    db.close()
    if is_stratechery and count == 0:
        logger.debug(f"Stored 0 new articles from {feed['name']}")
    else:
        logger.info(f"Stored {count} new articles from {feed['name']}")
