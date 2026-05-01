export default function Header({ onRefresh, refreshing }) {
  const kaanSrc = `${import.meta.env.BASE_URL}kaan.png`

  return (
    <header className="header">
      <div className="header-brand">
        <img src={kaanSrc} alt="Kaan" className="header-mascot" />
        <div>
          <h1 className="header-title">POLO</h1>
          <p className="header-subtitle">seu feed de leitura</p>
        </div>
      </div>
      <button
        className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
        onClick={onRefresh}
        title="Atualizar feeds"
        disabled={refreshing}
      >
        ↻
      </button>
    </header>
  )
}
