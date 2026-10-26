import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function utf8Bom(str) {
  return `\uFEFF${str}`
}

function flattenRows(entities, type) {
  return entities.map((e) => ({
    Type: type,
    Id: e.id,
    Titre: e.title || e.fullName || '',
    Description: e.description || e.body || '',
    Statut: e.status || '',
    Catégorie: e.category || '',
    Visibilité: e.visibility || '',
    Progression: e.progress ?? '',
    Propriétaire: e.ownerId || '',
    Créé: e.createdAt || '',
    Modifié: e.updatedAt || '',
  }))
}

export function exportJSON(bundle, filename = 'xxdashboard-export.json') {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  saveAs(blob, filename)
}

export function exportCSV(rows, filename = 'xxdashboard-export.csv') {
  if (!rows.length) {
    saveAs(new Blob([utf8Bom('Aucune donnée\n')], { type: 'text/csv;charset=utf-8' }), filename)
    return
  }
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(';'),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] == null ? '' : String(r[h]).replace(/"/g, '""')
          return `"${v}"`
        })
        .join(';'),
    ),
  ]
  saveAs(new Blob([utf8Bom(lines.join('\n'))], { type: 'text/csv;charset=utf-8' }), filename)
}

export function exportXLSX(rows, filename = 'xxdashboard-export.xlsx') {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'XXDashboard')
  const buf = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}

export async function exportDOCX(sections, filename = 'xxdashboard-rapport.docx') {
  const children = [
    new Paragraph({
      text: 'Rapport XXDashboard',
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Généré le ${new Date().toLocaleString('fr-FR')}`,
          italics: true,
        }),
      ],
    }),
  ]

  for (const section of sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280 },
      }),
    )
    if (!section.items?.length) {
      children.push(new Paragraph({ text: 'Aucune entrée.' }))
      continue
    }
    for (const item of section.items) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.title || 'Sans titre', bold: true })],
          spacing: { before: 160 },
        }),
      )
      if (item.description) {
        children.push(new Paragraph({ text: item.description }))
      }
      if (item.meta) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item.meta, italics: true, size: 20 })],
          }),
        )
      }
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename)
}

export function exportPDF(title, tables, filename = 'xxdashboard-export.pdf') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, 40, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 40, 68)

  let startY = 90
  for (const table of tables) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(table.title, 40, startY)
    startY += 10
    autoTable(doc, {
      startY,
      head: [table.headers],
      body: table.rows.length ? table.rows : [['—']],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [92, 107, 84] },
      margin: { left: 40, right: 40 },
    })
    startY = (doc.lastAutoTable?.finalY || startY) + 24
    if (startY > 720) {
      doc.addPage()
      startY = 48
    }
  }
  doc.save(filename)
}

export function buildExportRows({ notes, ideas, projects, events }) {
  return [
    ...flattenRows(notes, 'Note'),
    ...flattenRows(ideas, 'Idée'),
    ...flattenRows(projects, 'Projet'),
    ...flattenRows(events, 'Événement'),
  ]
}

export function buildDocSections({ notes, ideas, projects, events }) {
  return [
    {
      title: 'Notes',
      items: notes.map((n) => ({
        title: n.title,
        description: n.content,
        meta: `${n.category || ''} · ${n.visibility || ''} · ${n.updatedAt || ''}`,
      })),
    },
    {
      title: 'Idées',
      items: ideas.map((i) => ({
        title: i.title,
        description: i.description,
        meta: `Statut: ${i.status} · Votes: ${(i.votes || []).length}`,
      })),
    },
    {
      title: 'Projets',
      items: projects.map((p) => ({
        title: p.title,
        description: p.description,
        meta: `${p.status} · ${p.progress ?? 0}% · échéance ${p.dueDate || '—'}`,
      })),
    },
    {
      title: 'Événements',
      items: events.map((e) => ({
        title: e.title,
        description: e.description,
        meta: `${e.date || ''} ${e.time || ''}`,
      })),
    },
  ]
}

export function buildPdfTables({ notes, ideas, projects, events }) {
  return [
    {
      title: 'Notes',
      headers: ['Titre', 'Catégorie', 'Visibilité'],
      rows: notes.map((n) => [n.title || '', n.category || '', n.visibility || '']),
    },
    {
      title: 'Idées',
      headers: ['Titre', 'Statut', 'Votes'],
      rows: ideas.map((i) => [i.title || '', i.status || '', String((i.votes || []).length)]),
    },
    {
      title: 'Projets',
      headers: ['Titre', 'Statut', 'Progression'],
      rows: projects.map((p) => [p.title || '', p.status || '', `${p.progress ?? 0}%`]),
    },
    {
      title: 'Événements',
      headers: ['Titre', 'Date', 'Heure'],
      rows: events.map((e) => [e.title || '', e.date || '', e.time || '']),
    },
  ]
}
