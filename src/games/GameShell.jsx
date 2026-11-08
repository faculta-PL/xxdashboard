import { Pause, Play, RotateCcw } from 'lucide-react'
import { btnGhost, btnPrimary } from '../components/ui'
import { useI18n } from '../i18n'

export const RULE_KEYS = {
  'kingx-cueillette': ['gamesUi.kingx1', 'gamesUi.kingx2', 'gamesUi.kingx3'],
  'zianotix-vol': ['gamesUi.zian1', 'gamesUi.zian2', 'gamesUi.zian3'],
  'relais-duo': ['gamesUi.relais1', 'gamesUi.relais2', 'gamesUi.relais3'],
}

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
  const { t } = useI18n()
  const rules = (RULE_KEYS[meta.id] || []).map((key) => t(key))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-sage-900">{meta.title}</h2>
          <p className="text-xs text-sage-600">{meta.character}</p>
        </div>
        <p className="rounded-full bg-sage-800 px-3 py-1 text-sm font-semibold text-cream-green" aria-live="polite">
          {t('gamesUi.score', { n: score })}
        </p>
        {extra}
        {running && (
          <button
            type="button"
            className={btnGhost}
            onClick={paused ? onResume : onPause}
            aria-label={paused ? t('gamesUi.resume') : t('gamesUi.pause')}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? t('gamesUi.resume') : t('gamesUi.pause')}
          </button>
        )}
      </div>

      <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-sm text-sage-700">
        {rules.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-sage-300 bg-sage-900">
        {children}
        {!running && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sage-900/70 p-4 text-center">
            <p className="font-display text-2xl text-cream-green">{t('gamesUi.ready')}</p>
            <button type="button" className={btnPrimary} onClick={onStart} aria-label={`${t('gamesUi.start')} ${meta.title}`}>
              <Play size={16} /> {t('gamesUi.start')}
            </button>
          </div>
        )}
        {paused && running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-sage-900/60 p-4 text-center">
            <p className="font-display text-2xl text-cream-green">{t('gamesUi.pause')}</p>
            <button type="button" className={`${btnPrimary} mt-3`} onClick={onResume} aria-label={t('gamesUi.resume')}>
              <Play size={16} /> {t('gamesUi.resume')}
            </button>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sage-900/80 p-4 text-center">
            <p className="font-display text-3xl text-cream-green">{t('gamesUi.over')}</p>
            <p className="text-sage-100">{t('gamesUi.score', { n: score })}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={onSave}
                disabled={saveBusy || saved}
                aria-label={t('gamesUi.saveScore')}
              >
                {saved ? t('gamesUi.scoreDone') : saveBusy ? t('gamesUi.saving') : t('gamesUi.saveScore')}
              </button>
              <button type="button" className={btnGhost + ' !bg-sage-100'} onClick={onRestart} aria-label={t('gamesUi.replay')}>
                <RotateCcw size={16} /> {t('gamesUi.replay')}
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
