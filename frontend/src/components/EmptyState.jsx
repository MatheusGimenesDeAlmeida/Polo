export default function EmptyState() {
  const kaanSrc = `${import.meta.env.BASE_URL}kaan.png`

  return (
    <div className="empty">
      <img src={kaanSrc} alt="Kaan" className="empty-mascot" />
      <h2 className="empty-title">Nada por aqui ainda</h2>
      <p className="empty-text">Clique em ↻ para buscar os artigos mais recentes.</p>
    </div>
  )
}
