/** Organization isolation: membership, migration, feedback seed. */

export const ORG_SCOPED_COLLECTIONS = [
  'xx_notes',
  'xx_ideas',
  'xx_projects',
  'xx_events',
  'xx_todo_lists',
  'xx_todos',
  'xx_notifications',
  'xx_groups',
  'xx_messages',
  'xx_files',
  'xx_folders',
  'xx_budgets',
  'xx_budget_lines',
  'xx_risks',
  'xx_risk_actions',
  'xx_links',
  'xx_canvas_layout',
  'xx_ai_threads',
  'xx_game_scores',
  'xx_feedback',
]

export const ORG_ROLES = ['owner', 'admin', 'member']

export function orgMemberId(orgId, userId) {
  return `${orgId}_${userId}`
}

export function normalizeOrgRole(role) {
  return ORG_ROLES.includes(role) ? role : 'member'
}

const SHIPPED_FEEDBACK = [
  { id: 'fbk_ship_autosave', module: 'notes', title: 'Sauvegarde automatique des textes longs', body: 'Les notes, sous-notes, descriptions de projet, cartes kanban et le détail d’une tâche s’enregistrent après 80 caractères ou 2 secondes.', re: /autosave|sauvegarde auto|enregistrement auto|texte long/i },
  { id: 'fbk_ship_dictation', module: 'notes', title: 'Dictée : annuler, langue, plus rapide', body: 'Annulation du dernier passage, choix Français ou English mémorisé, mots visibles pendant la parole.', re: /dict[ée]e|dictation|micro|reconnaissance vocale/i },
  { id: 'fbk_ship_mini', module: 'autre', title: 'Nazix Mini installable sur Android', body: 'Écran d’accueil : tâches du jour, notes importantes, note rapide, agenda et chat de l’organisation.', re: /android|pwa|mini|écran d’accueil|home screen/i },
  { id: 'fbk_ship_sync', module: 'dashboard', title: 'Synchronisation temps réel par organisation', body: 'Indicateur en direct, hors ligne ou local uniquement.', re: /temps r[ée]el|synchron|realtime/i },
  { id: 'fbk_ship_important', module: 'notes', title: 'Onglet des notes très importantes', body: 'Une étoile épingle la note. L’onglet et le tableau de bord ne montrent que celles-là.', re: /tr[èe]s importante|note importante|étoile/i },
  { id: 'fbk_ship_chat', module: 'chat', title: 'Le chat ne saute plus à l’envoi', body: 'Liste à hauteur fixe, compositeur en bas, défilement seulement dans les messages.', re: /chat.*(saut|bouge)|envoi.*chat/i },
  { id: 'fbk_ship_drafts', module: 'notes', title: 'Les formulaires gardent leur brouillon', body: 'Changer d’onglet restaure le brouillon. Un bouton l’efface.', re: /brouillon|changement d’onglet|formulaire.*onglet/i },
  { id: 'fbk_ship_search', module: 'assistant', title: 'L’assistant cherche vraiment sur le web', body: 'Les questions renvoient des sources, y compris Wikipédia.', re: /recherche web|wikipedia|sources/i },
  { id: 'fbk_ship_actions', module: 'assistant', title: 'L’assistant agit dans l’organisation, y compris le budget', body: 'Boutons pour créer ou mettre à jour tâches, notes, événements, projets et lignes budgétaires.', re: /assistant.*budget|ligne budg[ée]taire/i },
  { id: 'fbk_ship_image', module: 'create', title: 'Génération d’image côté serveur', body: 'L’image passe par le serveur. Une erreur précise s’affiche si le service est indisponible.', re: /g[ée]n[ée]ration d’image|dall-?e|gpt-image/i },
  { id: 'fbk_ship_orgs', module: 'team', title: 'Organisations isolées', body: 'Chaque contenu est rattaché à une organisation.', re: /organisation|isolation/i },
]

function rows(mem, col) {
  return Object.values(mem[col] || {})
}

