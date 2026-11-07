export function parseFeedbackRewrite(raw) {
  const text = String(raw || '').trim()
  const titleMatch = text.match(/TITRE\s*:\s*(.+)/i)
  const msgMatch = text.match(/MESSAGE\s*:\s*([\s\S]+)/i)
  if (titleMatch && msgMatch) {
    return {
      title: titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200),
      body: msgMatch[1].trim(),
    }
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 2) return { title: lines[0].slice(0, 200), body: lines.slice(1).join('\n') }
  return { title: '', body: text }
}
