import { FIRST_LOGIN_STEPS, GUIDE_INDEX, MODULE_CHROME, MODULE_GUIDES, writeGuideDone } from './guideContent'
import { DemoGrid } from './DemoClips'

export function GuideView({ onGoView, onReplayTour }) {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-500">Mode d’emploi</p>
        <h2 className="mt-1 font-display text-2xl text-sage-900">Guide Nazix</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sage-700">
          Chaque onglet a un rôle. Voici l’essentiel, sans jargon. Les clips ci-dessous durent une dizaine
          de secondes et bouclent — ce sont des démonstrations visuelles, pas des films.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl bg-sage-700 px-4 text-sm font-semibold text-sage-50 hover:bg-sage-800"
            onClick={() => {
              writeGuideDone()
              onReplayTour?.()
            }}
          >
            Revoir la visite
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl border border-sage-300 bg-white/70 px-4 text-sm font-medium text-sage-800 hover:bg-sage-100"
            onClick={() => onGoView?.('dashboard')}
          >
            Tableau de bord
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl text-sage-900">Démos (~10 s)</h3>
        <DemoGrid />
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-xl text-sage-900">Modules</h3>
        {GUIDE_INDEX.map((id) => {
          const mod = MODULE_GUIDES[id]
          if (!mod) return null
          return (
            <article key={id} className="rounded-2xl border border-sage-200 bg-white/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-display text-lg text-sage-900">{mod.title}</h4>
                <button
                  type="button"
                  className="text-sm font-semibold text-sage-700 underline decoration-sage-300 underline-offset-2 hover:text-sage-950"
                  onClick={() => onGoView?.(id)}
                >
                  Ouvrir
                </button>
              </div>
              <p className="mt-1 text-sm text-sage-700">
                {MODULE_CHROME[id]?.emoji ? (
                  <span className="mr-1" aria-hidden="true">
                    {MODULE_CHROME[id].emoji}
                  </span>
                ) : null}
                {mod.lead}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sage-700">
                {mod.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </section>

      <section className="rounded-2xl border border-dashed border-sage-300 bg-sage-50/80 p-5">
        <h3 className="font-display text-lg text-sage-900">Visite guidée</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-sage-700">
          {FIRST_LOGIN_STEPS.map((s) => (
            <li key={s.id}>
              <span className="font-medium text-sage-900">{s.title}.</span> {s.body}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
