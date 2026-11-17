/** Role words are account labels. They are never an organization name. */

const ROLE_LABELS = new Set([
  'administrateur',
  'administrator',
  'admin',
  'responsable de projet',
  'project lead',
  'membre',
  'member',
  'lecteur',
  'reader',
  'propriétaire',
  'proprietaire',
  'owner',
  'invité',
  'invite',
  'guest',
])

export function isRoleLabel(value) {
  const text = String(value || '').trim().toLowerCase()
  return Boolean(text) && ROLE_LABELS.has(text)
}

/** Visible organization name, or '' when the stored name is missing or is only a role. */
export function organizationTitle(org, role) {
  const name = String(org?.name || '').trim()
  if (!name || isRoleLabel(name)) return ''
  if (role && name.toLowerCase() === String(role).trim().toLowerCase()) return ''
  const mark = String(org?.emoji || org?.logo || '').trim()
  return mark ? `${mark} ${name}` : name
}

/** Name used when an organization is created automatically. Never a role word. */
export function fallbackOrganizationName(user) {
  const first = String(user?.fullName || '').trim().split(/\s+/)[0] || ''
  if (!first || isRoleLabel(first)) return 'Nazix'
  if (user?.role && first.toLowerCase() === String(user.role).trim().toLowerCase()) return 'Nazix'
  return first
}
