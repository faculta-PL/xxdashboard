import assert from 'node:assert/strict'
import { fallbackOrganizationName, isRoleLabel, organizationTitle } from './orgName.js'

assert.equal(isRoleLabel('Administrateur'), true)
assert.equal(isRoleLabel(' administrator '), true)
assert.equal(isRoleLabel('Atelier'), false)

assert.equal(organizationTitle({ name: 'Administrateur', emoji: '🌿' }, 'Administrateur'), '')
assert.equal(organizationTitle({ name: 'Admin' }, 'Membre'), '')
assert.equal(organizationTitle({ name: 'Atelier', emoji: '🌿' }, 'Administrateur'), '🌿 Atelier')
assert.equal(organizationTitle({ name: 'Atelier' }, 'Administrateur'), 'Atelier')
assert.equal(organizationTitle(null, 'Administrateur'), '')

assert.equal(fallbackOrganizationName({ fullName: 'Administrateur', role: 'Administrateur' }), 'Nazix')
assert.equal(fallbackOrganizationName({ fullName: 'Malika Faculta' }), 'Malika')
assert.equal(fallbackOrganizationName({ fullName: '' }), 'Nazix')

console.log('orgName ok')
