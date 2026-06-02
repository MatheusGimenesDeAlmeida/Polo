import TagPicker from './TagPicker'

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

export default function ArticleCard({ article, allTags, onTagsChange, onTagCreated, onReadToggle }) {
  const tags = article.tags || []
  const isRead = !!article.read_at

  function handleReadClick(e) {
    e.preventDefault()
    e.stopPropagation()
    onReadToggle(article.id)
  }

  return (
    <a
      className={`card${isRead ? ' card--read' : ''}`}
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
          <div className="card-source-wrap">
            <span className="card-source">{article.feed_name}</span>
            {article.author && (
              <span className="card-author">{article.author}</span>
            )}
          </div>
          <div className="card-meta-right">
            {article.read_time_minutes && (
              <span className="card-read-time">{article.read_time_minutes} min</span>
            )}
            {article.published_at && (
              <span className="card-date">{formatDate(article.published_at)}</span>
            )}
          </div>
        </div>
        <h2 className="card-title">{article.title}</h2>
        {article.summary && (
          <p className="card-summary">{article.summary}</p>
        )}
        <div className="card-footer">
          <div className="card-tags">
            {tags.map(t => (
              <span key={t.id} className="card-tag">{t.name}</span>
            ))}
          </div>
          <div className="card-actions">
            <button
              className={`btn-read${isRead ? ' btn-read--done' : ''}`}
              onClick={handleReadClick}
              title={isRead ? 'Marcar como não lido' : 'Marcar como lido'}
            >
              {isRead ? '✓' : '○'}
            </button>
            <TagPicker
              article={article}
              allTags={allTags}
              onTagsChange={onTagsChange}
              onTagCreated={onTagCreated}
            />
          </div>
        </div>
      </div>
    </a>
  )
}
