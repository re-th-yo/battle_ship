import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGameContext } from '../store/GameContext.jsx'
import { submitShot, submitGltch, submitJam, submitAction, subscribeToGame, getRoomById } from '../lib/gameSync.js'
import { getMissileCells, nextLevel, getUnitCells, applyUpgrade, cellKey } from '../lib/gameEngine.js'
import { ROUTES, ROW_LABELS, COL_LABELS, GRID_COLS, GRID_ROWS } from '../lib/constants.js'
import GameGrid from '../components/game/GameGrid.jsx'
import HitMissFlash from '../components/ui/HitMissFlash.jsx'
import RoundCreditsDisplay from '../components/ui/RoundCreditsDisplay.jsx'
import UnitContextMenu from '../components/game/UnitContextMenu.jsx'

const CELL_SIZE = 48
const LAYOUT_DELAY = 2000
const BOT_DELAY    = 3500
// sessionStorage = per-tab, no collision between two players on same device
const MP_SESSION_KEY = 'battle_mp_session'
const MP_STATE_KEY   = 'battle_mp_state'
const ss = window.sessionStorage

function cellName(col, row) {
  if (col == null || row == null) return ''
  return `${ROW_LABELS[row]}${col + 1}`
}

function parseCell(input) {
  const m = input.trim().toUpperCase().match(/^([A-J])(\d{1,2})$/)
  if (!m) return null
  const row = ROW_LABELS.indexOf(m[1])
  const col = parseInt(m[2], 10) - 1
  if (row < 0 || col < 0 || col >= GRID_COLS || row >= GRID_ROWS) return null
  return { col, row }
}

// ─── Fire bar (below board in attack mode) ────────────────────────────────────
function FireBar({ targetName, canFire, waiting, onFire }) {
  const ready = canFire && !waiting
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Target cell name — digit-box style */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(targetName || '??').split('').map((ch, i) => (
          <div key={i} style={{
            width: 42, height: 50,
            backgroundColor: ready ? '#C5FF00' : 'rgba(197,255,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}>
            <span style={{
              fontFamily: "'PPFraktionMono','JetBrains Mono',monospace",
              fontWeight: 700, fontSize: 28,
              color: ready ? '#0A0A0A' : 'rgba(197,255,0,0.35)',
              lineHeight: 1,
            }}>{ch}</span>
          </div>
        ))}
      </div>

      {/* FIRE button */}
      {ready ? (
        <span style={{
          backgroundColor: '#C5FF00',
          padding: 2, display: 'inline-block',
        }}>
          <button
            onClick={onFire}
            style={{
              backgroundColor: '#C5FF00', border: 'none',
              color: '#000',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 13, fontWeight: 700, letterSpacing: '0.18em',
              padding: '10px 28px',
              cursor: 'pointer', transition: 'background-color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#C5FF00' }}
          >
            {waiting ? 'OPP. PLAYING...' : 'FIRE.exe'}
          </button>
        </span>
      ) : (
        <button
          onClick={onFire}
          disabled
          style={{
            backgroundColor: 'rgba(197,255,0,0.06)',
            border: '2px solid rgba(197,255,0,0.15)',
            color: 'rgba(197,255,0,0.2)',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: '0.18em',
            padding: '10px 28px',
            cursor: 'not-allowed',
          }}
        >
          {waiting ? 'OPP. PLAYING...' : 'FIRE.exe'}
        </button>
      )}

      {/* Hint */}
      {!waiting && !canFire && (
        <div style={{ fontSize: 8, color: 'rgba(197,255,0,0.25)', letterSpacing: '0.15em' }}>
          {targetName === '??' ? 'SELECT COL + ROW' : targetName.length === 1 ? 'SELECT ROW' : ''}
        </div>
      )}
    </div>
  )
}

