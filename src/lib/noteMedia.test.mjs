import { extractMediaUrls, isImageUrl, safeHttpUrl, splitContentMedia } from './noteMedia.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(safeHttpUrl('javascript:alert(1)') === '', 'no js')
assert(safeHttpUrl('https://cdn.example.com/a.png') === 'https://cdn.example.com/a.png', 'https')
assert(isImageUrl('https://x.test/pic.jpg') === true, 'jpg')
assert(isImageUrl('https://x.test/doc.pdf') === false, 'pdf not image')
const media = extractMediaUrls('voir https://x.test/a.png et https://x.test/page')
assert(media.images[0].includes('a.png'), 'extract image')
assert(media.links[0].includes('page'), 'extract link')
const parts = splitContentMedia('avant https://x.test/a.png après')
assert(parts[0].type === 'text', 'text')
assert(parts[1].type === 'image', 'img part')
console.log('noteMedia ok')
