export default function SourceFilter({ feeds, activeId, onChange }) {
  if (feeds.length < 2) return null
  return (
    <div className="source-filter">
      <button
        className={`chip ${!activeId ? 'active' : ''}`}
        onClick={() => onChange(null)}
      >
        Todas as fontes
      </button>
      {feeds.map(f => (
        <button
          key={f.id}
          className={`chip ${activeId === f.id ? 'active' : ''}`}
          onClick={() => onChange(f.id)}
        >
          {f.name}
        </button>
      ))}
    </div>
  )
}