// ─── Ability button ───────────────────────────────────────────────────────────
function AbilityBtn({ label, active, used, disabled, onClick }) {
  return (
    <button
      disabled={disabled || used}
      onClick={onClick}
      style={{
        backgroundColor: active ? 'rgba(0,0,0,0.15)' : 'transparent',
        border: `1px solid ${active ? 'rgba(0,0,0,0.35)' : 'transparent'}`,
        color: (disabled || used) ? 'rgba(0,0,0,0.25)' : '#000',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        cursor: (disabled || used) ? 'not-allowed' : 'pointer',
        padding: '5px 12px',
        textDecoration: used ? 'line-through' : 'none',
        transition: 'background-color 0.1s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Mode toggle (vertical, right side of board) ─────────────────────────────
function ModeToggleBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        right: -48,
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: '#C5FF00',
        color: '#000',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        padding: '14px 6px',
        cursor: 'pointer',
        border: 'none',
        clipPath: 'polygon(0% 0%,100% 6px,100% calc(100% - 6px),0% 100%)',
        zIndex: 10,
        transition: 'background-color 0.08s',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#C5FF00' }}
    >
      {label}
    </button>
  )
}

const ABILITY_COLORS = { rdr: '#FF0000', gltch: '#7B2CBF', msl: '#FF1493' }

// ─── Blue turn indicator (shown above the grid inside the panel) ──────────────
function TurnIndicator({ phase, turn, uiMode, abilityMode, abilityNotif }) {
  if (phase === 'gameover') return null

  let text, color
  if (abilityNotif) {
    const who = abilityNotif.by === 'player' ? 'PLAYER' : 'BOT'
    text  = `// ${who} uses ${abilityNotif.ability}.exe`
    color = ABILITY_COLORS[abilityNotif.ability] ?? '#2c00ff'
  } else if (abilityMode) {
    text  = `// SELECT TARGET [${abilityMode.toUpperCase()}]`
    color = '#2c00ff'
  } else if (turn === 'waiting') {
    text  = '// OPPONENT PLAYING...'
    color = '#2c00ff'
  } else {
    text  = uiMode === 'attack' ? '// YOUR TURN' : '// YOUR TURN  [layout view]'
    color = '#2c00ff'
  }

  return (
    <div style={{
      textAlign: 'center',
      marginBottom: 8,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color,
      transition: 'color 0.2s',
    }}>
      {text}
    </div>
  )
}

// ─── Cross strips flanking the board ─────────────────────────────────────────
function CrossStrip({ side }) {
  return (
    <div style={{
      position: 'absolute',
      [side]: -100,
      top: 0,
      bottom: 0,
      width: 90,
      backgroundImage: "url('/assets/croixbleue.svg')",
      backgroundSize: '90px 90px',
      backgroundRepeat: 'repeat',
      opacity: 0.55,
      pointerEvents: 'none',
    }} />
  )
}

// ─── Pink arrows ─────────────────────────────────────────────────────────────
function FlechesSide({ side }) {
  return (
    <img
      src="/assets/fleches.svg"
      alt=""
      style={{
        position: 'absolute',
        [side]: -300,
        top: '50%',
        transform: `translateY(-50%)${side === 'left' ? ' scaleX(-1)' : ''}`,
        width: 400,
        height: 720,
        opacity: 0.55,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GamePage() {
  const navigate = useNavigate()
  const { state: routeState } = useLocation()
  const { game } = useGameContext()
  const {
    state, playerShot, opponentShot, opponentForfeit, botTakeTurn, startGameMultiplayer, restoreState,
    setUiMode, reset, repairUnit, upgradeUnit, useRadar, useGltch, useMsl,
    clearLastShot, clearLastAbility, buyAbility, clearShots,
  } = game

  // Multiplayer context — routeState on fresh nav, localStorage on reload
  const savedSession = useMemo(() => {
    try { return JSON.parse(ss.getItem(MP_SESSION_KEY) || 'null') } catch { return null }
  }, [])
  const session        = routeState?.room ? routeState : savedSession
  const mpRoom         = session?.room ?? null
  const mpRole         = session?.role ?? null
  const mpPlayerId     = session?.playerId ?? null
  const mpFirstPlayer  = session?.firstPlayer ?? null
  const mpOpponent     = session?.opponentLayout ?? routeState?.opponentLayout ?? null
  const mpFirstTurn    = session?.firstTurn ?? routeState?.firstTurn ?? 'player'
  const isMultiplayer  = !!mpRoom
  const opponentShotsKey = mpRole === 'host' ? 'guest_shots' : 'host_shots'

  const layoutTimerRef    = useRef(null)
  const botTimerRef       = useRef(null)
  const flashTimerRef     = useRef(null)
  const turnFlashRef      = useRef(null)
  const prevTurnRef       = useRef(null)
  const abilityNotifRef   = useRef(null)
  const appliedShotsRef       = useRef(0)
  const mpSubRef              = useRef(null)
  const lastActionTsRef       = useRef({ host: 0, guest: 0 })
  const actionBannerTimerRef  = useRef(null)

  const { phase, round, turn, uiMode, player, bot, winner, lastShot } = state
  // In multiplayer, derive round from total shots so both players stay in sync
  const displayRound = round
  // lastAbility handled via useEffect → abilityNotif local state
  const isPlayerTurn = phase === 'playing' && turn === 'player'
  const isAttack = uiMode === 'attack'

  const [abilityMode,    setAbilityMode]    = useState(null)
  const [ctxMenu,        setCtxMenu]        = useState(null)
  const [flashCell,      setFlashCell]      = useState(null)
  const [showTurnFlash,  setShowTurnFlash]  = useState(false)
  const [abilityNotif,   setAbilityNotif]   = useState(null)
  const [firstBanner,    setFirstBanner]    = useState(false)
  const [mpJamTurns,     setMpJamTurns]     = useState(0)
  const [shotError,      setShotError]      = useState('')
  const [actionBanner,   setActionBanner]   = useState(null)
  const [showQuitMenu,   setShowQuitMenu]   = useState(false)
  const quitMenuRef = useRef(null)
  // Col/row attack selection
  const [selectedCol,    setSelectedCol]    = useState(null)
  const [selectedRow,    setSelectedRow]    = useState(null)
  const [shakeClass,     setShakeClass]     = useState('')

  // Init multiplayer game — fresh nav OR reload
  useEffect(() => {
    if (!isMultiplayer) return
    const savedState = (() => {
      try { return JSON.parse(ss.getItem(MP_STATE_KEY) || 'null') } catch { return null }
    })()

    if (savedState && savedState.roomId === mpRoom?.id) {
      // Restore saved game state
      restoreState(savedState.gameState)
      appliedShotsRef.current = savedState.appliedShots ?? 0
      // Catch up any shots missed while offline
      getRoomById(mpRoom.id).then(room => {
        const shots = room[opponentShotsKey] || []
        while (appliedShotsRef.current < shots.length) {
          opponentShot(shots[appliedShotsRef.current].col, shots[appliedShotsRef.current].row)
          appliedShotsRef.current++
        }
        // Check if opponent forfeited while we were offline
        if (room.host_action?.type === 'forfeit' && mpRole !== 'host') { opponentForfeit(); return }
        if (room.guest_action?.type === 'forfeit' && mpRole !== 'guest') { opponentForfeit(); return }
        // Seed timestamps so stale non-forfeit actions don't retrigger banners on reconnect
        if (room.host_action?.ts) lastActionTsRef.current.host = room.host_action.ts
        if (room.guest_action?.ts) lastActionTsRef.current.guest = room.guest_action.ts
      }).catch(() => {})
    } else if (mpOpponent) {
      startGameMultiplayer(mpOpponent, mpFirstTurn)
      ss.setItem(MP_SESSION_KEY, JSON.stringify({
        room: mpRoom, role: mpRole, playerId: mpPlayerId,
        firstPlayer: mpFirstPlayer, firstTurn: mpFirstTurn, opponentLayout: mpOpponent,
      }))
      setFirstBanner(true)
      setTimeout(() => setFirstBanner(false), 3000)
    }
  }, [])

  // Subscribe to opponent shots + jam state in multiplayer
  useEffect(() => {
    if (!isMultiplayer) return
    const myJamCol = mpRole === 'host' ? 'host_jam' : 'guest_jam'

    function applyRoomState(room) {
      // Forfeit: checked unconditionally before timestamp gating so reconnects never miss it
      if (room.host_action?.type === 'forfeit' && mpRole !== 'host') { opponentForfeit(); return }
      if (room.guest_action?.type === 'forfeit' && mpRole !== 'guest') { opponentForfeit(); return }

      const shots = room[opponentShotsKey] || []
      while (appliedShotsRef.current < shots.length) {
        const s = shots[appliedShotsRef.current]
        opponentShot(s.col, s.row)
        appliedShotsRef.current++
      }
      if (room[myJamCol] > 0) setMpJamTurns(room[myJamCol])
      // Show notification + apply effects when opponent takes an economy action
      if (room.host_action?.ts > lastActionTsRef.current.host) {
        lastActionTsRef.current.host = room.host_action.ts
        if (mpRole !== 'host') {
          showActionBanner('OPPONENT', room.host_action)
          if (room.host_action.cells?.length) clearShots(room.host_action.cells)
        }
      }
      if (room.guest_action?.ts > lastActionTsRef.current.guest) {
        lastActionTsRef.current.guest = room.guest_action.ts
        if (mpRole !== 'guest') {
          showActionBanner('OPPONENT', room.guest_action)
          if (room.guest_action.cells?.length) clearShots(room.guest_action.cells)
        }
      }
    }

    mpSubRef.current = subscribeToGame(mpRoom.id, applyRoomState)

    // Recovery: refetch + rattraper les tirs manqués quand la tab reprend le focus
    async function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      try { applyRoomState(await getRoomById(mpRoom.id)) } catch (_) {}
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mpSubRef.current?.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Poll room every 3s when stuck waiting for opponent shot (handles tab-switch disconnects)
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing' || turn !== 'waiting') return
    const id = setInterval(async () => {
      try { applyRoomState(await getRoomById(mpRoom.id)) } catch (_) {}
    }, 3000)
    return () => clearInterval(id)
  }, [isMultiplayer, phase, turn])

  // Persist game state to localStorage after each action (multiplayer only)
  useEffect(() => {
    if (!isMultiplayer || !mpRoom || state.phase === 'pregame') return
    ss.setItem(MP_STATE_KEY, JSON.stringify({
      roomId: mpRoom.id,
      appliedShots: appliedShotsRef.current,
      gameState: state,
    }))
  }, [state.round, state.turn, state.phase])

  // Clear saved state when game ends
  useEffect(() => {
    if (state.phase === 'gameover') {
      ss.removeItem(MP_STATE_KEY)
      ss.removeItem(MP_SESSION_KEY)
    }
  }, [state.phase])

  useEffect(() => {
    if (phase === 'pregame' && !isMultiplayer) navigate(ROUTES.home, { replace: true })
  }, [phase, navigate])

  useEffect(() => {
    if (!showQuitMenu) return
    function handleOutside(e) {
      if (quitMenuRef.current && !quitMenuRef.current.contains(e.target)) setShowQuitMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showQuitMenu])

  // After player fires (turn=waiting): layout switch + bot fire (bot mode only)
  useEffect(() => {
    if (phase !== 'playing' || turn !== 'waiting') {
      clearTimeout(layoutTimerRef.current)
      clearTimeout(botTimerRef.current)
      return
    }
    layoutTimerRef.current = setTimeout(() => setUiMode('layout'), LAYOUT_DELAY)
    if (!isMultiplayer) {
      botTimerRef.current = setTimeout(() => botTakeTurn(), BOT_DELAY)
    }
    return () => {
      clearTimeout(layoutTimerRef.current)
      clearTimeout(botTimerRef.current)
    }
  }, [phase, turn, round, setUiMode, botTakeTurn])

  // Cell flash on every shot
  useEffect(() => {
    if (!lastShot) return
    setFlashCell({ col: lastShot.col, row: lastShot.row })
    clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashCell(null), 500)
  }, [lastShot])

  // "YOUR TURN" flash — only when turn transitions from waiting → player
  useEffect(() => {
    if (turn === 'player' && prevTurnRef.current === 'waiting' && phase === 'playing') {
      setShowTurnFlash(true)
      clearTimeout(turnFlashRef.current)
      turnFlashRef.current = setTimeout(() => setShowTurnFlash(false), 1500)
    }
    prevTurnRef.current = turn
  }, [turn, phase])

  // Ability notification
  useEffect(() => {
    if (!state.lastAbility) return
    setAbilityNotif(state.lastAbility)
    clearTimeout(abilityNotifRef.current)
    abilityNotifRef.current = setTimeout(() => {
      setAbilityNotif(null)
      clearLastAbility()
    }, 2200)
  }, [state.lastAbility])

  useEffect(() => {
    if (phase === 'gameover') {
      ss.removeItem(MP_SESSION_KEY)
      ss.removeItem(MP_STATE_KEY)
      const t = setTimeout(() => navigate(ROUTES.result), 2500)
      return () => clearTimeout(t)
    }
  }, [phase, navigate])

  function showActionBanner(who, action) {
    let text
    if (action.type === 'repair')  text = `// ${who} REPAIRED [${action.code.toUpperCase()}]`
    else if (action.type === 'upgrade') text = `// ${who} UPGRADED [${action.code.toUpperCase()}] → ${action.level}`
    else if (action.type === 'buy') text = `// ${who} BOUGHT ${action.code}.exe`
    else return
    setActionBanner(text)
    clearTimeout(actionBannerTimerRef.current)
    actionBannerTimerRef.current = setTimeout(() => setActionBanner(null), 3500)
  }

  function handleRepair(unitId) {
    const unit = player.units[unitId]
    // Cell keys that were hit (opponent must re-target after repair)
    const repairedCells = Object.entries(unit.health).filter(([, v]) => v === 'hit').map(([k]) => k)
    repairUnit(unitId)
    if (isMultiplayer) {
      const action = { type: 'repair', code: unit.code, cells: repairedCells, ts: Date.now() }
      lastActionTsRef.current[mpRole] = action.ts
      showActionBanner('YOU', action)
      submitAction(mpRoom.id, mpRole, action).catch(() => {})
    }
  }

  function handleUpgrade(unitId) {
    const unit = player.units[unitId]
    const nl = nextLevel(unit.level)
    // New cells added by upgrade (opponent's misses there must be cleared)
    const oldKeys = new Set(getUnitCells(unit).map(c => cellKey(c.col, c.row)))
    const upgradedUnit = applyUpgrade(unit)
    const newCells = getUnitCells(upgradedUnit).filter(c => !oldKeys.has(cellKey(c.col, c.row))).map(c => cellKey(c.col, c.row))
    upgradeUnit(unitId)
    if (isMultiplayer) {
      const action = { type: 'upgrade', code: unit.code, level: nl, cells: newCells, ts: Date.now() }
      lastActionTsRef.current[mpRole] = action.ts
      showActionBanner('YOU', action)
      submitAction(mpRoom.id, mpRole, action).catch(() => {})
    }
  }

  function handleBuyAbility(abilityKey) {
    buyAbility(abilityKey)
    if (isMultiplayer) {
      const action = { type: 'buy', code: abilityKey, ts: Date.now() }
      lastActionTsRef.current[mpRole] = action.ts
      showActionBanner('YOU', action)
      submitAction(mpRoom.id, mpRole, action).catch(() => {})
    }
  }

  function triggerShake(level) {
    const cls = level === 'strong' ? 'shake-strong' : 'shake-light'
    setShakeClass(cls)
    setTimeout(() => setShakeClass(''), level === 'strong' ? 600 : 280)
  }

  function handleColSelect(col) {
    if (!isPlayerTurn || !isAttack) return
    setSelectedCol(prev => prev === col ? null : col)
    triggerShake('light')
  }

  function handleRowSelect(row) {
    if (!isPlayerTurn || !isAttack) return
    setSelectedRow(prev => prev === row ? null : row)
    triggerShake('light')
  }

  function fireAt(col, row) {
    if (!isPlayerTurn || !isAttack) return
    const key = `${col},${row}`
    if (player.shots[key]) return
    playerShot(col, row)
    setSelectedCol(null)
    setSelectedRow(null)
    if (isMultiplayer) {
      submitShot(mpRoom.id, mpRole, { col, row }).catch(err => {
        console.error('[submitShot error]', err)
        setShotError('SUPABASE ERROR — ADD MISSING COLUMNS (host_shots, guest_shots)')
      })
      if (mpJamTurns > 0) {
        const newJam = Math.max(0, mpJamTurns - 1)
        setMpJamTurns(newJam)
        submitJam(mpRoom.id, mpRole, newJam).catch(() => {})
      }
    }
  }

  function handleFireBar() {
    if (selectedCol == null || selectedRow == null || !isPlayerTurn) return
    triggerShake('strong')
    setTimeout(() => fireAt(selectedCol, selectedRow), 80)
  }

  function handleCellClick(col, row) {
    if (abilityMode === 'rdr') { useRadar(col, row); setAbilityMode(null); return }
    if (abilityMode === 'msl') {
      const cells = getMissileCells(col, row, mslUnit)
      useMsl(col, row)
      setAbilityMode(null)
      if (isMultiplayer) cells.forEach(c => submitShot(mpRoom.id, mpRole, { col: c.col, row: c.row }))
      return
    }
    // Normal attack: two-step — first click locks column, second locks row
    if (isAttack && isPlayerTurn && !player.shots[`${col},${row}`]) {
      if (selectedCol == null) {
        setSelectedCol(col)
        triggerShake('light')
      } else if (selectedRow == null) {
        setSelectedRow(row)
        triggerShake('light')
      } else {
        // Both locked: restart with new column
        setSelectedCol(col)
        setSelectedRow(null)
        triggerShake('light')
      }
    }
  }

  function handleModeToggle() {
    if (phase !== 'playing') return
    setUiMode(isAttack ? 'layout' : 'attack')
    setAbilityMode(null)
  }

  function handleAbility(key) {
    if (key === 'gltch') {
      useGltch()
      if (isMultiplayer) {
        const gltchUnit = Object.values(player.units).find(u => u.code === 'gltch' && !u.destroyed)
        const level = gltchUnit?.level ?? 'S1'
        const jamTurns = { S1: 1, S2: 2, S3: 3 }[level]
        submitGltch(mpRoom.id, mpRole, jamTurns)
      }
      return
    }
    setAbilityMode(prev => prev === key ? null : key)
  }

  const rdrUnit   = Object.values(player.units).find(u => u.code === 'rdr' && !u.destroyed)
  const gltchUnit = Object.values(player.units).find(u => u.code === 'gltch' && !u.destroyed)
  const mslUnit   = Object.values(player.units).find(u => u.code === 'msl' && !u.destroyed)
  const abilities  = player.abilities
  const jamVisible = player.jamActive > 0
  const mpJammed   = isMultiplayer && mpJamTurns > 0
  const visibleBotShots = (jamVisible || mpJammed) ? {} : bot.shots
  const canUseAbility   = isPlayerTurn && isAttack

  const panelBg     = isAttack ? '#C5FF00' : '#1A1A1A'
  const panelBorder = isAttack ? 'none' : '2px solid #0000FF'
  const panelRadius = 0

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      backgroundColor: '#0A0A0A', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>

      <FlechesSide side="left" />
      <FlechesSide side="right" />

      {/* ROUND + CREDITS top-right */}
      <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
        <RoundCreditsDisplay round={displayRound} credits={player.credits} showCredits={phase === 'playing' || phase === 'gameover'} />
      </div>

      {/* Logo top-left + quit menu */}
      <div ref={quitMenuRef} style={{ position: 'absolute', top: 16, left: 20, zIndex: 20 }}>
        <div
          onClick={() => setShowQuitMenu(p => !p)}
          style={{
            fontFamily: "'Scyborg', 'JetBrains Mono', monospace",
            fontSize: 18, color: '#C5FF00', letterSpacing: '0.04em',
            userSelect: 'none', cursor: 'pointer',
            opacity: showQuitMenu ? 1 : 0.6,
            transition: 'opacity 0.12s',
          }}
        >
          battle.shxp
        </div>
        {showQuitMenu && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            border: '1px solid rgba(197,255,0,0.25)',
          }}>
            <div style={{ backgroundColor: '#0A0A0A', padding: '6px 0', minWidth: 160 }}>
              <button
                onClick={async () => {
                  setShowQuitMenu(false)
                  if (isMultiplayer && mpRoom) {
                    try { await submitAction(mpRoom.id, mpRole, { type: 'forfeit', ts: Date.now() }) } catch (_) {}
                  }
                  ss.removeItem(MP_SESSION_KEY)
                  ss.removeItem(MP_STATE_KEY)
                  reset()
                  navigate(ROUTES.home)
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 16px',
                  background: 'none', border: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  color: '#C5FF00', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(197,255,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                QUIT
              </button>
              <button
                onClick={() => setShowQuitMenu(false)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 16px',
                  background: 'none', border: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  color: 'rgba(197,255,0,0.35)', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(197,255,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                ANNULER
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Board area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className={shakeClass} style={{ position: 'relative' }}>
        {/* Action notification — appears above the board panel */}
        {actionBanner && (
          <div style={{
            position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#C5FF00', color: '#0A0A0A',
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
            padding: '7px 18px', whiteSpace: 'nowrap', zIndex: 20,
          }}>
            {actionBanner}
          </div>
        )}
        <CrossStrip side="left" />
        <CrossStrip side="right" />

        <div
          onContextMenu={e => { e.preventDefault(); setSelectedCol(null); setSelectedRow(null) }}
          style={{
          backgroundColor: panelBg,
          border: panelBorder,
          borderRadius: panelRadius,
          padding: 14,
          position: 'relative',
        }}>
          {/* Corner decorations */}
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

          {/* Blue turn indicator above grid */}
          <TurnIndicator phase={phase} turn={turn} uiMode={uiMode} abilityMode={abilityMode} abilityNotif={abilityNotif} />

          <GameGrid
            mode={uiMode}
            units={isAttack ? bot.units : player.units}
            shots={isAttack ? player.shots : visibleBotShots}
            onCellClick={handleCellClick}
            onUnitContextMenu={(unit, pos) => setCtxMenu({ unit, position: pos })}
            canInteract={(isPlayerTurn && isAttack) || !!abilityMode}
            cellSize={CELL_SIZE}
            abilityMode={isAttack ? abilityMode : null}
            abilityUnit={abilityMode === 'rdr' ? rdrUnit : abilityMode === 'msl' ? mslUnit : null}
            radarRevealed={isAttack ? player.radarRevealed : {}}
            flashCell={flashCell}
            selectedCol={isAttack && isPlayerTurn ? selectedCol : null}
            selectedRow={isAttack && isPlayerTurn ? selectedRow : null}
          />

          {/* Abilities row (attack mode) */}
          {isAttack && (
            <div style={{
              display: 'flex', justifyContent: 'space-around',
              marginTop: 10, paddingTop: 8,
              borderTop: '1px solid rgba(0,0,0,0.15)',
            }}>
              <AbilityBtn label="rdr.exe"   active={abilityMode==='rdr'} used={abilities.rdr||!rdrUnit}    disabled={!canUseAbility||abilities.rdr||!rdrUnit}    onClick={()=>handleAbility('rdr')} />
              <AbilityBtn label="gltch.exe" active={false}               used={abilities.gltch||!gltchUnit} disabled={!canUseAbility||abilities.gltch||!gltchUnit} onClick={()=>handleAbility('gltch')} />
              <AbilityBtn label="msl.exe"   active={abilityMode==='msl'} used={abilities.msl||!mslUnit}    disabled={!canUseAbility||abilities.msl||!mslUnit}    onClick={()=>handleAbility('msl')} />
            </div>
          )}

          {/* GLTCH.EXE jam overlay — layout mode only, hides shot history */}
          {mpJammed && !isAttack && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 30,
              backgroundColor: 'rgba(10,10,10,0.88)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: "'PPFraktionMono','JetBrains Mono',monospace",
                fontSize: 64, fontWeight: 900, color: '#7B2CBF',
                letterSpacing: '0.12em', lineHeight: 1,
              }}>
                ERROR
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 11, fontWeight: 700, color: '#7B2CBF', letterSpacing: '0.2em',
                }}>
                  OPPONENT USES GLTCH.EXE
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 11, fontWeight: 700, color: '#7B2CBF', letterSpacing: '0.2em',
                }}>
                  FOR {mpJamTurns} ROUND{mpJamTurns > 1 ? 'S' : ''}
                </div>
              </div>
            </div>
          )}

          {/* "YOUR TURN" flash — appears when bot finishes its turn */}
          {showTurnFlash && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', zIndex: 40,
            }}>
              <div className="turn-flash" style={{
                backgroundColor: '#2c00ff',
                color: 'white',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13, fontWeight: 700,
                letterSpacing: '0.2em',
                padding: '10px 26px',
              }}>
                // YOUR TURN
              </div>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        {phase === 'playing' && (
          <ModeToggleBtn
            label={isAttack ? 'layout' : 'attack.exe'}
            onClick={handleModeToggle}
          />
        )}
        </div>{/* end shake wrapper */}

        {/* Fire bar — below board, only in attack mode */}
        {isAttack && phase === 'playing' && (
          <FireBar
            targetName={
              selectedCol != null && selectedRow != null
                ? cellName(selectedCol, selectedRow)
                : selectedCol != null ? `?${COL_LABELS[selectedCol]}`
                : selectedRow != null ? `${ROW_LABELS[selectedRow]}?`
                : '??'
            }
            canFire={selectedCol != null && selectedRow != null && isPlayerTurn && !player.shots[`${selectedCol},${selectedRow}`]}
            waiting={!isPlayerTurn}
            onFire={handleFireBar}
          />
        )}
        </div>{/* end column wrapper */}

      {/* First-player banner */}
      {firstBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', justifyContent: 'center', paddingTop: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            backgroundColor: mpFirstTurn === 'player' ? '#C5FF00' : '#2c00ff',
            color: mpFirstTurn === 'player' ? '#0A0A0A' : '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: '0.2em',
            padding: '10px 28px',
          }}>
            {mpFirstTurn === 'player' ? '// YOU GO FIRST' : '// OPPONENT GOES FIRST'}
          </div>
        </div>
      )}

      {/* Shot error — visible when Supabase columns are missing */}
      {shotError && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#FF1493', color: '#fff',
          fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
          fontWeight: 700, letterSpacing: '0.15em',
          padding: '6px 14px', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          // {shotError}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 20, alignItems: 'center', zIndex: 5,
      }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#C5FF00', opacity: 0.25, letterSpacing: '0.1em' }}>
          {isMultiplayer ? `MULTIPLAYER / ${mpRole?.toUpperCase()}` : `BOT / ${bot.difficulty.toUpperCase()}`}
        </div>
        {jamVisible && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#7B2CBF', letterSpacing: '0.12em', fontWeight: 700 }}>
            JAMMER {player.jamActive}T
          </div>
        )}
        {phase === 'gameover' && (
          <button
            onClick={() => { ss.removeItem(MP_SESSION_KEY); ss.removeItem(MP_STATE_KEY); reset(); navigate(ROUTES.home) }}
            style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
              color: '#C5FF00', background: 'none', border: '1px solid #C5FF00',
              padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.1em',
            }}
          >
            back to menu
          </button>
        )}
      </div>

      <HitMissFlash lastShot={lastShot} onDone={clearLastShot} />

      {ctxMenu && (
        <UnitContextMenu
          unit={ctxMenu.unit}
          credits={player.credits}
          abilities={player.abilities}
          position={ctxMenu.position}
          onRepair={handleRepair}
          onUpgrade={handleUpgrade}
          onBuyAbility={handleBuyAbility}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <style>{`
        @keyframes shakeLight {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-5px)}
          30%{transform:translateX(5px)}
          45%{transform:translateX(-4px)}
          60%{transform:translateX(4px)}
          75%{transform:translateX(-2px)}
          90%{transform:translateX(2px)}
        }
        @keyframes shakeStrong {
          0%,100%{transform:translate(0,0)}
          8%{transform:translate(-12px,-6px)}
          16%{transform:translate(12px,6px)}
          24%{transform:translate(-12px,6px)}
          32%{transform:translate(12px,-6px)}
          40%{transform:translate(-9px,5px)}
          48%{transform:translate(9px,-5px)}
          56%{transform:translate(-6px,3px)}
          64%{transform:translate(6px,-3px)}
          72%{transform:translate(-3px,2px)}
          84%{transform:translate(3px,-2px)}
          92%{transform:translate(-1px,1px)}
        }
        .shake-light{animation:shakeLight 0.28s ease-in-out}
        .shake-strong{animation:shakeStrong 0.58s ease-in-out}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}
      `}</style>
    </div>
  )
}
