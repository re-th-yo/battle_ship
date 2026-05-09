import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { UNIT_DEFINITIONS, ROUTES } from '../lib/constants.js'
import { canPlacePregame } from '../lib/gameEngine.js'
import { useGameContext } from '../store/GameContext.jsx'
import { submitLayout, subscribeToGame, getRoomById } from '../lib/gameSync.js'
import GameGrid from '../components/game/GameGrid.jsx'
import RoundCreditsDisplay from '../components/ui/RoundCreditsDisplay.jsx'

const CELL_SIZE = 46

// Rotation arrow indicator → ↓ ← ↑
const ROT_ARROW = ['→', '↓', '←', '↑']

function UnitCard({ unit, selected, onClick }) {
  const def = UNIT_DEFINITIONS[unit.code]
  const placed = unit.col != null
  const rot = unit.rotation ?? 0
  return (
    <button
      onClick={placed ? undefined : onClick}
      style={{
        position: 'relative',
        backgroundColor: placed ? '#1A1A1A' : def.color,
        border: selected ? '2px solid #fff' : placed ? '1px solid #2A2A2A' : 'none',
        borderRadius: 4,
        padding: '5px 10px 5px 8px',
        cursor: placed ? 'default' : 'pointer',
        opacity: placed ? 0.3 : 1,
        minWidth: 72,
        minHeight: 44,
        textAlign: 'left',
        color: unit.code === 'shld' ? '#000' : 'white',
        fontFamily: "'JetBrains Mono', monospace",
        transition: 'opacity 0.1s, transform 0.05s',
        transform: selected ? 'scale(1.04)' : 'scale(1)',
      }}
    >
      <div style={{ fontSize: 8, opacity: 0.75 }}>{unit.code}.</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{unit.level}</div>
      {/* Rotation indicator — only when selected and not placed */}
      {selected && !placed && (
        <div style={{
          position: 'absolute', top: 3, right: 4,
          fontSize: 11, opacity: 0.8, lineHeight: 1,
        }}>
          {ROT_ARROW[rot]}
        </div>
      )}
      {placed && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 12, opacity: 0.5 }}>✓</div>
      )}
    </button>
  )
}

