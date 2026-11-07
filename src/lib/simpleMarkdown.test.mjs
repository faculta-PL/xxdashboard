import { looksLikeCalc, parseSimpleBlocks, plainPreview, splitInline } from './simpleMarkdown.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const blocks = parseSimpleBlocks('# Titre\n\n- un\n- deux\n\n**gras** et suite\n\n15.79 + 5.99 = 21.78\n\n## Sous')
assert(blocks[0].type === 'h1' && blocks[0].text === 'Titre', 'h1')
assert(blocks[1].type === 'ul' && blocks[1].items[1] === 'deux', 'ul')
assert(blocks[2].type === 'p' && blocks[2].text.includes('gras'), 'p')
assert(blocks[3].type === 'calc', 'calc')
assert(blocks[4].type === 'h2', 'h2')

const inline = splitInline('Bonjour **Nazix** et `code`')
assert(inline.some((p) => p.type === 'strong' && p.text === 'Nazix'), 'strong')
assert(inline.some((p) => p.type === 'code' && p.text === 'code'), 'code')

assert(looksLikeCalc('16×12 (34 bottle)= 504') === true, 'calc mul')
assert(looksLikeCalc('Hello world this is a note') === false, 'not calc')

const preview = plainPreview('# Prix\n\n- a\n- b')
assert(preview.startsWith('Prix'), 'preview heading')
assert(preview.includes('• a'), 'preview list')
assert(!preview.includes('<'), 'no html')

assert(parseSimpleBlocks('').length === 0, 'empty')
assert(parseSimpleBlocks('ligne 1\n\nligne 2').length === 2, 'paragraphs')

console.log('simpleMarkdown ok')
