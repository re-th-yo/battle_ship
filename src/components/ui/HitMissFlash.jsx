import { useEffect, useRef } from 'react'

// Full-screen shake + flash when a shot resolves.
// No glow. Text is black on a colored pill — readable on any background.
export default function HitMissFlash({ lastShot, onDone }) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!lastShot) return
    timerRef.current = setTimeout(() => onDone?.(), 700)
    return () => clearTimeout(timerRef.current)
  }, [lastShot, onDone])

  if (!lastShot) return null

  const isHit = lastShot.result === 'hit'
  const byBot = lastShot.by === 'bot'

  // Pill background: magenta for player hit, red for bot hit, lime for miss
  const pillBg = isHit ? (byBot ? '#FF2222' : '#FF00FF') : '#C5FF00'
  const label  = isHit ? 'HIT!' : 'MISS'

  return (
    <div
      className="shake-anim"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.15)',
      }}
    >
      <div
        className="flash-in"
        style={{
          backgroundColor: pillBg,
          padding: '12px 36px',
        }}
      >
        <span style={{
          fontFamily: "'PPFraktionMono', 'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: 'clamp(56px, 10vw, 100px)',
          color: '#000000',
          letterSpacing: '0.06em',
          userSelect: 'none',
          lineHeight: 1,
          display: 'block',
        }}>
          {label}
        </span>
      </div>
    </div>
  )
}
