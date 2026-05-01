import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import FeedFilter from './components/FeedFilter'
import ArticleCard from './components/ArticleCard'
import EmptyState from './components/EmptyState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CATEGORIES = [
  { id: null, label: 'Todos' },
  { id: 'startups', label: 'Startups' },
  { id: 'brasil', label: 'Brasil' },
  { id: 'macro', label: 'Macro' },
]

export default function App() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState(null)
  const [error, setError] = useState(null)

  const fetchArticles = useCallback(async (cat) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (cat) params.set('category', cat)
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
    fetchArticles(category)
  }, [category, fetchArticles])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch(`${API_URL}/refresh`, { method: 'POST' })
      setTimeout(() => fetchArticles(category), 3000)
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
        <FeedFilter categories={CATEGORIES} active={category} onChange={setCategory} />

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <p>Buscando artigos…</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={() => fetchArticles(category)}>Tentar novamente</button>
          </div>
        ) : articles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
