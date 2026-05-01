function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function ArticleCard({ article }) {
  return (
    <a
      className="card"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {article.image_url && (
        <div className="card-img-wrap">
          <img
            src={article.image_url}
            alt=""
            className="card-img"
            loading="lazy"
            onError={e => { e.target.parentElement.style.display = 'none' }}
          />
        </div>
      )}
      <div className="card-body">
        <div className="card-meta">
          <span className="card-source">{article.feed_name}</span>
          {article.published_at && (
            <span className="card-date">{formatDate(article.published_at)}</span>
          )}
        </div>
        <h2 className="card-title">{article.title}</h2>
        {article.summary && (
          <p className="card-summary">{article.summary}</p>
        )}
      </div>
    </a>
  )
}
