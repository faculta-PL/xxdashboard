import { useEffect, useRef, useState } from 'react'
import { drawBranchPair, drawZianotix } from './chars'
import { GAME_META, GameChrome, useCanvasSize } from './GameShell'

export default function ZianotixVol({ onSaveScore }) {
  const canvasRef = useRef(null)
  const fit = useCanvasSize(canvasRef)
  const stateRef = useRef(null)
  const flapRef = useRef(false)
  const [score, setScore] = useState(0)
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
      y: h / 2,
      vy: 0,
      x: 90,
      dist: 0,
      t: 0,
      branches: [
        { x: w * 0.7, gapY: h * 0.45, gapH: 150 },
        { x: w * 1.15, gapY: h * 0.55, gapH: 150 },
      ],
    }
    setScore(0)
    setSaved(false)
  }

  const start = () => {
    resetWorld()
    setOver(false)
    setPaused(false)
    setRunning(true)
  }

  const flap = () => {
    flapRef.current = true
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
        else flap()
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
      if (flapRef.current) {
        s.vy = -260
        flapRef.current = false
      }
      s.vy += 720 * dt
      s.y += s.vy * dt
      const speed = 160 + Math.min(140, s.dist * 0.4)
      for (const b of s.branches) b.x -= speed * dt
      if (s.branches[0].x < -50) {
        s.branches.shift()
        const lastB = s.branches[s.branches.length - 1]
        s.branches.push({
          x: lastB.x + 280 + Math.random() * 80,
          gapY: 90 + Math.random() * (s.h - 180),
          gapH: 130 + Math.random() * 30,
        })
      }
      s.dist += speed * dt * 0.08
      s.t += dt

      const hitFloor = s.y > s.h - 18 || s.y < 18
      let hitBranch = false
      for (const b of s.branches) {
        const inX = s.x + 18 > b.x && s.x - 18 < b.x + 46
        const inGap = s.y > b.gapY - b.gapH / 2 + 8 && s.y < b.gapY + b.gapH / 2 - 8
        if (inX && !inGap) hitBranch = true
      }

      ctx.fillStyle = '#c5d0bb'
      ctx.fillRect(0, 0, s.w, s.h)
      ctx.fillStyle = '#eef2ea'
      ctx.fillRect(0, 0, s.w, 18)
      ctx.fillRect(0, s.h - 18, s.w, 18)
      for (const b of s.branches) drawBranchPair(ctx, b.x, b.gapY, b.gapH, 46, s.h)
      drawZianotix(ctx, s.x, s.y, 38, s.t * 10 + s.vy * 0.02)

      const pts = Math.floor(s.dist)
      setScore(pts)
      if (hitFloor || hitBranch) {
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
      await onSaveScore('zianotix-vol', score)
      setSaved(true)
    } catch {
      /* toast côté hub */
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <GameChrome
      meta={GAME_META['zianotix-vol']}
      score={score}
      extra={<p className="text-sm text-sage-700">Espace / toucher = battement</p>}
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
          else flap()
        }}
        aria-label="Ciel de Zianotix Vol"
      />
    </GameChrome>
  )
}
