# Polo — Personal Knowledge Feed

## Contexto
App de leitura pessoal que agrega RSS feeds de startups, 
Brasil e macro em uma interface unificada.

## Mascote
Camelo pixel art chamado Kaan. PNG em /frontend/public/kaan.png.
Usar como favicon e no empty state.

## Design
- Cor de fundo: #4a5568
- Estilo: dark, minimalista, retrô
- Fonte display: Playfair Display
- Fonte corpo: DM Sans
- Accent: #c9a84c (dourado)

## Categorias de feeds
- startups: a16z, Sequoia, First Round, YC, TechCrunch
- brasil: Brazil Journal, Poder360, Valor Econômico
- macro: The Economist, Financial Times

## Stack decidida
- Frontend: React + Vite + PWA (sem Next.js)
- Backend: Python 3.11 + FastAPI + feedparser
- DB: SQLite local (sem Postgres por enquanto)
- Deploy frontend: GitHub Pages
- Deploy backend: Railway

## O que NÃO fazer
- Não usar TypeScript ainda
- Não adicionar auth
- Não usar Docker
- Não mudar a paleta de cores

# Mascote
quando for criar o site usar a foto do camelo que está na raíz do projeto  como macote 