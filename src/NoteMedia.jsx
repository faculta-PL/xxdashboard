import { safeHttpUrl, splitContentMedia } from './lib/noteMedia'
import { isImageExt, isPdfExt } from './lib/files'
import { parseSimpleBlocks, plainPreview, splitInline } from './lib/simpleMarkdown'

function InlineBits({ text }) {
  return splitInline(text).map((part, i) => {
    if (part.type === 'strong') {
      return (
        <strong key={i} className="font-semibold text-sage-900">
          {part.text}
        </strong>
      )
    }
    if (part.type === 'em') {
      return (
        <em key={i} className="italic">
          {part.text}
        </em>
      )
    }
    if (part.type === 'code') {
      return (
        <code key={i} className="rounded bg-sage-100 px-1 py-0.5 font-mono text-[0.85em] text-sage-800">
          {part.text}
        </code>
      )
    }
    return <span key={i}>{part.text}</span>
  })
}

function RichLine({ text }) {
  const parts = splitContentMedia(text)
  if (!parts.length) return <InlineBits text={text} />
  return parts.map((part, i) => {
    if (part.type === 'image') {
      return <img key={i} src={part.url} alt="" className="my-2 max-h-64 w-full rounded-xl bg-white object-contain" />
    }
    if (part.type === 'link') {
      return (
        <a key={i} href={part.url} target="_blank" rel="noreferrer noopener" className="break-all text-sage-700 underline">
          {part.url}
        </a>
      )
    }
    return <InlineBits key={i} text={part.text} />
  })
}

function BlockView({ block }) {
  if (block.type === 'h1') {
    return <h4 className="font-display text-xl text-sage-900">{block.text}</h4>
  }
  if (block.type === 'h2') {
    return <h5 className="font-display text-lg text-sage-900">{block.text}</h5>
  }
  if (block.type === 'h3') {
    return <h6 className="text-sm font-semibold uppercase tracking-wide text-sage-600">{block.text}</h6>
  }
  if (block.type === 'hr') {
    return <hr className="border-sage-200" />
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="border-l-2 border-sage-300 pl-3 text-sage-700">
        <span className="whitespace-pre-wrap">
          <RichLine text={block.text} />
        </span>
      </blockquote>
    )
  }
  if (block.type === 'ul' || block.type === 'ol') {
    const Tag = block.type === 'ol' ? 'ol' : 'ul'
    return (
      <Tag className={`space-y-1 pl-5 text-sage-800 ${block.type === 'ol' ? 'list-decimal' : 'list-disc'}`}>
        {block.items.map((item, i) => (
          <li key={i} className="whitespace-pre-wrap">
            <RichLine text={item} />
          </li>
        ))}
      </Tag>
    )
  }
  if (block.type === 'calc') {
    return (
      <pre className="overflow-x-auto rounded-xl bg-sage-100/80 px-3 py-2 font-mono text-[13px] leading-relaxed tabular-nums text-sage-900 whitespace-pre-wrap">
        {block.text}
      </pre>
    )
  }
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      <RichLine text={block.text} />
    </p>
  )
}

export function DocumentBody({ content, imageUrl, className = '', compact = false }) {
  const extra = safeHttpUrl(imageUrl)
  const blocks = parseSimpleBlocks(content)
  if (!extra && blocks.length === 0) {
    return <p className={`whitespace-pre-wrap break-words text-sm text-sage-800 ${className}`}>{content || '—'}</p>
  }
  return (
    <div className={`${compact ? 'space-y-1.5' : 'space-y-3'} text-sm text-sage-800 ${className}`}>
      {extra ? <img src={extra} alt="" className="max-h-64 w-full rounded-xl bg-white object-contain" /> : null}
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  )
}

/** @deprecated prefer DocumentBody — kept as alias for existing call sites */
export function NoteRichContent({ content, imageUrl, className = '' }) {
  return <DocumentBody content={content} imageUrl={imageUrl} className={className} />
}

export function NoteCardExcerpt({ content, className = '' }) {
  const preview = plainPreview(content)
  if (!preview) return null
  return (
    <p className={`line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-sage-700 ${className}`}>
      {preview}
    </p>
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
