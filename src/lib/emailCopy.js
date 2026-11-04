/** Textes e-mail Nazix (FR) — ce que Firebase Auth enverrait si les modèles console sont alignés. */

export const VERIFY_EMAIL = {
  subject: 'Confirmez votre adresse e-mail — Nazix',
  fromHint: 'noreply@… (Firebase Authentication)',
  summary: (email) =>
    `Un e-mail de confirmation a été envoyé à ${email}. Cliquez le lien, ou saisissez le code à 6 chiffres.`,
  body: (email, code) =>
    [
      'Bonjour,',
      '',
      `Bienvenue sur Nazix. Pour activer le compte ${email} :`,
      '',
      '1. Cliquez le lien « Vérifier l’adresse e-mail » dans ce message.',
      `2. Ou, dans Nazix → Paramètres, saisissez le code à 6 chiffres : ${code || '______'}`,
      '',
      'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.',
      '',
      '— L’équipe Nazix',
    ].join('\n'),
}

export const RESET_EMAIL = {
  subject: 'Réinitialisation de votre mot de passe — Nazix',
  fromHint: 'noreply@… (Firebase Authentication)',
  expires: '1 heure',
  steps: [
    'Ouvrez votre boîte de réception, puis le dossier spam / courrier indésirable.',
    'Le lien Firebase et le code local expirent après 1 heure.',
    'Cliquez le lien, ou collez le code dans l’écran « Nouveau mot de passe ».',
  ],
  summary: (email) =>
    `Un e-mail de réinitialisation a été envoyé à ${email}. Vérifiez aussi les indésirables. Le lien expire dans 1 heure.`,
  body: (email, code) =>
    [
      'Bonjour,',
      '',
      `Une demande de réinitialisation a été faite pour ${email}.`,
      '',
      '1. Cliquez le lien « Réinitialiser le mot de passe » (valable 1 heure).',
      `2. Ou collez ce code dans Nazix : ${code || '—'}`,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre mot de passe reste inchangé.',
      '',
      '— L’équipe Nazix',
    ].join('\n'),
}

export function firebaseUnavailableLine() {
  return 'E-mail Firebase indisponible, utilisez le code ci-dessous.'
}

export function verifyUserMessage({ email, code, firebaseSent }) {
  const base = VERIFY_EMAIL.summary(email)
  if (firebaseSent) return code ? `${base} Code : ${code}.` : base
  return `${firebaseUnavailableLine()} Code : ${code || '—'} — ${base}`
}

export function resetUserMessage({ email, code, firebaseSent }) {
  const base = RESET_EMAIL.summary(email)
  if (firebaseSent) return code ? `${base} Code local : ${code}.` : base
  if (code) return `${firebaseUnavailableLine()} ${code}`
  return base
}
