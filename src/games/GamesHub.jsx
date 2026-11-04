import { lazy, Suspense, useMemo, useState } from 'react'
import { ArrowLeft, Gamepad2, Trophy } from 'lucide-react'
import { getBackendMode, saveGameProfile, createGameScore } from '../lib/store'
import { btnGhost, btnPrimary, EmptyState, inputClass, MemberAvatar } from '../components/ui'
import { GAME_META } from './GameShell'
import { KINGX, ZIANOTIX } from './chars'

const KingXCueillette = lazy(() => import('./KingXCueillette.jsx'))
const ZianotixVol = lazy(() => import('./ZianotixVol.jsx'))
const RelaisDuo = lazy(() => import('./RelaisDuo.jsx'))

const GAMES = [GAME_META['kingx-cueillette'], GAME_META['zianotix-vol'], GAME_META['relais-duo']]

export default function GamesHub({ user, profiles = [], scores = [], flash, onBack }) {
  const [gameId, setGameId] = useState(null)
  const [tab, setTab] = useState('global')
  const [name, setName] = useState(() => profiles.find((p) => p.userId === user.id)?.displayName || '')
  const [busy, setBusy] = useState(false)
  const mine = profiles.find((p) => p.userId === user.id)
  const localBoard = getBackendMode() === 'local'
  const displayName = mine?.displayName || name

  const saveProfile = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await saveGameProfile(name, user)
      setName(saved.displayName)
      flash('Pseudo de jeu enregistré.')
    } catch (err) {
      flash(err.message || 'Pseudo refusé', 'err')
    } finally {
      setBusy(false)
    }
  }

  const onSaveScore = async (id, score) => {
    if (!mine?.displayName) {
      flash('Choisissez un pseudo de jeu avant d’enregistrer un score.', 'err')
      throw new Error('Pseudo requis')
    }
    await createGameScore({ gameId: id, score, displayName: mine.displayName }, user)
    flash('Score enregistré.')
  }

  const sorted = useMemo(
    () => [...scores].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(b.at).localeCompare(String(a.at))),
    [scores],
  )
  const recent = useMemo(
    () => [...scores].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 8),
    [scores],
  )
  const personalBest = useMemo(() => {
    const mineScores = scores.filter((s) => s.userId === user.id)
    const byGame = {}
    for (const row of mineScores) {
      if (!byGame[row.gameId] || row.score > byGame[row.gameId].score) byGame[row.gameId] = row
    }
    return Object.values(byGame)
  }, [scores, user.id])

  const listForTab = () => {
    if (tab === 'recent') return recent
    if (tab === 'best') return personalBest.sort((a, b) => b.score - a.score)
    if (tab.startsWith('game:')) return sorted.filter((s) => s.gameId === tab.slice(5)).slice(0, 10)
    return sorted.slice(0, 10)
  }

  const shown = listForTab()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream-green text-ink">
      <header className="border-b border-sage-200 bg-gradient-to-r from-sage-100 via-cream-green to-sage-200 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button type="button" className={btnGhost} onClick={onBack} aria-label="Retour au travail">
            <ArrowLeft size={16} /> Retour au travail
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sage-600">Arcade Nazix</p>
            <h1 className="font-display text-3xl text-sage-900">Jeux</h1>
            <p className="text-sm text-sage-700">KingX et Zianotix — hors espace de travail, sans notes ni chat.</p>
          </div>
          <Gamepad2 className="text-sage-700" size={36} aria-hidden />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <section className="rounded-2xl border border-sage-200 bg-white/80 p-4 animate-fade-up">
          <h2 className="font-display text-lg text-sage-900">Votre pseudo</h2>
          <p className="mt-1 text-xs text-sage-600">
            Unique parmi les joueurs. Les noms {KINGX} et {ZIANOTIX} sont réservés aux personnages.
          </p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={saveProfile}>
            <label className="sr-only" htmlFor="game-display-name">
              Pseudo de jeu
            </label>
            <input
              id="game-display-name"
              className={inputClass}
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom dans l’arcade"
              required
            />
            <button type="submit" className={btnPrimary} disabled={busy}>
              Enregistrer
            </button>
          </form>
          {displayName && (
            <p className="mt-2 flex items-center gap-2 text-sm text-sage-700">
              <MemberAvatar name={displayName} />
              Connecté en tant que {displayName}
            </p>
          )}
        </section>

        {!gameId ? (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              {GAMES.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGameId(g.id)}
                  className="rounded-2xl border border-sage-200 bg-white p-4 text-left shadow-sm transition hover:border-sage-400 hover:shadow animate-fade-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                  aria-label={`Ouvrir ${g.title}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{g.character}</p>
                  <h3 className="mt-1 font-display text-xl text-sage-900">{g.title}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-sage-700">
                    {g.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <span className={`${btnPrimary} mt-4`}>Jouer</span>
                </button>
              ))}
            </section>

            <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Trophy size={18} className="text-sage-700" />
                <h2 className="font-display text-lg text-sage-900">
                  {localBoard ? 'Classement local' : 'Classement'}
                </h2>
                {localBoard && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
                    pas un classement partagé
                  </span>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {[
                  ['global', 'Global'],
                  ['game:kingx-cueillette', 'Cueillette'],
                  ['game:zianotix-vol', 'Vol'],
                  ['game:relais-duo', 'Relais'],
                  ['best', 'Mes records'],
                  ['recent', 'Récents'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      tab === id ? 'bg-sage-800 text-sage-50' : 'bg-sage-100 text-sage-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <EmptyState title="Aucun score" hint="Jouez une partie puis enregistrez votre score." />
              ) : (
                <ol className="space-y-2">
                  {shown.map((row, i) => (
                    <li
                      key={row.id || `${row.gameId}-${row.userId}-${i}`}
                      className="flex items-center gap-3 rounded-xl bg-sage-50 px-3 py-2 text-sm"
                    >
                      <span className="w-6 font-display text-sage-500">{i + 1}</span>
                      <MemberAvatar name={row.displayName} />
                      <span className="min-w-0 flex-1 truncate font-medium text-sage-900">{row.displayName}</span>
                      <span className="text-xs text-sage-500">{GAME_META[row.gameId]?.title || row.gameId}</span>
                      <span className="font-semibold text-sage-800">{row.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : (
          <section className="flex min-h-[32rem] flex-1 flex-col rounded-2xl border border-sage-200 bg-white/70 p-4">
            <button
              type="button"
              className={`${btnGhost} mb-3 self-start`}
              onClick={() => setGameId(null)}
              aria-label="Retour à l’arcade"
            >
              <ArrowLeft size={16} /> Arcade
            </button>
            <Suspense
              fallback={
                <p className="py-16 text-center text-sm text-sage-600" role="status">
                  Chargement du jeu…
                </p>
              }
            >
              {gameId === 'kingx-cueillette' && <KingXCueillette onSaveScore={onSaveScore} />}
              {gameId === 'zianotix-vol' && <ZianotixVol onSaveScore={onSaveScore} />}
              {gameId === 'relais-duo' && <RelaisDuo onSaveScore={onSaveScore} />}
            </Suspense>
          </section>
        )}
      </main>
    </div>
  )
}
