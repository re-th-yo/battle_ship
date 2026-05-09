import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { subscribeToRoom, deleteRoom } from '../lib/roomService.js'
import { setFirstPlayer, copyToClipboard, getRoomById } from '../lib/gameSync.js'
import { ROUTES } from '../lib/constants.js'

function CodeCell({ char }) {
  return (
    <div style={{
      clipPath: 'polygon(5px 0%,100% 0%,100% calc(100% - 5px),calc(100% - 5px) 100%,0% 100%,0% 5px)',
      backgroundColor: '#C5FF00',
      padding: 1,
    }}>
      <div style={{
        width: 52, height: 64,
        backgroundColor: '#0A0A0A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'PPFraktionMono', 'JetBrains Mono', monospace",
        fontSize: 32, fontWeight: 700,
        color: '#C5FF00',
        userSelect: 'none',
      }}>
        {char}
      </div>
    </div>
  )
}

export default function LobbyPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('waiting')
  const [dots, setDots] = useState('')
  const subRef = useRef(null)

  useEffect(() => {
    if (!state) { navigate(ROUTES.home); return }

    const { role, room, playerId } = state

    function goToPreGame(firstPlayer) {
      navigate(ROUTES.pregame, { state: { room, role, playerId, firstPlayer } })
    }

    subRef.current = subscribeToRoom(room.id, async (updated) => {
      // Host: pick first_player when guest joins
      if (role === 'host' && updated.guest_id && !updated.first_player) {
        const fp = Math.random() < 0.5 ? 'host' : 'guest'
        await setFirstPlayer(room.id, fp)
        return
      }
      if (updated.first_player) {
        setStatus('connected')
        setTimeout(() => goToPreGame(updated.first_player), 1600)
      }
    })

    // Race condition fix: check if first_player was already set before we subscribed
    getRoomById(room.id).then(current => {
      if (current.first_player) {
        setStatus('connected')
        setTimeout(() => goToPreGame(current.first_player), 1600)
      }
    })

    return () => { subRef.current?.unsubscribe() }
  }, [])

  useEffect(() => {
    if (status !== 'waiting') return
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500)
    return () => clearInterval(t)
  }, [status])

  if (!state) return null

  const { role, room } = state
  const chars = String(room.code).split('')

  function handleCopy() {
    copyToClipboard(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCancel() {
    subRef.current?.unsubscribe()
    if (role === 'host') await deleteRoom(room.id)
    navigate(ROUTES.home)
  }

  return (
    <div style={{
      width: '100%', height: '100vh',
      backgroundColor: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        position: 'absolute', top: 32, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: "'Scyborg', 'JetBrains Mono', monospace",
          fontSize: 22, color: '#C5FF00', letterSpacing: '0.04em', userSelect: 'none',
        }}>
          battle.shxp
        </div>
      </div>

      <div style={{
        clipPath: 'polygon(12px 0%,100% 0%,100% calc(100% - 12px),calc(100% - 12px) 100%,0% 100%,0% 12px)',
        backgroundColor: 'rgba(197,255,0,0.18)',
        padding: 1,
      }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36,
        backgroundColor: '#0A0A0A',
        padding: '48px 56px',
      }}>
        {status === 'waiting' && role === 'host' ? (
          <>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#C5FF00', opacity: 0.45 }}>
              ROOM CODE — SHARE WITH OPPONENT
            </div>
            <button
              onClick={handleCopy}
              style={{ display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none' }}
              title="Click to copy"
            >
              {chars.map((c, i) => <CodeCell key={i} char={c} />)}
            </button>
            <div style={{
              fontSize: 10, letterSpacing: '0.2em',
              color: copied ? '#C5FF00' : 'rgba(197,255,0,0.3)',
              transition: 'color 0.15s', marginTop: -16,
            }}>
              {copied ? '// COPIED TO CLIPBOARD' : '// CLICK CODE TO COPY'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C5FF00', opacity: 0.5, fontSize: 11, letterSpacing: '0.15em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#C5FF00', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
              WAITING FOR OPPONENT{dots}
            </div>
          </>
        ) : status === 'waiting' && role === 'guest' ? (
          <>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#C5FF00', opacity: 0.45 }}>ROOM JOINED</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C5FF00', opacity: 0.5, fontSize: 11, letterSpacing: '0.15em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#C5FF00', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
              WAITING FOR HOST{dots}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#C5FF00', opacity: 0.45 }}>MATCH FOUND</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.15em', color: '#C5FF00' }}>GAME STARTING</div>
            <div style={{ fontSize: 10, color: '#C5FF00', opacity: 0.4, letterSpacing: '0.2em' }}>PLACE YOUR UNITS...</div>
          </>
        )}
      </div>
      </div>

      {status === 'waiting' && (
        <button
          onClick={handleCancel}
          style={{
            marginTop: 32, background: 'none', border: 'none',
            color: 'rgba(197,255,0,0.3)', fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer', transition: 'color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#C5FF00' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(197,255,0,0.3)' }}
        >
          CANCEL
        </button>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  )
}
