import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import SourceFilter from './components/SourceFilter'
import TagFilter from './components/TagFilter'
import ArticleCard from './components/ArticleCard'
import EmptyState from './components/EmptyState'
import ReflectionModal, { buildMarkdown, downloadFile } from './components/ReflectionCard'
import PostIt from './components/PostIt'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [activeFeedId, setActiveFeedId] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [activeTagId, setActiveTagId] = useState(null)
  const [reflections, setReflections] = useState([])
  const [activeView, setActiveView] = useState('feed')
  const [openReflectionId, setOpenReflectionId] = useState(null)
  const [ideias, setIdeias] = useState([])
  const [newIdeiaId, setNewIdeiaId] = useState(null)

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

  useEffect(() => {
    fetch(`${API_URL}/reflections`)
      .then(r => r.json())
      .then(setReflections)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/ideias`)
      .then(r => r.json())
      .then(setIdeias)
      .catch(() => {})
  }, [])

  const savedArticleIds = useMemo(
    () => new Set(reflections.map(r => r.article_id)),
    [reflections]
  )

  const openReflection = useMemo(
    () => reflections.find(r => r.article_id === openReflectionId) ?? null,
    [reflections, openReflectionId]
  )

  const feedsInView = useMemo(() => {
    const seen = new Map()
    articles.forEach(a => {
      if (!seen.has(a.feed_id)) seen.set(a.feed_id, { id: a.feed_id, name: a.feed_name })
    })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [articles])

  const displayedArticles = useMemo(() =>
    articles.filter(a => !activeFeedId || a.feed_id === activeFeedId),
    [articles, activeFeedId]
  )

  const displayedReflections = useMemo(() =>
    reflections.filter(r => !activeTagId || (r.tags || []).some(t => t.id === activeTagId)),
    [reflections, activeTagId]
  )

  function handleTagsChange(articleId, newTags) {
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, tags: newTags } : a))
    setReflections(prev => prev.map(r => r.article_id === articleId ? { ...r, tags: newTags } : r))
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
    setReflections(prev => prev.map(r => ({ ...r, tags: (r.tags || []).filter(t => t.id !== tagId) })))
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

  async function handleSaveReflection(article) {
    const res = await fetch(`${API_URL}/articles/${article.id}/reflect`, { method: 'POST' })
    if (!res.ok) return
    const reflection = await res.json()
    setReflections(prev =>
      prev.some(r => r.article_id === article.id)
        ? prev
        : [{
            ...reflection,
            title: article.title,
            url: article.url,
            summary: article.summary,
            published_at: article.published_at,
            author: article.author,
            image_url: article.image_url,
            read_time_minutes: article.read_time_minutes,
            feed_name: article.feed_name,
            category: article.category,
            tags: article.tags || [],
          }, ...prev]
    )
  }

  async function handleRemoveReflection(articleId) {
    await fetch(`${API_URL}/articles/${articleId}/reflect`, { method: 'DELETE' })
    setReflections(prev => prev.filter(r => r.article_id !== articleId))
  }

  async function handleUpdateReflection(articleId, field, value) {
    await fetch(`${API_URL}/articles/${articleId}/reflect`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setReflections(prev =>
      prev.map(r => r.article_id === articleId ? { ...r, [field]: value } : r)
    )
  }

  async function handleCreateIdeia() {
    const res = await fetch(`${API_URL}/ideias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '', color: '#c9a84c' }),
    })
    if (!res.ok) return
    const ideia = await res.json()
    setIdeias(prev => [ideia, ...prev])
    setNewIdeiaId(ideia.id)
  }

  async function handleUpdateIdeia(id, updates) {
    await fetch(`${API_URL}/ideias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setIdeias(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  async function handleDeleteIdeia(id) {
    await fetch(`${API_URL}/ideias/${id}`, { method: 'DELETE' })
    setIdeias(prev => prev.filter(i => i.id !== id))
    if (newIdeiaId === id) setNewIdeiaId(null)
  }

  function handleExportAll() {
    if (reflections.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    const combined = reflections.map(r => buildMarkdown(r)).join('\n\n---\n\n')
    downloadFile(`polo-reflexoes-${today}.md`, combined)
  }

  return (
    <div className="app">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />
      <main className="main">
        <div className="view-tabs">
          <button
            className={`view-tab${activeView === 'feed' ? ' active' : ''}`}
            onClick={() => setActiveView('feed')}
          >
            Feed
          </button>
          <button
            className={`view-tab${activeView === 'reflexao' ? ' active' : ''}`}
            onClick={() => setActiveView('reflexao')}
          >
            Reflexão{reflections.length > 0 ? ` (${reflections.length})` : ''}
          </button>
          <button
            className={`view-tab${activeView === 'ideias' ? ' active' : ''}`}
            onClick={() => setActiveView('ideias')}
          >
            Ideias{ideias.length > 0 ? ` (${ideias.length})` : ''}
          </button>
        </div>

        {activeView === 'feed' && (
          <>
            <SourceFilter feeds={feedsInView} activeId={activeFeedId} onChange={setActiveFeedId} />

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
                    onReadToggle={handleReadToggle}
                    isSaved={savedArticleIds.has(article.id)}
                    onSaveReflection={handleSaveReflection}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'reflexao' && (
          <div className="reflection-view">
            {reflections.length === 0 ? (
              <div className="reflection-empty">
                <p>Nenhum artigo salvo ainda.</p>
                <p>Clique em <strong>☆</strong> em qualquer artigo para salvar para reflexão.</p>
              </div>
            ) : (
              <>
                <div className="reflection-toolbar">
                  <span className="reflection-count">
                    {reflections.length} {reflections.length === 1 ? 'item salvo' : 'itens salvos'}
                  </span>
                  <button className="btn-export-all" onClick={handleExportAll}>
                    Exportar todas →
                  </button>
                </div>
                <TagFilter
                  tags={allTags}
                  activeId={activeTagId}
                  onChange={setActiveTagId}
                  onDelete={handleTagDelete}
                />
                <div className="grid">
                  {displayedReflections.map(r => (
                    <ArticleCard
                      key={r.article_id}
                      article={r}
                      mode="reflexao"
                      onOpenReflection={() => setOpenReflectionId(r.article_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeView === 'ideias' && (
          <div className="ideias-view">
            <div className="ideias-toolbar">
              <span className="ideias-count">
                {ideias.length} {ideias.length === 1 ? 'ideia' : 'ideias'}
              </span>
              <button className="btn-nova-ideia" onClick={handleCreateIdeia}>
                + Nova ideia
              </button>
            </div>
            {ideias.length === 0 ? (
              <div className="ideias-empty">
                <p>Nenhuma ideia ainda.</p>
                <p>Clique em <strong>+ Nova ideia</strong> para começar.</p>
              </div>
            ) : (
              <div className="ideias-grid">
                {ideias.map(i => (
                  <PostIt
                    key={i.id}
                    ideia={i}
                    onUpdate={handleUpdateIdeia}
                    onDelete={handleDeleteIdeia}
                    autoFocus={i.id === newIdeiaId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {openReflectionId && openReflection && (
        <ReflectionModal
          reflection={openReflection}
          onUpdate={handleUpdateReflection}
          onRemove={() => {
            handleRemoveReflection(openReflectionId)
            setOpenReflectionId(null)
          }}
          onClose={() => setOpenReflectionId(null)}
          allTags={allTags}
          onTagsChange={handleTagsChange}
          onTagCreated={handleTagCreated}
        />
      )}
    </div>
  )
}
