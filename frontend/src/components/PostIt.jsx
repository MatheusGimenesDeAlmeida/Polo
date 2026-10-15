import { useState, useRef, useEffect } from 'react'

const COLORS = [
  '#c9a84c', // dourado (brand)
  '#5a9a6a', // sage
  '#5a7aaa', // azul aço
  '#aa5a7a', // rose
  '#7a5aaa', // lavanda
]

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return '' }
}

export default function PostIt({ ideia, onUpdate, onDelete, autoFocus }) {
  const [content, setContent] = useState(ideia.content || '')
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef(null)
  const expandedTextareaRef = useRef(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (expanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus()
      const len = expandedTextareaRef.current.value.length
      expandedTextareaRef.current.setSelectionRange(len, len)
    }
  }, [expanded])

  function handleBlur() {
    if (content !== (ideia.content || '')) {
      onUpdate(ideia.id, { content })
    }
  }

  function handleMinimize() {
    if (content !== (ideia.content || '')) {
      onUpdate(ideia.id, { content })
    }
    setExpanded(false)
  }

  const colorStyle = {
    '--postit-color': ideia.color,
    background: hexToRgba(ideia.color, 0.08),
    borderColor: hexToRgba(ideia.color, 0.28),
  }

  return (
    <>
      <div className="postit" style={colorStyle}>
        <div className="postit-header">
          <div className="postit-colors">
            {COLORS.map(c => (
              <button
                key={c}
                className={`postit-dot${ideia.color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => onUpdate(ideia.id, { color: c })}
                title="Mudar cor"
              />
            ))}
          </div>
          <div className="postit-actions">
            <button
              className="postit-expand"
              onClick={() => setExpanded(true)}
              title="Expandir"
            >
              ⤢
            </button>
            <button
              className="postit-delete"
              onClick={() => onDelete(ideia.id)}
              title="Excluir"
            >
              ×
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="postit-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          onBlur={handleBlur}
          placeholder="Escreva sua ideia…"
          rows={6}
        />

        <div className="postit-date">{formatDate(ideia.created_at)}</div>
      </div>

      {expanded && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) handleMinimize() }}
        >
          <div className="postit-modal" style={colorStyle}>
            <div className="postit-modal-header">
              <div className="postit-colors">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`postit-dot${ideia.color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => onUpdate(ideia.id, { color: c })}
                    title="Mudar cor"
                  />
                ))}
              </div>
              <div className="postit-actions">
                <button
                  className="postit-minimize"
                  onClick={handleMinimize}
                  title="Minimizar"
                >
                  ⊟ Minimizar
                </button>
                <button
                  className="postit-delete"
                  onClick={() => { onDelete(ideia.id); setExpanded(false) }}
                  title="Excluir"
                >
                  ×
                </button>
              </div>
            </div>

            <textarea
              ref={expandedTextareaRef}
              className="postit-textarea postit-textarea--expanded"
              value={content}
              onChange={e => setContent(e.target.value)}
              onBlur={handleBlur}
              placeholder="Escreva sua ideia…"
            />

            <div className="postit-date">{formatDate(ideia.created_at)}</div>
          </div>
        </div>
      )}
    </>
  )
}
