/** Personnages officiels — ne jamais les renommer. */

export const KINGX = 'KingX'
export const ZIANOTIX = 'Zianotix'

export function drawKingX(ctx, x, y, size, facing = 1) {
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing < 0 ? -1 : 1, 1)
  ctx.fillStyle = '#4a5644'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.12, s * 0.38, s * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#eef2ea'
  ctx.beginPath()
  ctx.arc(0, -s * 0.28, s * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c9a227'
  ctx.beginPath()
  ctx.moveTo(-s * 0.28, -s * 0.42)
  ctx.lineTo(-s * 0.14, -s * 0.72)
  ctx.lineTo(0, -s * 0.42)
  ctx.lineTo(s * 0.14, -s * 0.72)
  ctx.lineTo(s * 0.28, -s * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1f2920'
  ctx.beginPath()
  ctx.arc(-s * 0.1, -s * 0.3, s * 0.05, 0, Math.PI * 2)
  ctx.arc(s * 0.12, -s * 0.3, s * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1f2920'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, -s * 0.2, s * 0.1, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
  ctx.restore()
}

export function drawZianotix(ctx, x, y, size, flap = 0) {
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#2f382c'
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.42, s * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  const wing = Math.sin(flap) * 0.45
  ctx.fillStyle = '#5c6b54'
  ctx.beginPath()
  ctx.ellipse(-s * 0.1, -s * 0.2, s * 0.38, s * 0.16, -0.6 + wing, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(s * 0.05, s * 0.18, s * 0.32, s * 0.12, 0.5 - wing, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#eef2ea'
  ctx.beginPath()
  ctx.arc(s * 0.22, -s * 0.18, s * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1f2920'
  ctx.beginPath()
  ctx.arc(s * 0.26, -s * 0.18, s * 0.045, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c9a227'
  ctx.beginPath()
  ctx.moveTo(s * 0.36, -s * 0.12)
  ctx.lineTo(s * 0.52, -s * 0.06)
  ctx.lineTo(s * 0.36, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawSageOrb(ctx, x, y, r, t = 0) {
  ctx.save()
  ctx.fillStyle = `rgba(138, 154, 123, ${0.7 + Math.sin(t) * 0.2})`
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#eef2ea'
  ctx.beginPath()
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawRock(ctx, x, y, r) {
  ctx.save()
  ctx.fillStyle = '#1f2920'
  ctx.beginPath()
  ctx.moveTo(x - r, y + r * 0.2)
  ctx.lineTo(x - r * 0.4, y - r)
  ctx.lineTo(x + r * 0.2, y - r * 0.7)
  ctx.lineTo(x + r, y + r * 0.1)
  ctx.lineTo(x + r * 0.3, y + r)
  ctx.lineTo(x - r * 0.6, y + r * 0.85)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#3d4a38'
  ctx.beginPath()
  ctx.arc(x - r * 0.15, y, r * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawCoin(ctx, x, y, r, t = 0) {
  const sx = Math.max(0.25, Math.abs(Math.cos(t)))
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, 1)
  ctx.fillStyle = '#c9a227'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#f4f7f2'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

export function drawBranchPair(ctx, x, gapY, gapH, width, height) {
  ctx.fillStyle = '#2f382c'
  ctx.fillRect(x, 0, width, Math.max(8, gapY - gapH / 2))
  ctx.fillRect(x, gapY + gapH / 2, width, Math.max(8, height - (gapY + gapH / 2)))
  ctx.fillStyle = '#6f8163'
  ctx.fillRect(x, Math.max(0, gapY - gapH / 2 - 10), width, 10)
  ctx.fillRect(x, gapY + gapH / 2, width, 10)
}