export default function PreGamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { state: routeState } = useLocation()
  const { game } = useGameContext()
  const { state, placeUnit, pickupUnit, rotateUnit, startGame, autoPlace } = game
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [waitError, setWaitError] = useState('')
  const subRef = useRef(null)
  const waitingRef = useRef(false)

  // multiplayer info passed from LobbyPage
  const mpRoom      = routeState?.room     ?? null
  const mpRole      = routeState?.role     ?? null
  const mpPlayerId  = routeState?.playerId ?? null
  const mpFirst     = routeState?.firstPlayer ?? null

  // Recovery visibilité: si la tab revient au premier plan pendant l'attente, re-check
  useEffect(() => {
    if (!mpRoom) return
    const opponentKey = mpRole === 'host' ? 'guest_layout' : 'host_layout'
    async function handleVisibility() {
      if (document.visibilityState !== 'visible' || !waitingRef.current) return
      try {
        const currentRoom = await getRoomById(mpRoom.id)
        if (currentRoom[opponentKey] && waitingRef.current) {
          waitingRef.current = false
          subRef.current?.unsubscribe()
          const firstTurn = mpFirst === mpRole ? 'player' : 'waiting'
          navigate(ROUTES.game, {
            state: { room: mpRoom, role: mpRole, playerId: mpPlayerId, firstPlayer: mpFirst, opponentLayout: currentRoom[opponentKey], firstTurn },
          })
        }
      } catch (_) {}
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const units = state.player.units
  const allPlaced = Object.values(units).every(u => u.col != null)

  function handleCardClick(unitId) {
    setSelectedUnit(prev => prev === unitId ? null : unitId)
  }

  function handleCellClick(col, row) {
    if (!selectedUnit) return
    if (canPlacePregame(units[selectedUnit], col, row, units)) {
      placeUnit(selectedUnit, col, row)
      setSelectedUnit(null)
    }
  }

  function handlePickup(unitId) {
    pickupUnit(unitId)
    setSelectedUnit(unitId)
  }

  function handleGridRightClick() {
    if (selectedUnit) rotateUnit(selectedUnit)
  }

  async function handleStart() {
    if (!allPlaced) return

    if (!mpRoom) {
      // Bot mode — normal flow
      startGame()
      navigate(ROUTES.game)
      return
    }

    // Multiplayer — upload layout then wait for opponent
    setWaiting(true)
    waitingRef.current = true
    setWaitError('')
    const opponentKey = mpRole === 'host' ? 'guest_layout' : 'host_layout'

    try {
      await submitLayout(mpRoom.id, mpRole, units)
    } catch (e) {
      setWaiting(false)
      setWaitError(e.message || 'Supabase error — check SQL columns')
      return
    }

    function goToGame(opponentLayout) {
      if (!waitingRef.current) return // prevent double navigation
      waitingRef.current = false
      subRef.current?.unsubscribe()
      const firstTurn = mpFirst === mpRole ? 'player' : 'waiting'
      navigate(ROUTES.game, {
        state: { room: mpRoom, role: mpRole, playerId: mpPlayerId, firstPlayer: mpFirst, opponentLayout, firstTurn },
      })
    }

    // Subscribe first, then check — avoids missing the event between check and subscribe
    subRef.current = subscribeToGame(mpRoom.id, (updated) => {
      if (updated[opponentKey]) goToGame(updated[opponentKey])
    })

    try {
      const currentRoom = await getRoomById(mpRoom.id)
      if (currentRoom[opponentKey]) goToGame(currentRoom[opponentKey])
    } catch (_) {}
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      backgroundColor: '#0A0A0A', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Cross strips flanking the board */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 120,
        backgroundImage: "url('/assets/croixbleue.svg')",
        backgroundSize: '80px 80px', backgroundRepeat: 'repeat',
        opacity: 0.4, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 120,
        backgroundImage: "url('/assets/croixbleue.svg')",
        backgroundSize: '80px 80px', backgroundRepeat: 'repeat',
        opacity: 0.4, pointerEvents: 'none',
      }} />

      {/* Pink arrows decorations */}
      <img src="/assets/fleches.svg" alt="" style={{
        position: 'absolute', left: -300, top: '50%', transform: 'translateY(-50%) scaleX(-1)',
        width: 400, height: 720, opacity: 0.55, pointerEvents: 'none',
      }} />
      <img src="/assets/fleches.svg" alt="" style={{
        position: 'absolute', right: -300, top: '50%', transform: 'translateY(-50%)',
        width: 400, height: 720, opacity: 0.55, pointerEvents: 'none',
      }} />

      {/* Title top-center */}
      <div style={{
        position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
        color: '#C5FF00', opacity: 0.4, letterSpacing: '0.2em',
      }}>
        // pre_game — place your units
      </div>

      {/* ROUND badge top-right */}
      <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
        <RoundCreditsDisplay round={0} credits={0} showCredits={false} />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative', zIndex: 5 }}>

        {/* Grid panel — gray background like ref */}
        <div style={{
          backgroundColor: '#CCCCCC',
          padding: 14,
          position: 'relative',
        }}>
          {/* Corner board decorations */}
          {[
            { top: -38, left: -38, transform: 'none' },
            { top: -38, right: -38, transform: 'scaleX(-1)' },
            { bottom: -38, left: -38, transform: 'scaleY(-1)' },
            { bottom: -38, right: -38, transform: 'rotate(180deg)' },
          ].map(({ transform, ...pos }, i) => (
            <img key={i} src="/assets/blue_board_corner.svg" alt="" style={{
              position: 'absolute', ...pos, width: 130, height: 130,
              transform, pointerEvents: 'none',
            }} />
          ))}
          <GameGrid
            mode="pregame"
            units={units}
            shots={{}}
            selectedUnit={selectedUnit}
            onCellClick={handleCellClick}
            onUnitPickup={handlePickup}
            onGridRightClick={handleGridRightClick}
            cellSize={CELL_SIZE}
          />
        </div>

        {/* Sidebar */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          backgroundColor: '#0F0F0F', border: '1px solid #1E1E1E',
          padding: 10, minWidth: 100,
        }}>
          {/* Generators */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['gn_01', 'gn_02'].map(id => (
              <UnitCard key={id} unit={units[id]} selected={selectedUnit === id} onClick={() => handleCardClick(id)} />
            ))}
          </div>
          <div style={{ height: 1, backgroundColor: '#1E1E1E', margin: '2px 0' }} />
          {['shld', 'rdr', 'trll', 'gltch', 'msl'].map(id => (
            <UnitCard key={id} unit={units[id]} selected={selectedUnit === id} onClick={() => handleCardClick(id)} />
          ))}
          <div style={{ height: 1, backgroundColor: '#1E1E1E', margin: '2px 0' }} />
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            color: '#C5FF00', opacity: selectedUnit ? 0.75 : 0.3,
            textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.4,
          }}>
            {selectedUnit
            ? `> click to place\n> right-click: rotate`
            : allPlaced
              ? '> all placed ✓'
              : '> select a unit'}
          </div>
          <span style={{
            backgroundColor: 'rgba(197,255,0,0.3)',
            padding: 1, display: 'block',
          }}>
          <button
            onClick={() => { autoPlace(); setSelectedUnit(null) }}
            style={{
              display: 'block', width: '100%',
              backgroundColor: '#0F0F0F',
              border: 'none',
              color: 'rgba(197,255,0,0.55)',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              padding: '7px 10px',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#C5FF00'; e.currentTarget.parentElement.style.backgroundColor = '#C5FF00' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(197,255,0,0.55)'; e.currentTarget.parentElement.style.backgroundColor = 'rgba(197,255,0,0.3)' }}
          >
            RANDOM
          </button>
          </span>
          <span style={{
            backgroundColor: allPlaced && !waiting ? '#C5FF00' : 'rgba(197,255,0,0.3)',
            padding: 1, display: 'block', marginTop: 6,
          }}>
          <button
            onClick={handleStart}
            disabled={!allPlaced || waiting}
            style={{
              display: 'block', width: '100%',
              backgroundColor: allPlaced && !waiting ? '#C5FF00' : '#0F0F0F',
              border: 'none',
              color: allPlaced && !waiting ? '#000' : 'rgba(197,255,0,0.3)',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              padding: '9px 10px',
              cursor: allPlaced && !waiting ? 'pointer' : 'not-allowed',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { if (allPlaced && !waiting) e.currentTarget.style.backgroundColor = '#fff' }}
            onMouseLeave={e => { if (allPlaced && !waiting) e.currentTarget.style.backgroundColor = '#C5FF00' }}
          >
            {waiting ? 'WAITING FOR OPPONENT...' : 'START'}
          </button>
          </span>
          {waitError && (
            <div style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 8,
              color: '#FF1493', letterSpacing: '0.08em', marginTop: 4,
              wordBreak: 'break-all',
            }}>
              // {waitError.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#C5FF00', opacity: 0.25, letterSpacing: '0.1em',
      }}>
        {mpRoom ? `MULTIPLAYER / ${mpRole?.toUpperCase()}` : `BOT / ${(searchParams.get('difficulty') || 'easy').toUpperCase()}`}
      </div>
    </div>
  )
}
