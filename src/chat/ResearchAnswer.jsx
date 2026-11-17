import { researchView } from '../../server/research-chat.mjs'

function safeHref(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href
  } catch {
    /* keep the title as text */
  }
  return ''
}

function linesOf(body) {
  return String(body || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function ResearchAnswer({ text }) {
  const view = researchView(text)
  if (!view.structured) {
    return <div className="whitespace-pre-wrap leading-snug">{view.plain}</div>
  }
  return (
    <div className="space-y-2.5">
      {view.sections.map((section) => (
        <section key={section.key}>
          <h3 className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-sage-600">
            {view.headings[section.key]}
          </h3>
          {section.key === 'sources' ? (
            <ul className="space-y-1">
              {section.items.map((item, index) => {
                const href = safeHref(item.url)
                const meta = [item.author, item.date].filter(Boolean).join(' · ')
                return (
                  <li key={`${item.title}-${index}`} className="leading-snug">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-sage-800 underline">
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                    {meta ? <span className="text-sage-500"> · {meta}</span> : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            linesOf(section.body).map((line, index) => (
              <p key={`${section.key}-${index}`} className="leading-snug">
                {line}
              </p>
            ))
          )}
        </section>
      ))}
    </div>
  )
}
