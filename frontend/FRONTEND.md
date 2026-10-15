# Polo — Documentação do Frontend

## Stack

- **Framework**: React 18 + Vite 5
- **PWA**: vite-plugin-pwa (service worker com auto-update)
- **Linguagem**: JavaScript (JSX, sem TypeScript)
- **Estilo**: CSS puro em `index.css` (sem Tailwind, sem CSS Modules)
- **Deploy**: GitHub Pages — `base: '/Polo/'` no Vite
- **Fontes**: Playfair Display (display) + DM Sans (corpo), carregadas via Google Fonts no `index.html`

---

## Estrutura de arquivos

```
frontend/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                    # Entry point
    ├── App.jsx                     # Componente raiz / orquestrador de estado
    ├── index.css                   # Todos os estilos globais
    └── components/
        ├── Header.jsx              # Cabeçalho com mascote e botão de refresh
        ├── SourceFilter.jsx        # Chips de filtro por feed
        ├── TagFilter.jsx           # Chips de filtro por tag (com delete)
        ├── ArticleCard.jsx         # Card de artigo
        ├── TagPicker.jsx           # Dropdown de gerenciamento de tags (portal)
        ├── EmptyState.jsx          # Estado vazio com mascote Kaan
        └── FeedFilter.jsx          # Componente legado — não está em uso
```

---

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL base do backend | `http://localhost:8000` |

Definir em `.env.local` para desenvolvimento e na plataforma de deploy para produção.

---

## PWA

Configurado em `vite.config.js` com `vite-plugin-pwa`:

- `registerType: 'autoUpdate'` — atualiza o service worker automaticamente
- Ícone: `kaan.png` (mascote Kaan) em 192×192 e 512×512
- `display: 'standalone'` — abre sem barra do browser
- `theme_color` e `background_color`: `#4a5568`
- `start_url`: `/Polo/`

---

## Design system (`index.css`)

### Tokens CSS (variáveis)

