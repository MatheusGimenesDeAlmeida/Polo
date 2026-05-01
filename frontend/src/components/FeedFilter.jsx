export default function FeedFilter({ categories, active, onChange }) {
  return (
    <nav className="filter">
      {categories.map(cat => (
        <button
          key={cat.id ?? 'all'}
          className={`filter-btn ${active === cat.id ? 'active' : ''}`}
          onClick={() => onChange(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  )
}
