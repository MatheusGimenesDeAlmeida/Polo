# Polo RSS API — Documentação do Backend

## Stack

- **Framework**: FastAPI + Uvicorn (Python 3.11)
- **Banco de dados**: SQLite local (`polo.db`)
- **Parser RSS**: feedparser 6.0.11
- **Validação**: Pydantic v2
- **Deploy**: Railway (Nixpacks) — `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check**: `GET /feeds`

---

## Estrutura de arquivos

```
backend/
├── main.py        # App FastAPI, endpoints, lifespan
├── database.py    # Conexão SQLite e init/migrations
├── feeds.py       # Lógica de fetching RSS e scraping
├── models.py      # Schemas Pydantic (request bodies)
├── polo.db        # Banco SQLite (gerado em runtime)
├── requirements.txt
├── Procfile
└── railway.toml
```

---

## Banco de dados

### Esquema (4 tabelas)

```sql
feeds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL DEFAULT 'uncategorized',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_fetched_at TIMESTAMP          -- migration
)

articles (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id            INTEGER NOT NULL REFERENCES feeds(id),
    title              TEXT NOT NULL,
    url                TEXT NOT NULL UNIQUE,
    summary            TEXT,
    published_at       TIMESTAMP,
    image_url          TEXT,
    author             TEXT,           -- migration
    read_at            TIMESTAMP,      -- migration
    read_time_minutes  INTEGER         -- migration
)

tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
)

article_tags (
    article_id  INTEGER NOT NULL REFERENCES articles(id),
    tag_id      INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (article_id, tag_id)
)
```

### Migrations

Rodadas no startup via `try/except` em `init_db()`. Se a coluna já existe, o erro é silenciado. Colunas adicionadas por migration:

| Coluna | Tabela |
|---|---|
| `author` | `articles` |
| `read_at` | `articles` |
| `read_time_minutes` | `articles` |
| `last_fetched_at` | `feeds` |

---

## Ciclo de vida na startup

`main.py` usa o `lifespan` do FastAPI:

1. `init_db()` — cria tabelas + roda migrations
2. `_seed_and_refresh()` — dispara como **background task**:
   - Insere os 16 feeds padrão (ignora se URL já existe)
   - Chama `fetch_and_store_articles()` para cada feed

---

## Feeds padrão

| Categoria | Feed | Fonte |
|---|---|---|
| startups | a16z | RSS (`a16z.com/feed/`) |
| startups | a16z Substack | RSS (`a16z.substack.com/feed`) |
| startups | a16z Speedrun | RSS (Substack) |
| startups | pmarca | RSS (Substack) |
| startups | Sequoia | RSS (`sequoiacap.com/articles/feed.xml`) |
| startups | Sequoia Capital | **Scraper** (`sequoiacap.com/stories/`) |
| startups | First Round Review | RSS |
| startups | Stratechery | RSS (filtra posts pagos) |
| startups | Not Boring | RSS (Substack) |
| startups | The Generalist | RSS (Substack) |
| startups | The Rundown AI | RSS (Beehiiv) |
| startups | Import AI | RSS |
| brasil | Brazil Journal | RSS |
| brasil | Poder360 | RSS |
| brasil | Startupi | RSS |
| macro | The Economist | RSS |

---

## Lógica de fetching (`feeds.py`)

`fetch_and_store_articles(feed)` decide o modo com base na URL do feed.

### Modo 1 — RSS (padrão)

Usa `feedparser` em `run_in_executor` (não bloqueia o event loop). Limite de entradas por chamada: **15 para Startupi**, **30 para os demais**. Duplicatas são ignoradas via `INSERT OR IGNORE` (URL é UNIQUE).

**Tratamento especial por feed:**

| Feed | Comportamento |
|---|---|
| Stratechery | Skipa posts com conteúdo de texto < 800 chars (paywall) |
| Not Boring | Extrai HTML completo → texto; `author = "Packy McCormick"` |
| The Generalist | Extrai HTML completo; `author = "Mario Gabriele"` |
| pmarca | Extrai HTML completo; `author = "Marc Andreessen"` |
| First Round Review | Extrai HTML completo; `author = "First Round Capital"`; calcula `read_time_minutes` |
| Import AI | Extrai HTML completo; `author = "Jack Clark"`; calcula `read_time_minutes` |
| a16z Speedrun / a16z Substack | Extrai HTML completo; `author = nome do feed` |
| The Rundown AI | Extrai HTML completo |
| Startupi | Extrai HTML completo; limite = 15 entradas |
| Demais | `summary` dos primeiros 500 chars do campo RSS; sem autor definido |

### Modo 2 — Scraper HTML

Ativado para URLs cadastradas em `_SCRAPED_FEEDS` (atualmente só Sequoia Capital).

- Respeita intervalo de **24 h** via `last_fetched_at` — não refaz o scrape antes disso
- Faz GET com headers de browser real (`_BROWSER_HEADERS`)
- `_ArticleLinkParser` (subclasse de `HTMLParser`) coleta todos os `<a>` cujo `href` bate o regex configurado (ex: `/article/`)
- Salva com `INSERT OR IGNORE`; atualiza `last_fetched_at` ao final

### Funções auxiliares

| Função | O que faz |
|---|---|
| `_extract_image(entry)` | Busca URL de imagem em `media_content`, depois em `enclosures` |
| `_parse_date(entry)` | Tenta `published_parsed` → `updated_parsed` → `None` |
| `_html_to_text(html)` | Converte HTML para texto plano (`<br>` e `</p>` → `\n`, remove tags) |
| `_reading_time(text)` | `round(palavras / 200)`, mínimo 1 minuto |
| `_stratechery_is_free(entry)` | Retorna `True` se o texto do conteúdo tiver ≥ 800 chars |

---

## Endpoints

### Feeds

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/feeds` | Lista todos os feeds (`ORDER BY name`) |
| `POST` | `/feeds` | Cadastra novo feed; retorna 409 se URL já existe; dispara fetch em background |

