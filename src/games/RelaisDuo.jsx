import { useEffect, useRef, useState } from 'react'
import { drawCoin, drawKingX, drawRock, drawZianotix } from './chars'
import { GAME_META, GameChrome, useCanvasSize } from './GameShell'

export default function RelaisDuo({ onSaveScore }) {
  const canvasRef = useRef(null)
  const fit = useCanvasSize(canvasRef)
  const stateRef = useRef(null)
  const switchRef = useRef(false)
  const [score, setScore] = useState(0)
  const [who, setWho] = useState('KingX')
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const resetWorld = () => {
    const { w, h } = fit()
    stateRef.current = {
      w,
      h,
      mode: 'kingx',
      dist: 0,
      coins: 0,
      t: 0,
      items: [],
      nextSpawn: 0.6,
    }
    setScore(0)
    setWho('KingX')
    setSaved(false)
  }

  const start = () => {
    resetWorld()
    setOver(false)
    setPaused(false)
    setRunning(true)
  }

  const toggle = () => {
    switchRef.current = true
  }

  useEffect(() => {
    fit()
    const onResize = () => {
      const size = fit()
      if (stateRef.current) {
        stateRef.current.w = size.w
        stateRef.current.h = size.h
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!running && !over) start()
        else toggle()
      }
      if ((e.key === 'p' || e.key === 'P') && running && !over) setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey, { passive: false })
    return () => window.removeEventListener('keydown', onKey)
  }, [running, over])

  useEffect(() => {
    if (!running || paused || over) return undefined
    let raf
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const canvas = canvasRef.current
      if (!s || !canvas) {
        raf = requestAnimationFrame(loop)
        return
      }
      const ctx = canvas.getContext('2d')
      if (switchRef.current) {
        s.mode = s.mode === 'kingx' ? 'zianotix' : 'kingx'
        switchRef.current = false
        setWho(s.mode === 'kingx' ? 'KingX' : 'Zianotix')
      }
      const speed = 200 + Math.min(180, s.dist * 0.35)
      s.dist += speed * dt * 0.06
      s.t += dt
      s.nextSpawn -= dt
      if (s.nextSpawn <= 0) {
        const air = Math.random() > 0.5
        const kind = Math.random() > 0.45 ? 'coin' : 'rock'
        s.items.push({
          kind,
          air,
          x: s.w + 30,
          y: air ? s.h * 0.32 : s.h * 0.72,
          r: kind === 'coin' ? 11 : 16,
        })
        s.nextSpawn = 0.55 + Math.random() * 0.45
      }
      for (const it of s.items) it.x -= speed * dt
      s.items = s.items.filter((it) => it.x > -40)

      const playerY = s.mode === 'kingx' ? s.h * 0.72 : s.h * 0.32
      const playerX = 92
      let hit = false
      s.items = s.items.filter((it) => {
        const sameLane = (s.mode === 'zianotix') === it.air
        if (sameLane && Math.hypot(it.x - playerX, it.y - playerY) < it.r + 22) {
          if (it.kind === 'coin') {
            s.coins += 1
            return false
          }
          hit = true
        }
        return true
      })

      ctx.fillStyle = '#e8ede4'
      ctx.fillRect(0, 0, s.w, s.h)
      ctx.fillStyle = '#b8c5ab'
      ctx.fillRect(0, s.h * 0.52, s.w, 4)
      ctx.fillStyle = '#cfd8c6'
      ctx.fillRect(0, s.h * 0.84, s.w, s.h)
      const groundOff = (s.t * speed) % 40
      ctx.fillStyle = '#8a9a7b'
      for (let x = -groundOff; x < s.w; x += 40) ctx.fillRect(x, s.h * 0.84, 18, 6)

      for (const it of s.items) {
        if (it.kind === 'coin') drawCoin(ctx, it.x, it.y, it.r, s.t * 6)
        else drawRock(ctx, it.x, it.y, it.r)
      }
      if (s.mode === 'kingx') drawKingX(ctx, playerX, playerY, 44, 1)
      else drawZianotix(ctx, playerX, playerY, 40, s.t * 12)

      const pts = Math.floor(s.dist) + s.coins
      setScore(pts)
      if (hit) {
        setOver(true)
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, paused, over])

  const save = async () => {
    setSaveBusy(true)
    try {
      await onSaveScore('relais-duo', score)
      setSaved(true)
    } catch {
      /* toast côté hub */
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <GameChrome
      meta={GAME_META['relais-duo']}
      score={score}
      extra={
        <p className="text-sm text-sage-700" aria-live="polite">
          Relayeur : {who}
        </p>
      }
      paused={paused}
      running={running}
      over={over}
      onStart={start}
      onPause={() => setPaused(true)}
      onResume={() => setPaused(false)}
      onRestart={start}
      onSave={save}
      saveBusy={saveBusy}
      saved={saved}
    >
      <canvas
        ref={canvasRef}
        className="block h-[420px] w-full touch-none"
        onPointerDown={(e) => {
          e.preventDefault()
          if (!running && !over) start()
          else toggle()
        }}
        aria-label="Piste Relais Duo KingX et Zianotix"
      />
    </GameChrome>
  )
}