| Variável | Valor | Uso |
|---|---|---|
| `--bg` | `#4a5568` | Fundo principal |
| `--bg-dark` | `#2d3748` | Fundo dos cards |
| `--bg-darker` | `#1a202c` | Header, dropdowns |
| `--text` | `#f7fafc` | Texto principal |
| `--text-muted` | `#a0aec0` | Texto secundário |
| `--accent` | `#c9a84c` | Dourado — cor de destaque |
| `--accent-dim` | `rgba(201,168,76,0.2)` | Fundo de elementos ativos |
| `--accent-border` | `rgba(201,168,76,0.4)` | Bordas de destaque |
| `--border` | `rgba(255,255,255,0.08)` | Bordas sutis |
| `--radius` | `12px` | Border radius padrão dos cards |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.35)` | Sombra dos cards |

### Tipografia

- **Playfair Display** (serif): título POLO, títulos de artigos, títulos do empty state
- **DM Sans** (sans-serif): todo o resto

### Grid de artigos

```css
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
gap: 1.25rem;
```

Colapsa para `1fr` em telas ≤ 640px.

---

## Arquitetura de estado (`App.jsx`)

`App` é o único componente com estado significativo. Toda a lógica de dados vive aqui; os filhos são puramente apresentacionais.

### Estado

| State | Tipo | Descrição |
|---|---|---|
| `articles` | `Article[]` | Lista de artigos carregados da API |
| `loading` | `boolean` | Exibe spinner durante fetch inicial |
| `refreshing` | `boolean` | Controla animação do botão de refresh |
| `error` | `string \| null` | Mensagem de erro do fetch |
| `activeFeedId` | `number \| null` | Feed selecionado no SourceFilter |
| `allTags` | `Tag[]` | Todas as tags disponíveis |
| `activeTagId` | `number \| null` | Tag selecionada no TagFilter |

### Valores derivados (useMemo)

**`feedsInView`** — lista de feeds únicos derivada dos artigos carregados, não de uma chamada à API `/feeds`. Garante que o filtro só mostra feeds que têm artigos visíveis atualmente.

**`displayedArticles`** — filtragem client-side sobre `articles`:
1. Filtra por `activeFeedId` se definido
2. Filtra por `activeTagId` se definido (verifica se o artigo tem aquela tag)

> Nenhum filtro dispara re-fetch — tudo é feito sobre os dados já em memória.

### Fetch inicial

```
GET /articles?limit=60&category=startups
```

**Atenção**: a categoria está hardcoded como `'startups'`. Brasil e macro não são carregados na versão atual.

### Handlers

| Função | O que faz |
|---|---|
| `fetchArticles()` | Busca artigos da API, reseta loading/error |
| `handleReadToggle(id)` | PATCH `/articles/{id}/read`, atualiza `read_at` no estado local |
| `handleTagsChange(id, newTags)` | Atualiza a lista de tags de um artigo no estado local (sem re-fetch) |
| `handleTagDelete(id)` | DELETE `/tags/{id}`, remove do `allTags` e dos artigos afetados |
| `handleTagCreated(tag)` | Adiciona nova tag ao `allTags` (deduplica por id) |
| `handleRefresh()` | POST `/refresh`, aguarda 3 s e re-fetcha artigos |

---

## Componentes

### `Header`

Props: `onRefresh`, `refreshing`

- Exibe mascote Kaan (`BASE_URL + 'kaan.png'`) e o título POLO
- Botão `↻` que recebe a classe `.spinning` (animação CSS) enquanto `refreshing === true` e fica `disabled`

---

### `SourceFilter`

Props: `feeds`, `activeId`, `onChange`

- Renderiza chips para cada feed presente em `feedsInView`
- Retorna `null` se `feeds.length < 2` (sem necessidade de filtro)
- Chip "Todas as fontes" seta `activeId = null`

---

### `TagFilter`

Props: `tags`, `activeId`, `onChange`, `onDelete`

- Retorna `null` se não há tags
- Chip de tag: clique alterna filtro (toggle — clicar na ativa desativa)
- Botão `×` dentro do chip chama `onDelete` sem propagar o clique ao chip pai

---

### `ArticleCard`

Props: `article`, `allTags`, `onTagsChange`, `onTagCreated`, `onReadToggle`

O card inteiro é um `<a>` com `target="_blank"`. Ações internas usam `e.preventDefault()` + `e.stopPropagation()` para não abrir o link.

**Estrutura visual:**

```
┌─────────────────────────────┐
│  [imagem — 172px, lazy]     │  (opcional)
├─────────────────────────────┤
│  FEED NAME        X min     │
│  autor            DD/MM/AA  │
│                             │
│  Título do artigo (3 linhas)│
│  Resumo... (3 linhas)       │
│                             │
│  [tag] [tag]   [○] [#]      │
└─────────────────────────────┘
```

- `card--read`: opacidade 55% quando `read_at` está preenchido
- Imagem com `onError`: esconde o container se a imagem falhar
- `read_time_minutes` e `published_at` são opcionais — não renderizam se ausentes
- `[○]` → botão de lido/não lido; `[#]` → abre o TagPicker

---

### `TagPicker`

Props: `article`, `allTags`, `onTagsChange`, `onTagCreated`

Dropdown de gerenciamento de tags renderizado via **`createPortal`** no `document.body`. Isso evita o clipping causado pelo `overflow: hidden` dos cards.

**Posicionamento**: calculado no clique via `getBoundingClientRect()` do botão `#`. Fecha ao clicar fora ou ao scroll.

**Fluxo de toggle de tag existente:**
1. Identifica se o artigo já tem a tag
2. `POST` ou `DELETE` em `/articles/{id}/tags/{tag_id}`
3. Chama `onTagsChange` para atualizar o estado no pai

**Fluxo de criar + aplicar tag nova:**
1. `POST /tags` com o nome digitado (normalizado para lowercase)
2. Chama `onTagCreated` para adicionar ao `allTags` global
3. `POST /articles/{id}/tags/{tag_id}` para já aplicar ao artigo atual
4. Chama `onTagsChange` para refletir no card

---

### `EmptyState`

Sem props. Exibe o mascote Kaan centralizado com texto orientando o usuário a clicar em `↻`.

---

### `FeedFilter` (legado)

Componente de filtro por categoria (startups / brasil / macro) que **não está importado em nenhum lugar**. Pode ser removido ou reaproveitado para implementar o filtro de categorias.

---

## Fluxo de dados resumido

```
App
├── fetchArticles() → GET /articles?category=startups
│   └── setArticles([...])
│
├── feedsInView ← derivado de articles (useMemo)
├── displayedArticles ← filtrado por activeFeedId + activeTagId (useMemo)
│
├── Header
│   └── onRefresh → POST /refresh → setTimeout(fetchArticles, 3000)
│
├── SourceFilter ← feedsInView, activeFeedId
├── TagFilter ← allTags, activeTagId
│   └── onDelete → DELETE /tags/{id} → atualiza allTags + articles
│
└── ArticleCard (× N) ← displayedArticles
    ├── onReadToggle → PATCH /articles/{id}/read → atualiza read_at
    └── TagPicker
        ├── toggle → POST/DELETE /articles/{id}/tags/{tag_id} → onTagsChange
        └── createAndApply → POST /tags → POST /articles/{id}/tags/{tag_id}
                           → onTagCreated + onTagsChange
```

---

## Pontos de atenção

- **Categoria hardcoded**: `fetchArticles` sempre busca `category=startups`. Para habilitar brasil/macro, é necessário adicionar um seletor de categoria e re-fetchar ao mudar.
- **`FeedFilter.jsx` não utilizado**: arquivo pode ser deletado ou aproveitado para filtro de categorias.
- **Refresh otimista com delay**: após `POST /refresh`, o frontend aguarda 3 s antes de re-fetchar. Se o backend demorar mais, os artigos novos não aparecem.
- **`allTags` carregado uma vez**: buscado no mount e atualizado localmente via handlers. Se outra aba criar uma tag, ela não aparece sem reload.
