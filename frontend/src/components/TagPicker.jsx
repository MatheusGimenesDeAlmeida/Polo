import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TagPicker({ article, allTags, onTagsChange, onTagCreated }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [input, setInput] = useState('')
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  function handleOpen(e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(o => !o)
  }

  const articleTagIds = new Set((article.tags || []).map(t => t.id))

  async function toggle(tag) {
    const has = articleTagIds.has(tag.id)
    await fetch(`${API_URL}/articles/${article.id}/tags/${tag.id}`, {
      method: has ? 'DELETE' : 'POST',
    })
    const newTags = has
      ? article.tags.filter(t => t.id !== tag.id)
      : [...(article.tags || []), tag]
    onTagsChange(article.id, newTags)
  }

  async function createAndApply(e) {
    e.preventDefault()
    const name = input.trim().toLowerCase()
    if (!name) return
    setInput('')
    const res = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const tag = await res.json()
    onTagCreated(tag)
    if (!articleTagIds.has(tag.id)) {
      await fetch(`${API_URL}/articles/${article.id}/tags/${tag.id}`, { method: 'POST' })
      onTagsChange(article.id, [...(article.tags || []), tag])
    }
  }

  return (
    <>
      <button ref={btnRef} className="tag-btn" onClick={handleOpen} title="Gerenciar tags">
        #
      </button>
      {open && createPortal(
        <div ref={panelRef} className="tag-panel" style={{ top: pos.top, left: pos.left }}>
          {allTags.length === 0 && (
            <p className="tag-panel-empty">Crie sua primeira tag abaixo</p>
          )}
          {allTags.map(tag => (
            <label key={tag.id} className="tag-option">
              <input
                type="checkbox"
                checked={articleTagIds.has(tag.id)}
                onChange={() => toggle(tag)}
              />
              {tag.name}
            </label>
          ))}
          <form onSubmit={createAndApply} className="tag-create-form">
            <input
              className="tag-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="nova tag…"
              autoFocus
            />
          </form>
        </div>,
        document.body
      )}
    </>
  )
}
