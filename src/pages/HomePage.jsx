import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { ROUTES } from '../lib/constants.js'
import { useGameContext } from '../store/GameContext.jsx'
import { createRoom, joinRoom } from '../lib/roomService.js'
import { VERSION } from '../lib/version.js'

// Single blue cross per corner, larger, lighter blue
function CornerCross({ top, bottom, left, right }) {
  return (
    <img
      src="/assets/croixbleue.svg"
      alt=""
      style={{
        position: 'absolute',
        top, bottom, left, right,
        width: 280, height: 280,
        opacity: 0.55,
        filter: 'brightness(3)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}

// Large diagonal pink arrows on each side
function FlechesSide({ left, right }) {
  return (
    <img
      src="/assets/fleches.svg"
      alt=""
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left, right,
        width: 340,
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        opacity: 0.55,
        pointerEvents: 'none',
        userSelect: 'none',
        transform: left !== undefined ? 'scaleX(-1)' : undefined,
      }}
    />
  )
}

// Yellow lines — fixed 900×900px, centered, same size regardless of window
function YellowLines() {
  return (
    <img
      src="/assets/yellowlines.svg"
      alt=""
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 900, height: 900,
        minWidth: 900, minHeight: 900,
        opacity: 0.5,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 1,
      }}
    />
  )
}

// Logo — title auto-sized to match subtitle width via JS measurement
function Logo() {
  const titleRef   = useRef(null)
  const subtitleRef = useRef(null)

  useEffect(() => {
    const title    = titleRef.current
    const subtitle = subtitleRef.current
    if (!title || !subtitle) return
    const subW  = subtitle.getBoundingClientRect().width
    const titW  = title.getBoundingClientRect().width
    const curFS = parseFloat(window.getComputedStyle(title).fontSize)
    title.style.fontSize = (curFS * subW / titW) + 'px'
    title.style.opacity  = '1'
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div ref={titleRef} style={{
        fontFamily: "'Scyborg', 'JetBrains Mono', monospace",
        fontSize: 64,
        fontWeight: 400,
        color: '#C5FF00',
        letterSpacing: '0.04em',
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        opacity: 0,
      }}>
        battle.shxp
      </div>
      <p ref={subtitleRef} style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: '#C5FF00',
        opacity: 0.5,
        letterSpacing: '0.04em',
        margin: 0,
        whiteSpace: 'nowrap',
      }}>
        /Reinvented Battleship Game________________________________@rethyo_visual
      </p>
    </div>
  )
}

function MenuBtn({ label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block',
        backgroundColor: '#C5FF00',
        border: 'none',
        color: '#0A0A0A',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14, fontWeight: 700, letterSpacing: '0.12em',
        padding: '11px 18px', textAlign: 'left',
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'background-color 0.08s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = '#fff' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.backgroundColor = '#C5FF00' }}
    >{label}</button>
  )
}

function DiffModal({ onSelect, onClose }) {
  const opts = [
    { key: 'easy',   label: 'EASY',   desc: 'Random shots' },
    { key: 'medium', label: 'MEDIUM', desc: 'Hunt around hits' },
    { key: 'hard',   label: 'HARD',   desc: 'Alignment targeting' },
  ]
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid #C5FF00' }}
      >
      <div style={{ backgroundColor: '#0D0D0D', padding: '28px 32px', minWidth: 260 }}>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", color: '#C5FF00',
          fontSize: 10, opacity: 0.5, marginBottom: 14, letterSpacing: '0.2em',
        }}>
          SELECT DIFFICULTY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map(o => (
            <button key={o.key} onClick={() => onSelect(o.key)}
              style={{
                backgroundColor: 'transparent', border: '1px solid #C5FF00',
                color: '#C5FF00', fontFamily: "'JetBrains Mono',monospace",
                padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.08s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#C5FF00'; e.currentTarget.style.color = '#000' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#C5FF00' }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.1em' }}>{o.label}</div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}

function JoinModal({ onClose }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (code.length < 6) return
    setLoading(true)
    setError('')
    try {
      const result = await joinRoom(code)
      navigate(ROUTES.lobby, { state: result })
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid #C5FF00' }}
      >
      <div style={{ backgroundColor: '#0D0D0D', padding: '32px 36px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", color: '#C5FF00',
          fontSize: 10, opacity: 0.5, letterSpacing: '0.2em',
        }}>
          ENTER ROOM CODE
        </div>
        <input
          autoFocus
          value={code}
          onChange={e => {
            setError('')
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleJoin() }}
          maxLength={6}
          placeholder="XXXXXX"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid rgba(197,255,0,0.4)',
            color: '#C5FF00',
            fontFamily: "'PPFraktionMono','JetBrains Mono',monospace",
            fontSize: 30, fontWeight: 700,
            letterSpacing: '0.25em', textAlign: 'center',
            padding: '12px 16px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#C5FF00' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(197,255,0,0.4)' }}
        />
        {error && (
          <div style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10, color: '#FF1493', letterSpacing: '0.12em',
          }}>
            // {error.toUpperCase()}
          </div>
        )}
        <button
          onClick={handleJoin}
          disabled={code.length < 6 || loading}
          style={{
            backgroundColor: code.length === 6 && !loading ? '#C5FF00' : 'transparent',
            border: '1px solid #C5FF00',
            color: code.length === 6 && !loading ? '#0A0A0A' : 'rgba(197,255,0,0.35)',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
            padding: '11px 18px',
            cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.08s',
          }}
        >
          {loading ? 'CONNECTING...' : 'CONNECT →'}
        </button>
      </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { setDifficulty, game } = useGameContext()
  const [showDiff, setShowDiff] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  function selectDiff(diff) {
    setDifficulty(diff)
    game.reset()
    setShowDiff(false)
    navigate(`${ROUTES.pregame}?difficulty=${diff}`)
  }

  async function handleCreate() {
    setCreating(true)
    setCreateError('')
    try {
      const result = await createRoom()
      navigate(ROUTES.lobby, { state: result })
    } catch (e) {
      console.error('CREATE ERROR:', e)
      setCreateError(e.message || 'Erreur inconnue')
      setCreating(false)
    }
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      backgroundColor: '#0A0A0A', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <YellowLines />

      {/* Blue cross clusters — 4 corners */}
      <CornerCross top={0} left={0} />
      <CornerCross top={0} right={0} />
      <CornerCross bottom={0} left={0} />
      <CornerCross bottom={0} right={0} />

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40,
      }}>
        <Logo />
        {/* Button column — fit-content, centered */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <MenuBtn label="1/..JOIN"  onClick={() => setShowJoin(true)} />
          <MenuBtn label={creating ? '2/......' : '2/CREATE'} onClick={handleCreate} disabled={creating} />
          <MenuBtn label="3/...BOT"  onClick={() => setShowDiff(true)} />
          <MenuBtn label="4/..TUTO"  disabled />
          {createError && (
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 9, color: '#FF1493', letterSpacing: '0.1em',
              marginTop: 4, wordBreak: 'break-all',
            }}>
              // {createError.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Version — bottom right */}
      <div style={{
        position: 'absolute', bottom: 14, right: 18,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, color: '#C5FF00', opacity: 0.25, letterSpacing: '0.15em',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        v{VERSION}
      </div>

      {showDiff && <DiffModal onSelect={selectDiff} onClose={() => setShowDiff(false)} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}
