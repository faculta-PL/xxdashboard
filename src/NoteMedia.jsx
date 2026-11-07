import { extractMediaUrls, safeHttpUrl, splitContentMedia } from './lib/noteMedia'
import { isImageExt, isPdfExt } from './lib/files'

export function NoteRichContent({ content, imageUrl, className = '' }) {
  const extra = safeHttpUrl(imageUrl)
  const parts = splitContentMedia(content)
  if (!extra && parts.length === 0) {
    return <p className={`whitespace-pre-wrap text-sm text-sage-800 ${className}`}>{content || '—'}</p>
  }
  return (
    <div className={`space-y-2 text-sm text-sage-800 ${className}`}>
      {extra ? <img src={extra} alt="" className="max-h-64 w-full rounded-xl bg-white object-contain" /> : null}
      {parts.map((part, i) => {
        if (part.type === 'image') {
          return <img key={i} src={part.url} alt="" className="max-h-64 w-full rounded-xl bg-white object-contain" />
        }
        if (part.type === 'link') {
          return (
            <a key={i} href={part.url} target="_blank" rel="noreferrer noopener" className="break-all text-sage-700 underline">
              {part.url}
            </a>
          )
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.text}
          </span>
        )
      })}
    </div>
  )
}

export function NoteLinkedFiles({ files = [], ids = [], onOpen }) {
  const set = new Set(ids)
  const list = files.filter((f) => set.has(f.id))
  if (!list.length) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {list.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            className="inline-flex min-h-8 items-center rounded-lg bg-sage-100 px-2 py-1 text-xs font-medium text-sage-800 hover:bg-sage-200"
            onClick={() => onOpen?.(f)}
          >
            {isImageExt(f.ext) ? '🖼' : isPdfExt(f.ext) ? 'PDF' : '•'} {f.name}
          </button>
        </li>
      ))}
    </ul>
  )
}

