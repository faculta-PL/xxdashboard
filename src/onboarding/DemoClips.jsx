import { useEffect, useRef } from 'react'
import { drawKingX } from '../games/chars'
import { useI18n } from '../i18n'

const CLIP_KEYS = {
  notes: { label: 'nav.notes', caption: 'demo.notesCaption' },
  kanban: { label: 'nav.ideas', caption: 'demo.kanbanCaption' },
  projets: { label: 'nav.projects', caption: 'demo.projectsCaption' },
  chat: { label: 'nav.chat', caption: 'demo.chatCaption' },
}

function KingXCameo() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    let frame = 0
    let raf
    const tick = () => {
      frame += 1
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const bounce = Math.sin(frame / 18) * 3
      drawKingX(ctx, w / 2, h / 2 + bounce, 22, 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={56} height={56} className="pointer-events-none h-10 w-10" aria-hidden />
}

function NotesDemo({ t }) {
  return (
    <div className="demo-clip demo-clip-notes">
      <div className="demo-clip-bar">
        <span>{t('demo.newNote')}</span>
        <span className="demo-clip-x">×</span>
      </div>
      <div className="demo-clip-body">
        <div className="demo-line demo-line-title" />
        <div className="demo-line demo-line-long" />
        <div className="demo-line demo-line-mid" />
        <div className="demo-chip">{t('demo.chip')}</div>
      </div>
      <div className="demo-clip-foot">
        <span className="demo-btn ghost">{t('common.cancel')}</span>
        <span className="demo-btn solid demo-save">{t('common.save')}</span>
      </div>
    </div>
  )
}

function KanbanDemo({ t }) {
  return (
    <div className="demo-clip demo-clip-kanban">
      <div className="demo-kanban">
        {[t('demo.colNew'), t('demo.colTalk'), t('demo.colKept')].map((col) => (
          <div key={col} className="demo-col">
            <p>{col}</p>
            {col === t('demo.colNew') && <div className="demo-card demo-card-move">{t('demo.cardClient')}</div>}
            {col === t('demo.colTalk') && <div className="demo-card">{t('demo.cardBrief')}</div>}
            {col === t('demo.colKept') && <div className="demo-card ghost-card">{t('demo.cardReady')}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjetsDemo({ t }) {
  return (
    <div className="demo-clip demo-clip-projets">
      <div className="demo-clip-bar">
        <span>{t('demo.newProject')}</span>
        <span className="demo-clip-x">×</span>
      </div>
      <div className="demo-clip-body">
        <p className="demo-label">{t('notes.title')}</p>
        <div className="demo-field demo-type">
          <span className="demo-typed">{t('demo.typed')}</span>
        </div>
        <p className="demo-label">{t('calendar.description')}</p>
        <div className="demo-field h-8" />
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sage-100">
          <div className="demo-progress h-full rounded-full bg-sage-700" />
        </div>
      </div>
      <div className="demo-clip-foot">
        <span className="demo-btn ghost">{t('common.cancel')}</span>
        <span className="demo-btn solid">{t('common.save')}</span>
      </div>
      <div className="demo-cameo" aria-hidden>
        <KingXCameo />
      </div>
    </div>
  )
}

function ChatDemo({ t }) {
  return (
    <div className="demo-clip demo-clip-chat">
      <div className="demo-clip-bar">
        <span>{t('demo.general')}</span>
      </div>
      <div className="demo-chat-thread">
        <div className="demo-bubble in demo-b1">{t('demo.chat1')}</div>
        <div className="demo-bubble out demo-b2">{t('demo.chat2')}</div>
        <div className="demo-bubble in demo-b3">{t('demo.chat3')}</div>
      </div>
      <div className="demo-chat-input">{t('chat.placeholder')}</div>
    </div>
  )
}

const RENDER = {
  notes: NotesDemo,
  kanban: KanbanDemo,
  projets: ProjetsDemo,
  chat: ChatDemo,
}

export function DemoClip({ kind, className = '' }) {
  const { t } = useI18n()
  const meta = CLIP_KEYS[kind] || CLIP_KEYS.notes
  const View = RENDER[kind] || NotesDemo
  return (
    <figure className={`overflow-hidden rounded-2xl border border-sage-200 bg-white/80 shadow-sm ${className}`}>
      <View t={t} />
      <figcaption className="border-t border-sage-100 px-3 py-2">
        <p className="text-sm font-semibold text-sage-900">{t(meta.label)}</p>
        <p className="text-xs text-sage-600">{t(meta.caption)}</p>
      </figcaption>
    </figure>
  )
}

export function DemoGrid({ ids = ['notes', 'kanban', 'projets', 'chat'] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ids.map((id) => (
        <DemoClip key={id} kind={id} />
      ))}
    </div>
  )
}
