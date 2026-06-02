import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import SourceFilter from './components/SourceFilter'
import TagFilter from './components/TagFilter'
import ArticleCard from './components/ArticleCard'
import EmptyState from './components/EmptyState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [activeFeedId, setActiveFeedId] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [activeTagId, setActiveTagId] = useState(null)

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '60', category: 'startups' })
      const res = await fetch(`${API_URL}/articles?${params}`)
      if (!res.ok) throw new Error(`Erro ${res.status}: falha ao buscar artigos`)
      setArticles(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArticles()
    setActiveFeedId(null)
  }, [fetchArticles])

  useEffect(() => {
    fetch(`${API_URL}/tags`)
      .then(r => r.json())
      .then(setAllTags)
      .catch(() => {})
  }, [])

  const feedsInView = useMemo(() => {
    const seen = new Map()
    articles.forEach(a => {
      if (!seen.has(a.feed_id)) seen.set(a.feed_id, { id: a.feed_id, name: a.feed_name })
    })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [articles])

  const displayedArticles = useMemo(() =>
    articles
      .filter(a => !activeFeedId || a.feed_id === activeFeedId)
      .filter(a => !activeTagId || (a.tags || []).some(t => t.id === activeTagId)),
    [articles, activeFeedId, activeTagId]
  )

  function handleTagsChange(articleId, newTags) {
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, tags: newTags } : a))
  }

  async function handleReadToggle(articleId) {
    const res = await fetch(`${API_URL}/articles/${articleId}/read`, { method: 'PATCH' })
    if (!res.ok) return
    const { read_at } = await res.json()
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, read_at } : a))
  }

  async function handleTagDelete(tagId) {
    await fetch(`${API_URL}/tags/${tagId}`, { method: 'DELETE' })
    setAllTags(prev => prev.filter(t => t.id !== tagId))
    if (activeTagId === tagId) setActiveTagId(null)
    setArticles(prev => prev.map(a => ({ ...a, tags: (a.tags || []).filter(t => t.id !== tagId) })))
  }

  function handleTagCreated(tag) {
    setAllTags(prev =>
      prev.some(t => t.id === tag.id)
        ? prev
        : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch(`${API_URL}/refresh`, { method: 'POST' })
      setTimeout(() => fetchArticles(), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setTimeout(() => setRefreshing(false), 3000)
    }
  }

  return (
    <div className="app">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />
      <main className="main">
        <SourceFilter feeds={feedsInView} activeId={activeFeedId} onChange={setActiveFeedId} />
        <TagFilter tags={allTags} activeId={activeTagId} onChange={setActiveTagId} onDelete={handleTagDelete} />

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <p>Buscando artigos…</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={() => fetchArticles()}>Tentar novamente</button>
          </div>
        ) : displayedArticles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid">
            {displayedArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                allTags={allTags}
                onTagsChange={handleTagsChange}
                onTagCreated={handleTagCreated}
                onReadToggle={handleReadToggle}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
