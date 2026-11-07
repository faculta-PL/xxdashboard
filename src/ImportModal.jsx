import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Upload, X } from 'lucide-react'
import {
  saveNote,
  saveProject,
  saveBudget,
  saveBudgetLine,
  saveRisk,
  saveLink,
  startFileUpload,
} from './lib/store'
import { BUDGET_CATEGORIES, RISK_IMPACTS, RISK_PROBABILITIES } from './lib/rbac'
import { MAX_FILE_BYTES, maxFileSizeLabel, formatFileSize } from './lib/files'
import {
  IMPORT_DESTINATIONS,
  IMPORT_EXTS,
  MAX_IMPORT_CHARS,
  parseImportFile,
  previewBodyForDestination,
  splitTitleAndBody,
  guessBudgetColumns,
  guessRiskColumns,
  mapBudgetRows,
  mapRiskRows,
} from './lib/importParse'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
    </label>
  )
}

export default function ImportModal({
  open,
  onClose,
  user,
  flash,
  defaultDestination = 'notes',
  defaultProjectId = '',
  defaultFolderId = '',
  projects = [],
  budgets = [],
}) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [destination, setDestination] = useState(defaultDestination)
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [projectMode, setProjectMode] = useState('create')
  const [budgetId, setBudgetId] = useState('')
  const [budgetName, setBudgetName] = useState('')
  const [budgetCols, setBudgetCols] = useState({ name: '', category: '', amount: '', date: '' })
  const [riskCols, setRiskCols] = useState({
    title: '',
    description: '',
    probability: '',
    impact: '',
    dueDate: '',
  })
  const [budgetRows, setBudgetRows] = useState([])
  const [riskRows, setRiskRows] = useState([])

  const reset = () => {
    setStep(1)
    setFile(null)
    setParsed(null)
    setError('')
    setBusy(false)
    setDestination(defaultDestination)
    setProjectId(defaultProjectId)
    setTitle('')
    setBody('')
    setProjectMode('create')
    setBudgetId('')
    setBudgetName('')
    setBudgetCols({ name: '', category: '', amount: '', date: '' })
    setRiskCols({ title: '', description: '', probability: '', impact: '', dueDate: '' })
    setBudgetRows([])
    setRiskRows([])
  }

  useEffect(() => {
    if (open) {
      setDestination(defaultDestination || 'notes')
      setProjectId(defaultProjectId || '')
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDestination, defaultProjectId])

  const headers = parsed?.headers || []
  const needsProject = destination === 'budget' || destination === 'risks'
  const showsBody =
    destination === 'notes' ||
    destination === 'note_raw' ||
    destination === 'projects' ||
    destination === 'files'
  const extractedText = parsed?.fullText || parsed?.text || ''
  const projectBudgets = useMemo(
    () => budgets.filter((b) => !projectId || b.projectId === projectId),
    [budgets, projectId],
  )

  const pickFile = async (native) => {
    setError('')
    setFile(null)
    setParsed(null)
    if (!native) return
    try {
      const next = await parseImportFile(native)
      setFile(native)
      setParsed(next)
      setTitle(next.title || '')
      setBody(previewBodyForDestination(next, destination))
      if (next.kind === 'table') {
        const bCols = guessBudgetColumns(next.headers)
        const rCols = guessRiskColumns(next.headers)
        setBudgetCols(bCols)
        setRiskCols(rCols)
        setBudgetRows(mapBudgetRows(next.rows, bCols))
        setRiskRows(mapRiskRows(next.rows, rCols))
      } else {
        setBudgetRows([])
        setRiskRows([])
      }
      setStep(2)
    } catch (err) {
      const msg = String(err?.message || 'Fichier illisible.').split('\n')[0].slice(0, 180)
      setError(msg)
      flash(msg, 'err')
    }
  }

  const remapBudget = (cols) => {
    setBudgetCols(cols)
    if (parsed?.rows) setBudgetRows(mapBudgetRows(parsed.rows, cols))
  }
  const remapRisk = (cols) => {
    setRiskCols(cols)
    if (parsed?.rows) setRiskRows(mapRiskRows(parsed.rows, cols))
  }

  const keepOriginalFile = async (extra = {}) => {
    const job = startFileUpload(
      {
        file,
        folderId: defaultFolderId || null,
        projectId: extra.projectId || projectId || null,
        description: extra.description || 'Fichier importé (privé)',
        shares: [],
        teamWide: false,
      },
      user,
    )
    return job.done
  }

  const confirm = async () => {
    if (!file || !parsed) {
      setError('Choisissez un fichier.')
      return
    }
    if (needsProject && !projectId) {
      setError('Choisissez un projet.')
      return
    }
    if (destination === 'projects' && projectMode === 'update' && !projectId) {
      setError('Choisissez le projet à mettre à jour.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const visibility = 'Privée'
      const name = title.trim() || parsed.title
      const content = (body.trim() || extractedText).slice(0, MAX_IMPORT_CHARS)
      if (showsBody && !content && extractedText) {
        throw new Error('Le contenu extrait n’a pas pu être recopié.')
      }

      if (destination === 'files') {
        await keepOriginalFile({
          projectId,
          description: content || name,
        })
        flash('Fichier importé (visibilité privée).')
      } else if (destination === 'notes' || destination === 'note_raw') {
        const note = await saveNote(
          {
            title: name,
            content,
            category: 'Général',
            tags: [],
            visibility,
            shares: [],
            projectId: projectId || null,
            parentId: null,
          },
          user,
        )
        try {
          const stored = await keepOriginalFile({
            projectId,
            description: `Original de la note « ${note.title} »`,
          })
          await saveLink(
            { fromType: 'note', fromId: note.id, toType: 'file', toId: stored.id },
            user,
          )
        } catch (err) {
          console.warn('Fichier original non lié:', err.message)
        }
        flash(
          destination === 'note_raw'
            ? 'Note brute créée (privée) avec le texte intégral.'
            : 'Note créée (privée) et fichier original conservé.',
        )
      } else if (destination === 'projects') {
        if (projectMode === 'update' && projectId) {
          const existing = projects.find((p) => p.id === projectId)
          await saveProject(
            {
              ...existing,
              id: projectId,
              description: content || existing?.description || '',
              title: existing?.title || name,
            },
            user,
          )
          flash('Description du projet mise à jour (sans partage automatique).')
        } else {
          await saveProject(
            {
              title: name,
              description: content,
              status: 'À préparer',
              progress: 0,
              leadId: user.id,
              memberIds: [],
              startDate: new Date().toISOString().slice(0, 10),
              dueDate: '',
              visibility,
              shares: [],
            },
            user,
          )
          flash('Projet créé (visibilité privée).')
        }
      } else if (destination === 'budget') {
        const included = budgetRows.filter((r) => r.included)
        if (!included.length) throw new Error('Cochez au moins une ligne budgétaire.')
        let budget = budgetId ? budgets.find((b) => b.id === budgetId) : null
        if (!budget) {
          budget = await saveBudget(
            {
              name: budgetName.trim() || name,
              projectId,
              currency: 'EUR',
              plannedTotal: included.reduce((s, r) => s + Number(r.amount || 0), 0),
              visibility,
              shares: [],
            },
            user,
          )
        }
        for (const row of included) {
          await saveBudgetLine(
            {
              budgetId: budget.id,
              kind: 'planned',
              category: BUDGET_CATEGORIES.includes(row.category) ? row.category : 'Autres',
              name: row.name,
              amount: Number(row.amount) || 0,
              date: row.date || '',
            },
            user,
          )
        }
        flash(`${included.length} ligne(s) prévisionnelle(s) importée(s) (privé).`)
      } else if (destination === 'risks') {
        const included = riskRows.filter((r) => r.included)
        if (!included.length) throw new Error('Cochez au moins un risque.')
        for (const row of included) {
          await saveRisk(
            {
              title: row.title,
              description: row.description,
              projectId,
              category: 'autre',
              probability: RISK_PROBABILITIES.includes(row.probability) ? row.probability : 'faible',
              impact: RISK_IMPACTS.includes(row.impact) ? row.impact : 'faible',
              dueDate: row.dueDate || '',
              visibility,
              shares: [],
            },
            user,
          )
        }
        flash(`${included.length} risque(s) créé(s) (visibilité privée).`)
      }
      onClose()
    } catch (err) {
      const raw = String(err?.message || 'Import impossible.')
      const msg = /permission[- ]denied/i.test(raw) ? 'Permission refusée.' : raw.split('\n')[0].slice(0, 180)
      setError(msg)
      flash(msg, 'err')
    } finally {
      setBusy(false)
    }
  }

  const bodyRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl animate-fade-up sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-3 border-b border-sage-200 bg-sage-50 px-4 py-3 sm:px-5">
          <div>
            <h3 className="font-display text-xl text-sage-900">Importer</h3>
            <p className="text-xs text-sage-500">
              Max {maxFileSizeLabel()} · {IMPORT_EXTS.join(', ')} · visibilité privée jusqu’à confirmation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-sage-600 hover:bg-sage-200"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 xx-scroll sm:px-5">
          {step === 1 && (
            <div className="space-y-3">
              <Field label={`Fichier (${IMPORT_EXTS.join(', ')}, max ${maxFileSizeLabel()})`}>
                <input
                  type="file"
                  className={inputClass}
                  accept={IMPORT_EXTS.map((e) => `.${e}`).join(',')}
                  onChange={(e) => pickFile(e.target.files?.[0] || null)}
                />
              </Field>
              <p className="text-xs text-sage-500">
                Taille max {Math.round(MAX_FILE_BYTES / (1024 * 1024))} Mo (constante MAX_FILE_BYTES). Aucun partage
                automatique.
              </p>
            </div>
          )}

          {step === 2 && parsed && (
            <div className="space-y-3">
              <div className="rounded-xl border border-sage-200 bg-white p-3 text-sm text-sage-700">
                <p className="font-medium text-sage-900">{parsed.name}</p>
                <p className="text-xs text-sage-500">
                  {parsed.ext?.toUpperCase()} · {formatFileSize(parsed.size)} ·{' '}
                  {parsed.extractable ? 'texte extrait' : 'fichier conservé tel quel'}
                </p>
              </div>
              {parsed.kind === 'table' && (
                <div className="max-h-40 overflow-auto rounded-xl border border-sage-200 bg-white xx-scroll">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-sage-100 text-sage-700">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(parsed.rows || []).slice(0, 8).map((row, i) => (
                        <tr key={i} className="border-t border-sage-100">
                          {headers.map((h) => (
                            <td key={h} className="px-2 py-1 text-sage-700">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Field label="Destination">
                <select
                  className={inputClass}
                  value={destination}
                  onChange={(e) => {
                    const nextDest = e.target.value
                    setDestination(nextDest)
                    if (parsed) setBody(previewBodyForDestination(parsed, nextDest))
                  }}
                >
                  {IMPORT_DESTINATIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              {destination === 'note_raw' && (
                <p className="text-xs text-sage-600">
                  Tout le fichier est collé dans le contenu de la note, sans découpage titre / corps.
                </p>
              )}
              <Field label="Titre">
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              {showsBody && (
                <Field
                  label={
                    destination === 'note_raw'
                      ? 'Contenu (texte brut — fichier entier)'
                      : destination === 'projects'
                        ? 'Description'
                        : destination === 'files'
                          ? 'Description du fichier'
                          : 'Description / contenu'
                  }
                >
                  <textarea
                    className={inputClass + ' min-h-40 font-mono text-xs sm:text-sm'}
                    value={body}
                    onChange={(e) => {
                      const next = e.target.value
                      setBody(next)
                      if (!parsed?.extractable && destination !== 'note_raw') {
                        const split = splitTitleAndBody(next, parsed?.name)
                        if (!title || title === parsed?.title) setTitle(split.title)
                      }
                    }}
                    placeholder={
                      parsed.extractable
                        ? 'Texte extrait — modifiable avant confirmation'
                        : parsed.pasteHint || 'Collez ici le texte du fichier'
                    }
                  />
                  <span className="mt-1 block text-[11px] text-sage-500">
                    {body.length.toLocaleString('fr-FR')} caractère
                    {body.length > 1 ? 's' : ''}
                    {extractedText && !body.trim() ? ' · le texte extrait sera utilisé si le champ reste vide' : ''}
                    {body.length >= MAX_IMPORT_CHARS ? ` · limité à ${MAX_IMPORT_CHARS.toLocaleString('fr-FR')} caractères` : ''}
                  </span>
                </Field>
              )}
              {(destination === 'notes' ||
                destination === 'note_raw' ||
                destination === 'files' ||
                destination === 'budget' ||
                destination === 'risks' ||
                (destination === 'projects' && projectMode === 'update')) && (
                <Field
                  label={
                    destination === 'projects'
                      ? 'Projet à mettre à jour'
                      : destination === 'budget' || destination === 'risks'
                        ? 'Projet (requis)'
                        : 'Projet (optionnel)'
                  }
                >
                  <select
                    className={inputClass}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    <option value="">{destination === 'budget' || destination === 'risks' ? 'Choisir…' : 'Aucun'}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {destination === 'projects' && (
                <Field label="Action projet">
                  <select
                    className={inputClass}
                    value={projectMode}
                    onChange={(e) => setProjectMode(e.target.value)}
                  >
                    <option value="create">Créer un projet</option>
                    <option value="update">Mettre à jour la description d’un projet</option>
                  </select>
                </Field>
              )}
              {destination === 'budget' && (
                <>
                  <Field label="Budget cible">
                    <select
                      className={inputClass}
                      value={budgetId}
                      onChange={(e) => setBudgetId(e.target.value)}
                    >
                      <option value="">Nouveau budget</option>
                      {projectBudgets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!budgetId && (
                    <Field label="Nom du nouveau budget">
                      <input
                        className={inputClass}
                        value={budgetName}
                        onChange={(e) => setBudgetName(e.target.value)}
                        placeholder={title}
                      />
                    </Field>
                  )}
                  {parsed.kind === 'table' && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {[
                        ['name', 'Colonne libellé'],
                        ['category', 'Colonne catégorie'],
                        ['amount', 'Colonne montant'],
                        ['date', 'Colonne date'],
                      ].map(([key, label]) => (
                        <Field key={key} label={label}>
                          <select
                            className={inputClass}
                            value={budgetCols[key]}
                            onChange={(e) => remapBudget({ ...budgetCols, [key]: e.target.value })}
                          >
                            <option value="">—</option>
                            {headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  )}
                  <div className="overflow-auto rounded-xl border border-sage-200 bg-white xx-scroll">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-sage-100">
                        <tr>
                          <th className="px-2 py-1">OK</th>
                          <th className="px-2 py-1">Libellé</th>
                          <th className="px-2 py-1">Catégorie</th>
                          <th className="px-2 py-1">Montant</th>
                          <th className="px-2 py-1">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetRows.map((row, i) => (
                          <tr key={row.key} className="border-t border-sage-100">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={row.included}
                                onChange={(e) =>
                                  setBudgetRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, included: e.target.checked } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.name}
                                onChange={(e) =>
                                  setBudgetRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.category}
                                onChange={(e) =>
                                  setBudgetRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, category: e.target.value } : r)),
                                  )
                                }
                              >
                                {BUDGET_CATEGORIES.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.amount}
                                onChange={(e) =>
                                  setBudgetRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.date}
                                onChange={(e) =>
                                  setBudgetRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {budgetRows.length === 0 && (
                      <p className="p-3 text-sage-500">Aucune ligne tabulaire. Importez un CSV / XLSX.</p>
                    )}
                  </div>
                </>
              )}
              {destination === 'risks' && (
                <>
                  {parsed.kind === 'table' && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {[
                        ['title', 'Colonne titre'],
                        ['description', 'Colonne description'],
                        ['probability', 'Colonne probabilité'],
                        ['impact', 'Colonne impact'],
                        ['dueDate', 'Colonne échéance'],
                      ].map(([key, label]) => (
                        <Field key={key} label={label}>
                          <select
                            className={inputClass}
                            value={riskCols[key]}
                            onChange={(e) => remapRisk({ ...riskCols, [key]: e.target.value })}
                          >
                            <option value="">—</option>
                            {headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </Field>
                      ))}
                    </div>
                  )}
                  <div className="overflow-auto rounded-xl border border-sage-200 bg-white xx-scroll">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-sage-100">
                        <tr>
                          <th className="px-2 py-1">OK</th>
                          <th className="px-2 py-1">Titre</th>
                          <th className="px-2 py-1">Proba.</th>
                          <th className="px-2 py-1">Impact</th>
                          <th className="px-2 py-1">Échéance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskRows.map((row, i) => (
                          <tr key={row.key} className="border-t border-sage-100">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={row.included}
                                onChange={(e) =>
                                  setRiskRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, included: e.target.checked } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.title}
                                onChange={(e) =>
                                  setRiskRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.probability}
                                onChange={(e) =>
                                  setRiskRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, probability: e.target.value } : r)),
                                  )
                                }
                              >
                                {RISK_PROBABILITIES.map((p) => (
                                  <option key={p}>{p}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <select
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.impact}
                                onChange={(e) =>
                                  setRiskRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, impact: e.target.value } : r)),
                                  )
                                }
                              >
                                {RISK_IMPACTS.map((p) => (
                                  <option key={p}>{p}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="date"
                                className={inputClass + ' !min-h-8 py-1'}
                                value={row.dueDate}
                                onChange={(e) =>
                                  setRiskRows((list) =>
                                    list.map((r, j) => (j === i ? { ...r, dueDate: e.target.value } : r)),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {riskRows.length === 0 && (
                      <p className="p-3 text-sage-500">Aucune ligne. Importez un CSV / XLSX de risques.</p>
                    )}
                  </div>
                </>
              )}
              <p className="text-xs text-sage-500">Visibilité : Privée. Aucun partage n’est appliqué à l’import.</p>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
        <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:flex-row sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step === 2 && (
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setStep(1)}>
              Retour
            </button>
          )}
          <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={onClose}>
            Annuler
          </button>
          {step === 2 && (
            <button type="button" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy} onClick={confirm}>
              <Check size={16} /> {busy ? 'Import…' : 'Confirmer l’import'}
            </button>
          )}
          {step === 1 && (
            <span className="inline-flex items-center gap-2 text-xs text-sage-500">
              <Upload size={14} /> Validez un fichier pour prévisualiser
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
