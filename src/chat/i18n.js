/** Chat pane copy — FR / EN. */

const dict = {
  fr: {
    send: 'Envoyer',
    placeholder: 'Écrire un message…',
    hint: 'Entrée envoie. Maj+Entrée passe à la ligne.',
    empty: 'Aucun message. Écrivez le premier.',
  },
  en: {
    send: 'Send',
    placeholder: 'Write a message…',
    hint: 'Enter sends. Shift+Enter adds a line.',
    empty: 'No messages yet. Write the first one.',
  },
}

function interpolate(template, vars) {
  if (!vars) return template
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : `{${key}}`))
}

export function chatT(lang, key, vars) {
  const locale = lang === 'en' ? 'en' : 'fr'
  const value = dict[locale]?.[key] ?? dict.fr[key] ?? key
  return interpolate(value, vars)
}

export const chatDict = dict
