import { useState } from 'react'
import TagPicker from './TagPicker'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function slugify(title) {
  return (title || 'reflexao')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60)
}

export function buildMarkdown(r) {
  const date = r.published_at ? new Date(r.published_at).toISOString().split('T')[0] : ''
  const savedAt = r.saved_at
    ? new Date(r.saved_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]
  const tagNames = (r.tags || []).map(t => t.name)
  const tagList = ['reflexao', ...tagNames].join(', ')

  return `---
titulo: "${(r.title || '').replace(/"/g, '\\"')}"
fonte: "${r.feed_name || ''}"
data: ${date}
url: "${r.url || ''}"
insight: "${(r.insight || '').replace(/"/g, '\\"')}"
tags: [${tagList}]
salvoEm: ${savedAt}
---

## Insight
${r.insight || ''}

## E daí pra Nstech?
${r.nstech || ''}

## Ideia / hipótese
${r.ideia || ''}

## Anotação
${r.anotacao || ''}`.trim()
}

export function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReflectionModal({ reflection, onUpdate, onRemove, onClose, allTags, onTagsChange, onTagCreated }) {
  const [insight, setInsight] = useState(reflection.insight || '')
  const [nstech, setNstech] = useState(reflection.nstech || '')
  const [ideia, setIdeia] = useState(reflection.ideia || '')
  const [anotacao, setAnotacao] = useState(reflection.anotacao || '')

  function handleBlur(field, value) {
    onUpdate(reflection.article_id, field, value)
  }

  async function handleRemoveTag(tagId) {
    await fetch(`${API_URL}/articles/${reflection.article_id}/tags/${tagId}`, { method: 'DELETE' })
    onTagsChange(reflection.article_id, (reflection.tags || []).filter(t => t.id !== tagId))
  }

  function handleExport() {
    const snap = { ...reflection, insight, nstech, ideia, anotacao }
    downloadFile(`${slugify(reflection.title)}.md`, buildMarkdown(snap))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        <div className="modal-head">
          <div className="modal-article-meta">
            <span className="rc-source">{reflection.feed_name}</span>
            {reflection.author && <span className="rc-author">{reflection.author}</span>}
          </div>
          <button className="modal-close" onClick={onClose} title="Fechar">×</button>
        </div>

        <a
          className="modal-title"
          href={reflection.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {reflection.title}
        </a>

        <div className="modal-body">
          <div className="rc-field rc-field--insight">
            <div className="rc-field-header">
              <label className="rc-label">Insight em uma linha</label>
              <span className={`rc-char-count${insight.length >= 130 ? ' rc-char-count--warn' : ''}`}>
                {insight.length}/140
              </span>
            </div>
            <input
              className="rc-input-insight"
              value={insight}
              onChange={e => setInsight(e.target.value.slice(0, 140))}
              onBlur={() => handleBlur('insight', insight)}
              placeholder="Por que isso importa, em uma frase?"
              maxLength={140}
              autoFocus
            />
          </div>

          <div className="rc-field">
            <label className="rc-label">E daí pra Nstech?</label>
            <textarea
              className="rc-textarea rc-textarea--short"
              value={nstech}
              onChange={e => setNstech(e.target.value)}
              onBlur={() => handleBlur('nstech', nstech)}
              placeholder="Implicação estratégica, ângulo de produto, risco/oportunidade..."
              rows={3}
            />
          </div>

          <div className="rc-field">
            <label className="rc-label">Ideia / hipótese</label>
            <textarea
              className="rc-textarea rc-textarea--short"
              value={ideia}
              onChange={e => setIdeia(e.target.value)}
              onBlur={() => handleBlur('ideia', ideia)}
              placeholder="Que ideia ou hipótese de negócio isso dispara?"
              rows={3}
            />
          </div>

          <div className="rc-field">
            <label className="rc-label">Anotação livre</label>
            <textarea
              className="rc-textarea rc-textarea--tall"
              value={anotacao}
              onChange={e => setAnotacao(e.target.value)}
              onBlur={() => handleBlur('anotacao', anotacao)}
              placeholder="Notas soltas, links, citações… (aceita Markdown)"
              rows={5}
            />
          </div>
        </div>

        <div className="modal-tags-row">
          <div className="modal-tags-list">
            {(reflection.tags || []).map(t => (
              <span key={t.id} className="card-tag card-tag--removable">
                {t.name}
                <button
                  className="card-tag-remove"
                  onClick={() => handleRemoveTag(t.id)}
                  title="Remover tag deste artigo"
                >×</button>
              </span>
            ))}
          </div>
          <TagPicker
            article={{ id: reflection.article_id, tags: reflection.tags || [] }}
            allTags={allTags}
            onTagsChange={onTagsChange}
            onTagCreated={onTagCreated}
          />
        </div>

        <div className="modal-footer">
          <button className="btn-remove-reflexao" onClick={onRemove}>
            Remover da reflexão
          </button>
          <button className="btn-export" onClick={handleExport}>
            Exportar .md
          </button>
        </div>

      </div>
    </div>
  )
}
