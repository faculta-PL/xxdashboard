import { useState } from 'react'
import { Image as ImageIcon, FileText, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useI18n } from './i18n'
import { generateImage, fileFromImageResult } from './lib/assistant'
import { startFileUpload } from './lib/store'
import { canWriteRole } from './lib/rbac'
import { EmptyState } from './components/ui'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

export default function CreateToolsView({ user, flash }) {
  const { t } = useI18n()
  const canWrite = canWriteRole(user)
  const [prompt, setPrompt] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageError, setImageError] = useState('')
  const [preview, setPreview] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [flyerTitle, setFlyerTitle] = useState('')
  const [flyerText, setFlyerText] = useState('')
  const [flyerError, setFlyerError] = useState('')

  const runImage = async (e) => {
    e?.preventDefault?.()
    if (!canWrite) {
      flash?.(t('tools.readerBlocked'), 'err')
      return
    }
    const text = prompt.trim()
    if (!text) {
      setImageError(t('tools.noPrompt'))
      return
    }
    setImageBusy(true)
    setProgress(8)
    setImageError('')
    setPreview(null)
    try {
      const data = await generateImage({
        prompt: text,
        onProgress: (n) => setProgress(n),
      })
      const file = await fileFromImageResult(data, `nazix-${Date.now()}.png`)
      const url = URL.createObjectURL(file)
      setPreview({ url, file, mime: file.type })
      setProgress(100)
    } catch (err) {
      setImageError(err.message || t('tools.error'))
    } finally {
      setImageBusy(false)
    }
  }

  const saveFile = async () => {
    if (!preview?.file || !canWrite) return
    setSaveBusy(true)
    try {
      const task = startFileUpload(
        { file: preview.file, description: prompt.trim().slice(0, 180) },
        user,
        { onProgress: (n) => setProgress(n) },
      )
      await task.done
      flash?.(t('tools.savedFile'))
    } catch (err) {
      flash?.(err.message || t('tools.error'), 'err')
    } finally {
      setSaveBusy(false)
    }
  }

  const downloadFlyer = () => {
    if (!canWrite) {
      flash?.(t('tools.readerBlocked'), 'err')
      return
    }
    const title = flyerTitle.trim()
    const body = flyerText.trim()
    if (!title && !body) {
      setFlyerError(t('tools.noFlyer'))
      return
    }
    setFlyerError('')
    const doc = new jsPDF()
    doc.setFillColor(232, 237, 228)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(61, 84, 64)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(245, 246, 241)
    doc.setFontSize(14)
    doc.text('Nazix', 14, 18)
    doc.setTextColor(47, 56, 44)
    doc.setFontSize(22)
    const heading = title || 'Nazix'
    doc.text(doc.splitTextToSize(heading, 180), 14, 48)
    doc.setFontSize(12)
    if (body) doc.text(doc.splitTextToSize(body, 180), 14, 68)
    doc.save(`${(title || 'flyer-nazix').replace(/[^\w.-]+/g, '_').slice(0, 60)}.pdf`)
  }

  if (!canWrite) {
    return (
      <div className="space-y-4 animate-fade-up">
        <EmptyState title={t('tools.title')} hint={t('tools.readerBlocked')} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('tools.kicker')}</p>
        <h2 className="font-display text-2xl text-sage-900">{t('tools.title')}</h2>
      </div>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <ImageIcon size={18} /> {t('tools.imageTitle')}
        </h3>
        <p className="mt-1 text-sm text-sage-600">{t('tools.imageHint')}</p>
        <form className="mt-4 space-y-3" onSubmit={runImage}>
          <textarea
            className={inputClass + ' min-h-24'}
            placeholder={t('tools.imagePrompt')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btnPrimary} disabled={imageBusy || !prompt.trim()}>
              {imageBusy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
              {imageBusy ? t('tools.generating') : t('tools.generate')}
            </button>
            {imageBusy && <span className="text-xs text-sage-600">{t('tools.progress', { n: progress })}</span>}
          </div>
        </form>
        {!prompt && !preview && !imageBusy && !imageError && (
          <p className="mt-3 text-sm text-sage-500">{t('tools.empty')}</p>
        )}
        {imageBusy && <p className="mt-3 text-sm text-sage-600">{t('tools.loading')}</p>}
        {imageError && (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {imageError}
          </p>
        )}
        {preview?.url && (
          <div className="mt-4 space-y-3">
            <img src={preview.url} alt="" className="max-h-80 w-full rounded-xl bg-white object-contain" />
            <button type="button" className={btnGhost} onClick={saveFile} disabled={saveBusy}>
              {t('tools.saveToFiles')}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h3 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <FileText size={18} /> {t('tools.flyerTitle')}
        </h3>
        <p className="mt-1 text-sm text-sage-600">{t('tools.flyerHint')}</p>
        <div className="mt-4 space-y-3">
          <input
            className={inputClass}
            placeholder={t('tools.flyerTitleField')}
            value={flyerTitle}
            onChange={(e) => setFlyerTitle(e.target.value)}
          />
          <textarea
            className={inputClass + ' min-h-28'}
            placeholder={t('tools.flyerText')}
            value={flyerText}
            onChange={(e) => setFlyerText(e.target.value)}
          />
          {flyerError && (
            <p className="text-sm font-medium text-danger" role="alert">
              {flyerError}
            </p>
          )}
          <button type="button" className={btnPrimary} onClick={downloadFlyer}>
            <FileText size={16} /> {t('tools.flyerDownload')}
          </button>
        </div>
      </section>
    </div>
  )
}