Body de `POST /feeds`:
```json
{ "name": "string", "url": "https://...", "category": "startups" }
```

### Artigos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/articles` | Lista artigos paginados com filtros |
| `POST` | `/refresh` | Dispara refresh de todos os feeds em background |
| `PATCH` | `/articles/{id}/read` | Toggle read/unread (seta ou anula `read_at`) |

Query params de `GET /articles`:

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `category` | string | — | Filtra por categoria do feed |
| `feed_id` | int | — | Filtra por feed específico |
| `tag_id` | int | — | Filtra artigos com determinada tag |
| `limit` | int | 60 | Máximo de resultados |
| `offset` | int | 0 | Paginação |

A query agrega tags por artigo via `GROUP_CONCAT` e as devolve como lista de objetos `{ id, name }`.

### Tags

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/tags` | Lista todas as tags (`ORDER BY name`) |
| `POST` | `/tags` | Cria tag (idempotente — retorna a existente se o nome já existir) |
| `DELETE` | `/tags/{id}` | Deleta tag e todas as associações em `article_tags` |
| `POST` | `/articles/{id}/tags/{tag_id}` | Associa tag ao artigo (`INSERT OR IGNORE`) |
| `DELETE` | `/articles/{id}/tags/{tag_id}` | Remove associação tag ↔ artigo |

Body de `POST /tags`:
```json
{ "name": "string" }
```

---

## Adicionar um novo feed com scraper

1. Adicione a URL e configuração em `_SCRAPED_FEEDS` em `feeds.py`:

```python
_SCRAPED_FEEDS: dict[str, dict] = {
    "https://exemplo.com/stories/": {
        "article_re": re.compile(r"/post/", re.IGNORECASE),
        "base_url": "https://exemplo.com",
        "author": "Nome do Autor",  # ou None
    },
}
```

2. Adicione o feed em `DEFAULT_FEEDS` em `main.py` com a mesma URL.

---

## Pontos de atenção

- **CORS aberto** (`allow_origins=["*"]`) — em produção, restringir ao domínio do GitHub Pages.
- **Conexões SQLite** — `get_db()` abre e fecha uma conexão nova por chamada, sem pool.
- **Background tasks não são monitoradas** — se o servidor reiniciar durante um refresh, a operação é abandonada sem registro.
- **Feed "a16z" duplicado** na lista padrão (RSS oficial + Substack). São feeds distintos, diferenciados pela URL.
