import { useEffect, useRef, useState } from 'react'
import { drawKingX, drawRock, drawSageOrb } from './chars'
import { GAME_META, GameChrome, useCanvasSize } from './GameShell'

const DURATION = 45
const HITS_MAX = 3

function spawn(w, h, kind) {
  return {
    kind,
    x: 40 + Math.random() * Math.max(40, w - 80),
    y: 50 + Math.random() * Math.max(40, h - 100),
    r: kind === 'orb' ? 12 : 16 + Math.random() * 10,
    vx: kind === 'rock' ? (Math.random() - 0.5) * 40 : 0,
    vy: kind === 'rock' ? (Math.random() - 0.5) * 40 : 0,
  }
}

export default function KingXCueillette({ onSaveScore }) {
  const canvasRef = useRef(null)
  const fit = useCanvasSize(canvasRef)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const swipeRef = useRef({ x: 0, y: 0 })
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(DURATION)
  const [hits, setHits] = useState(0)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const resetWorld = () => {
    const { w, h } = fit()
    const orbs = Array.from({ length: 5 }, () => spawn(w, h, 'orb'))
    const rocks = Array.from({ length: 4 }, () => spawn(w, h, 'rock'))
    stateRef.current = {
      w,
      h,
      x: w / 2,
      y: h / 2,
      orbs,
      rocks,
      t: 0,
      elapsed: 0,
      orbsGot: 0,
      hits: 0,
      invuln: 0,
      facing: 1,
    }
    setScore(0)
    setLeft(DURATION)
    setHits(0)
    setSaved(false)
  }

  const start = () => {
    resetWorld()
    setOver(false)
    setPaused(false)
    setRunning(true)
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
    const down = (e) => {
      keysRef.current[e.key.toLowerCase()] = true
      if (e.key === 'p' || e.key === 'P') {
        if (running && !over) setPaused((p) => !p)
      }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    }
    const up = (e) => {
      keysRef.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
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
      const keys = keysRef.current
      let vx = 0
      let vy = 0
      if (keys.arrowleft || keys.a) vx -= 1
      if (keys.arrowright || keys.d) vx += 1
      if (keys.arrowup || keys.w) vy -= 1
      if (keys.arrowdown || keys.s) vy += 1
      if (swipeRef.current.x || swipeRef.current.y) {
        vx += swipeRef.current.x
        vy += swipeRef.current.y
      }
      const mag = Math.hypot(vx, vy) || 1
      const speed = 210
      s.x = Math.max(24, Math.min(s.w - 24, s.x + (vx / mag) * speed * dt))
      s.y = Math.max(28, Math.min(s.h - 24, s.y + (vy / mag) * speed * dt))
      if (vx < 0) s.facing = -1
      if (vx > 0) s.facing = 1
      s.t += dt
      s.elapsed += dt
      s.invuln = Math.max(0, s.invuln - dt)

      for (const rock of s.rocks) {
        rock.x += rock.vx * dt
        rock.y += rock.vy * dt
        if (rock.x < rock.r || rock.x > s.w - rock.r) rock.vx *= -1
        if (rock.y < rock.r || rock.y > s.h - rock.r) rock.vy *= -1
      }

      s.orbs = s.orbs.filter((orb) => {
        if (Math.hypot(orb.x - s.x, orb.y - s.y) < orb.r + 22) {
          s.orbsGot += 1
          return false
        }
        return true
      })
      while (s.orbs.length < 5) s.orbs.push(spawn(s.w, s.h, 'orb'))

      if (s.invuln <= 0) {
        for (const rock of s.rocks) {
          if (Math.hypot(rock.x - s.x, rock.y - s.y) < rock.r + 18) {
            s.hits += 1
            s.invuln = 1.1
            break
          }
        }
      }

      ctx.fillStyle = '#eef2ea'
      ctx.fillRect(0, 0, s.w, s.h)
      ctx.fillStyle = '#d4dccb'
      for (let i = 0; i < 8; i += 1) {
        ctx.fillRect((i * 97 + s.t * 12) % s.w, (i * 53) % s.h, 18, 8)
      }
      for (const orb of s.orbs) drawSageOrb(ctx, orb.x, orb.y, orb.r, s.t * 4 + orb.x)
      for (const rock of s.rocks) drawRock(ctx, rock.x, rock.y, rock.r)
      drawKingX(ctx, s.x, s.y, 42, s.facing)

      const remain = Math.max(0, DURATION - s.elapsed)
      setScore(s.orbsGot * 10)
      setLeft(remain)
      setHits(s.hits)
      if (remain <= 0 || s.hits >= HITS_MAX) {
        setOver(true)
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, paused, over])

  const pointer = useRef(null)
  const onPointerDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture?.(e.pointerId)
    pointer.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e) => {
    if (!pointer.current) return
    const dx = e.clientX - pointer.current.x
    const dy = e.clientY - pointer.current.y
    pointer.current = { x: e.clientX, y: e.clientY }
    const mag = Math.hypot(dx, dy) || 1
    swipeRef.current = { x: dx / mag, y: dy / mag }
  }
  const onPointerUp = () => {
    pointer.current = null
    swipeRef.current = { x: 0, y: 0 }
  }

  const save = async () => {
    setSaveBusy(true)
    try {
      await onSaveScore('kingx-cueillette', score)
      setSaved(true)
    } catch {
      /* toast côté hub */
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <GameChrome
      meta={GAME_META['kingx-cueillette']}
      score={score}
      extra={
        <p className="text-sm text-sage-700" aria-live="polite">
          {Math.ceil(left)} s · chocs {hits}/{HITS_MAX}
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Terrain de KingX Cueillette"
      />
    </GameChrome>
  )
}
