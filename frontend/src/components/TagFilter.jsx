export default function TagFilter({ tags, activeId, onChange, onDelete }) {
  if (tags.length === 0) return null
  return (
    <div className="tag-filter">
      <span className="tag-filter-label">Tags</span>
      {tags.map(t => (
        <div
          key={t.id}
          className={`chip chip-deletable ${activeId === t.id ? 'active' : ''}`}
          onClick={() => onChange(activeId === t.id ? null : t.id)}
        >
          <span>{t.name}</span>
          <button
            className="chip-delete-btn"
            onClick={e => { e.stopPropagation(); onDelete(t.id) }}
            title="Deletar tag"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
