import { Pause, Play, RotateCcw } from 'lucide-react'
import { btnGhost, btnPrimary } from '../components/ui'

export const GAME_META = {
  'kingx-cueillette': {
    id: 'kingx-cueillette',
    title: 'KingX Cueillette',
    character: 'KingX',
    rules: [
      'KingX ramasse les orbes sauge pendant 45 secondes.',
      'Flèches, WASD ou glisser du doigt pour se déplacer.',
      'Évitez les rochers sombres — 3 chocs et c’est terminé. Score = orbes × 10.',
    ],
  },
  'zianotix-vol': {
    id: 'zianotix-vol',
    title: 'Zianotix Vol',
    character: 'Zianotix',
    rules: [
      'Zianotix plane entre les branches.',
      'Espace, Entrée ou toucher pour battre des ailes.',
      'Évitez les branches. Score = distance parcourue.',
    ],
  },
  'relais-duo': {
    id: 'relais-duo',
    title: 'Relais Duo',
    character: 'KingX & Zianotix',
    rules: [
      'Course sans fin : KingX au sol, Zianotix en vol.',
      'Toucher ou Espace pour changer de relayeur.',
      'Collectez les pièces, évitez les obstacles. Score = pièces + distance.',
    ],
  },
}

export function GameChrome({
  meta,
  score,
  extra,
  paused,
  running,
  over,
  onStart,
  onPause,
  onResume,
  onRestart,
  onSave,
  saveBusy,
  saved,
  children,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-sage-900">{meta.title}</h2>
          <p className="text-xs text-sage-600">{meta.character}</p>
        </div>
        <p className="rounded-full bg-sage-800 px-3 py-1 text-sm font-semibold text-cream-green" aria-live="polite">
          Score {score}
        </p>
        {extra}
        {running && (
          <button
            type="button"
            className={btnGhost}
            onClick={paused ? onResume : onPause}
            aria-label={paused ? 'Reprendre la partie' : 'Mettre en pause'}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? 'Reprendre' : 'Pause'}
          </button>
        )}
      </div>

      <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-sm text-sage-700">
        {meta.rules.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-sage-300 bg-sage-900">
        {children}
        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sage-900/70 p-4 text-center">
            <p className="font-display text-2xl text-cream-green">Prêt ?</p>
            <button type="button" className={btnPrimary} onClick={onStart} aria-label={`Démarrer ${meta.title}`}>
              <Play size={16} /> Démarrer
            </button>
          </div>
        )}
        {paused && running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-sage-900/60 p-4 text-center">
            <p className="font-display text-2xl text-cream-green">Pause</p>
            <button type="button" className={`${btnPrimary} mt-3`} onClick={onResume} aria-label="Reprendre">
              <Play size={16} /> Reprendre
            </button>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sage-900/80 p-4 text-center">
            <p className="font-display text-3xl text-cream-green">Partie terminée</p>
            <p className="text-sage-100">Score {score}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={onSave}
                disabled={saveBusy || saved}
                aria-label="Enregistrer le score"
              >
                {saved ? 'Score enregistré' : saveBusy ? 'Enregistrement…' : 'Enregistrer le score'}
              </button>
              <button type="button" className={btnGhost + ' !bg-sage-100'} onClick={onRestart} aria-label="Rejouer">
                <RotateCcw size={16} /> Rejouer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function useCanvasSize(ref, { height = 420 } = {}) {
  const fit = () => {
    const canvas = ref.current
    if (!canvas) return { w: 800, h: height }
    const parent = canvas.parentElement
    const w = Math.max(280, parent?.clientWidth || 800)
    const h = height
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { w, h }
  }
  return fit
}
