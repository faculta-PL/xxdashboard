import {
  splitTitleAndBody,
  clipImportText,
  MAX_IMPORT_CHARS,
  rowsToMarkdown,
  tableDumpText,
  parseImportFile,
  previewBodyForDestination,
  extractPdfText,
} from './importParse.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const heading = splitTitleAndBody('# Compte-rendu\n\nLe sprint est livré.\nSuite.', 'fichier.md')
assert(heading.title === 'Compte-rendu', `heading title: ${heading.title}`)
assert(heading.body.includes('Le sprint est livré'), `heading body: ${heading.body}`)
assert(heading.fullText.startsWith('# Compte-rendu'), 'full text keeps heading')

const noHead = splitTitleAndBody('Juste un paragraphe sans titre.', 'idees.txt')
assert(noHead.title === 'idees', `filename title: ${noHead.title}`)
assert(noHead.body === noHead.fullText, 'body is full file without heading')

const setext = splitTitleAndBody('Rapport Q4\n========\nDétails.', 'x.md')
assert(setext.title === 'Rapport Q4', `setext: ${setext.title}`)
assert(setext.body.includes('Détails'), 'setext body is rest')

const long = 'a'.repeat(MAX_IMPORT_CHARS + 80)
assert(clipImportText(long).length === MAX_IMPORT_CHARS, 'clip 50k')

const md = rowsToMarkdown(
  [
    { Nom: 'Salaire', Montant: 1200 },
    { Nom: 'Loyer', Montant: 800 },
  ],
  ['Nom', 'Montant'],
)
assert(md.includes('| Nom | Montant |'), md)
assert(md.includes('| Salaire | 1200 |'), md)

const dump = tableDumpText([{ a: 1, b: 2 }], ['a', 'b'])
assert(dump.includes('| a | b |'), dump)

const parsedLike = {
  title: 'Compte-rendu',
  body: 'Le sprint est livré.',
  fullText: '# Compte-rendu\n\nLe sprint est livré.',
  text: '# Compte-rendu\n\nLe sprint est livré.',
}
assert(previewBodyForDestination(parsedLike, 'note_raw').startsWith('# Compte-rendu'), 'raw dumps everything')
assert(previewBodyForDestination(parsedLike, 'notes') === 'Le sprint est livré.', 'notes uses rest')

const mdFile = new File(['# Titre importé\n\nCorps complet du fichier.\nLigne 2.'], 'reunion.md', {
  type: 'text/markdown',
})
const parsedMd = await parseImportFile(mdFile)
assert(parsedMd.title === 'Titre importé', `parsed md title: ${parsedMd.title}`)
assert(parsedMd.body.includes('Corps complet'), `parsed md body: ${parsedMd.body}`)
assert(parsedMd.fullText.includes('# Titre importé'), 'parsed md full')
assert(parsedMd.extractable === true, 'md extractable')

const txtFile = new File(['Tout le texte brut sans heading.'], 'notes.txt', { type: 'text/plain' })
const parsedTxt = await parseImportFile(txtFile)
assert(parsedTxt.title === 'notes', parsedTxt.title)
assert(parsedTxt.body.includes('Tout le texte brut'), parsedTxt.body)
assert(parsedTxt.body.trim().length > 0, 'txt never empty body')

const csvFile = new File(['nom,montant\nAlpha,10\nBeta,20\n'], 'lignes.csv', { type: 'text/csv' })
const parsedCsv = await parseImportFile(csvFile)
assert(parsedCsv.kind === 'table', 'csv kind')
assert(parsedCsv.body.includes('| nom | montant |'), parsedCsv.body)
assert(parsedCsv.body.includes('Alpha'), parsedCsv.body)
assert(parsedCsv.fullText === parsedCsv.body, 'csv dump is body')
assert(previewBodyForDestination(parsedCsv, 'notes').includes('| Alpha | 10 |'), 'csv to note')

const pdfLike = '%PDF-1.4\nBT /F1 12 Tf (Compte rendu sprint) Tj ET\n'
const pdfText = extractPdfText(new TextEncoder().encode(pdfLike).buffer)
assert(pdfText.includes('Compte rendu sprint'), `pdf extract: ${pdfText}`)

console.log('importParse tests ok')
