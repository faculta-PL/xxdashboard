import { useEffect, useRef } from 'react'
import { drawKingX } from '../games/chars'

const CLIPS = {
  notes: {
    label: 'Notes',
    caption: 'Titre, contenu, catégorie — enregistrer reste visible.',
  },
  kanban: {
    label: 'Kanban',
    caption: 'Une idée glisse d’une colonne à l’autre en quelques secondes.',
  },
  projets: {
    label: 'Projets',
    caption: 'Titre d’abord, puis statut, responsable et progression.',
  },
  chat: {
    label: 'Chat',
    caption: 'Général et groupes privés, messages en direct.',
  },
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

function NotesDemo() {
  return (
    <div className="demo-clip demo-clip-notes">
      <div className="demo-clip-bar">
        <span>Nouvelle note</span>
        <span className="demo-clip-x">×</span>
      </div>
      <div className="demo-clip-body">
        <div className="demo-line demo-line-title" />
        <div className="demo-line demo-line-long" />
        <div className="demo-line demo-line-mid" />
        <div className="demo-chip">Réunion</div>
      </div>
      <div className="demo-clip-foot">
        <span className="demo-btn ghost">Annuler</span>
        <span className="demo-btn solid demo-save">Enregistrer</span>
      </div>
    </div>
  )
}

function KanbanDemo() {
  return (
    <div className="demo-clip demo-clip-kanban">
      <div className="demo-kanban">
        {['Nouvelle', 'En discussion', 'Retenue'].map((col) => (
          <div key={col} className="demo-col">
            <p>{col}</p>
            {col === 'Nouvelle' && <div className="demo-card demo-card-move">Atelier client</div>}
            {col === 'En discussion' && <div className="demo-card">Brief sprint</div>}
            {col === 'Retenue' && <div className="demo-card ghost-card">Prête à lancer</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjetsDemo() {
  return (
    <div className="demo-clip demo-clip-projets">
      <div className="demo-clip-bar">
        <span>Nouveau projet</span>
        <span className="demo-clip-x">×</span>
      </div>
      <div className="demo-clip-body">
        <p className="demo-label">Titre</p>
        <div className="demo-field demo-type">
          <span className="demo-typed">Lancement site</span>
        </div>
        <p className="demo-label">Description</p>
        <div className="demo-field h-8" />
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sage-100">
          <div className="demo-progress h-full rounded-full bg-sage-700" />
        </div>
      </div>
      <div className="demo-clip-foot">
        <span className="demo-btn ghost">Annuler</span>
        <span className="demo-btn solid">Enregistrer</span>
      </div>
      <div className="demo-cameo" aria-hidden>
        <KingXCameo />
      </div>
    </div>
  )
}

function ChatDemo() {
  return (
    <div className="demo-clip demo-clip-chat">
      <div className="demo-clip-bar">
        <span>Général</span>
      </div>
      <div className="demo-chat-thread">
        <div className="demo-bubble in demo-b1">On valide le tableau ce matin ?</div>
        <div className="demo-bubble out demo-b2">Oui — notes déjà partagées.</div>
        <div className="demo-bubble in demo-b3">Parfait, on avance.</div>
      </div>
      <div className="demo-chat-input">Écrire un message…</div>
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
  const meta = CLIPS[kind] || CLIPS.notes
  const View = RENDER[kind] || NotesDemo
  return (
    <figure className={`overflow-hidden rounded-2xl border border-sage-200 bg-white/80 shadow-sm ${className}`}>
      <View />
      <figcaption className="border-t border-sage-100 px-3 py-2">
        <p className="text-sm font-semibold text-sage-900">{meta.label}</p>
        <p className="text-xs text-sage-600">{meta.caption}</p>
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