export function createOrgLayer(ctx) {
  const mem = () => ctx.getMemory()

  function membershipsFor(user) {
    if (!user) return []
    const email = String(user.email || '').trim().toLowerCase()
    return rows(mem(), 'xx_org_members').filter(
      (m) => m.userId === user.id || (email && String(m.email || '').toLowerCase() === email),
    )
  }

  function memberOf(user, orgId) {
    return membershipsFor(user).find((m) => m.orgId === orgId) || null
  }

  function isManager(user, orgId) {
    if (!user || !orgId) return false
    if (ctx.isAdminUser(user)) return true
    const role = memberOf(user, orgId)?.role
    return role === 'owner' || role === 'admin'
  }

  async function migrateUnscoped(user, orgId, { all = false } = {}) {
    if (!user || !orgId) return
    for (const col of ORG_SCOPED_COLLECTIONS) {
      for (const row of rows(mem(), col)) {
        if (!row?.id || row.orgId) continue
        const owns = row.ownerId === user.id || row.userId === user.id || row.createdBy === user.id || row.authorId === user.id
        if (!owns && !(all && ctx.isAdminUser(user))) continue
        await ctx.persistDoc(col, row.id, { ...row, orgId })
      }
    }
  }

  async function seedShippedFeedback(user, orgId) {
    if (!user || !orgId) return
    const memory = mem()
    if (!memory.xx_feedback) memory.xx_feedback = {}
    const existing = rows(memory, 'xx_feedback')
    for (const item of SHIPPED_FEEDBACK) {
      const match = existing.find(
        (row) =>
          !String(row.id || '').startsWith('fbk_ship_') &&
          row.orgId === orgId &&
          item.re.test(`${row.title || ''} ${row.body || ''} ${row.detail || ''}`) &&
          ['new', 'nouveau', '', null, undefined].includes(row.status),
      )
      if (match) {
        await ctx.persistDoc('xx_feedback', match.id, { ...match, status: 'done', updatedAt: ctx.now(), shippedId: item.id })
      }
      const shippedId = `${item.id}__${orgId}`
      if (memory.xx_feedback[shippedId]) continue
      const now = ctx.now()
      await ctx.persistDoc('xx_feedback', shippedId, {
        id: shippedId,
        orgId,
        userId: user.id,
        ownerId: user.id,
        authorId: user.id,
        title: item.title,
        body: item.body,
        detail: item.body,
        module: item.module,
        status: 'done',
        source: 'shipped',
        votes: [],
        voterIds: [],
        priority: 'normal',
        createdAt: now,
        updatedAt: now,
        author: user.fullName || user.email || '',
        authorName: user.fullName || '',
        authorEmail: user.email || '',
      })
    }
  }

  async function createOrganization(name, user) {
    const label = String(name || '').trim()
    if (!user) throw new Error('Session requise.')
    if (label.length < 2) throw new Error('Nom d’organisation trop court.')
    const id = ctx.newId('org')
    const now = ctx.now()
    await ctx.persistDoc('xx_orgs', id, { id, name: label, createdAt: now, createdBy: user.id })
    const memberId = orgMemberId(id, user.id)
    await ctx.persistDoc('xx_org_members', memberId, {
      id: memberId,
      orgId: id,
      userId: user.id,
      email: user.email || '',
      role: 'owner',
      joinedAt: now,
    })
    ctx.setActiveOrgId(id)
    await migrateUnscoped(user, id, { all: ctx.isAdminUser(user) })
    await seedShippedFeedback(user, id)
    return mem().xx_orgs[id]
  }

  async function resolveOrganizations(user) {
    if (!user) return { memberships: [], activeOrgId: '' }
    for (const member of rows(mem(), 'xx_org_members')) {
      if (!member.userId && member.email && String(member.email).toLowerCase() === String(user.email || '').toLowerCase()) {
        const id = orgMemberId(member.orgId, user.id)
        await ctx.persistDoc('xx_org_members', id, { ...member, id, userId: user.id })
        if (member.id !== id) await ctx.removeDoc('xx_org_members', member.id)
      }
    }
    let memberships = membershipsFor(user)
    const unscoped = ORG_SCOPED_COLLECTIONS.some((col) => rows(mem(), col).some((row) => row && row.orgId == null))
    if (ctx.isAdminUser(user) && !memberships.length && unscoped) {
      const first = String(user.fullName || 'Nazix').trim().split(/\s+/)[0] || 'Nazix'
      await createOrganization(first, user)
      memberships = membershipsFor(user)
    }
    const firstOrgId = memberships[0]?.orgId || ''
    if (ctx.isAdminUser(user) && firstOrgId) await migrateUnscoped(user, firstOrgId, { all: true })
    else if (firstOrgId && memberships.length === 1) await migrateUnscoped(user, firstOrgId, { all: false })
    memberships = membershipsFor(user)
    const saved = ctx.getActiveOrgId()
    if (memberships.length === 1) ctx.setActiveOrgId(memberships[0].orgId)
    else if (!memberships.some((m) => m.orgId === saved)) ctx.setActiveOrgId('')
    else ctx.setActiveOrgId(saved)
    const active = ctx.getActiveOrgId()
    if (active) await seedShippedFeedback(user, active)
    return { memberships: membershipsFor(user), activeOrgId: ctx.getActiveOrgId() }
  }

  function assertCanManage(actor, orgId) {
    if (!isManager(actor, orgId)) throw new Error('Permission refusée.')
  }

  async function placeUserInOrg({ orgId, email, userId, role }, actor) {
    if (!orgId) throw new Error('Organisation requise.')
    assertCanManage(actor, orgId)
    const nextRole = normalizeOrgRole(role)
    const actorMember = memberOf(actor, orgId)
    if (nextRole === 'owner' && actorMember?.role !== 'owner' && !ctx.isAdminUser(actor)) {
      throw new Error('Seul un propriétaire peut nommer un propriétaire.')
    }
    const wanted = String(email || '').trim().toLowerCase()
    const target =
      (userId && mem().xx_users?.[userId]) ||
      rows(mem(), 'xx_users').find((u) => String(u.email || '').toLowerCase() === wanted)
    if (!target) throw new Error('Aucun compte avec cet e-mail.')
    const id = orgMemberId(orgId, target.id)
    const existing = mem().xx_org_members?.[id]
    await ctx.persistDoc('xx_org_members', id, {
      id,
      orgId,
      userId: target.id,
      email: target.email || wanted,
      role: nextRole,
      joinedAt: existing?.joinedAt || ctx.now(),
    })
    return mem().xx_org_members[id]
  }

  async function removeOrgMember(orgId, userId, actor) {
    assertCanManage(actor, orgId)
    const id = orgMemberId(orgId, userId)
    const existing = mem().xx_org_members?.[id]
    if (!existing) return
    const owners = rows(mem(), 'xx_org_members').filter((m) => m.orgId === orgId && m.role === 'owner')
    if (existing.role === 'owner' && owners.length <= 1) throw new Error('Impossible de retirer le dernier propriétaire.')
    await ctx.removeDoc('xx_org_members', id)
  }

  async function deleteOrganization(orgId, actor) {
    if (!ctx.isAdminUser(actor)) throw new Error('Seul un super-administrateur peut supprimer une organisation.')
    if (!mem().xx_orgs?.[orgId]) return
    await ctx.removeDoc('xx_orgs', orgId)
    for (const member of rows(mem(), 'xx_org_members')) {
      if (member.orgId === orgId) await ctx.removeDoc('xx_org_members', member.id)
    }
    if (ctx.getActiveOrgId() === orgId) ctx.setActiveOrgId('')
  }

  async function loadOrgPeek(orgId) {
    ctx.setPeek({ orgId, loading: true, error: '', rows: {} })
    const cols = ['xx_notes', 'xx_projects', 'xx_ideas', 'xx_events', 'xx_todos', 'xx_feedback']
    const out = {}
    for (const col of cols) {
      out[col] = rows(mem(), col)
        .filter((row) => row.orgId === orgId)
        .map((row) => ({ id: row.id, title: row.title || row.name || '—', orgId: row.orgId }))
    }
    if (ctx.fetchOrgCol) {
      for (const col of cols) {
        try {
          const remote = await ctx.fetchOrgCol(col, orgId)
          if (Array.isArray(remote) && remote.length) out[col] = remote
        } catch (err) {
          ctx.setPeek({ orgId, loading: false, error: err.message || 'Aperçu indisponible', rows: out })
          return out
        }
      }
    }
    ctx.setPeek({ orgId, loading: false, error: '', rows: out })
    return out
  }

  return {
    membershipsFor,
    memberOf,
    isManager,
    createOrganization,
    resolveOrganizations,
    placeUserInOrg,
    removeOrgMember,
    deleteOrganization,
    loadOrgPeek,
    seedShippedFeedback,
    migrateUnscoped,
  }
}
