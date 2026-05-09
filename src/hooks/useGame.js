import { useReducer, useCallback, useEffect } from 'react'
import {
  createPlayerUnits, autoplaceUnits, autoplacePregameUnits,
  resolveShot, computeCreditChange,
  isDefeated, destroyedGenCount, cellKey,
  getRadarCells, getMissileCells,
  repairCost, applyRepair, upgradeCost, applyUpgrade,
} from '../lib/gameEngine.js'
import { ECONOMY } from '../lib/constants.js'

function capCredits(n) { return Math.min(n, ECONOMY.maxCredits) }
import { botChooseShot, botUpdateAI, botDecideAbility, botDecideUpgrade } from '../lib/botLogic.js'

// ─── Initial state ────────────────────────────────────────────────────────────

export function makeInitialState(difficulty = 'easy') {
  return {
    phase: 'pregame',
    round: 0,
    turn: 'player',
    uiMode: 'layout',
    winner: null,
    forfeitWin: false,
    lastShot: null,    // { by:'player'|'bot', result:'hit'|'miss' } for overlay
    lastAbility: null, // { by:'player'|'bot', ability:'rdr'|'gltch'|'msl' } for notification

    player: {
      credits: 2,
      units: createPlayerUnits(),
      shots: {},
      skipTurns: 0,
      abilities: { rdr: false, gltch: false, msl: false }, // used flags
      jamActive: 0,     // turns of jammer still active (hides bot shots from player)
      radarRevealed: {}, // "col,row" → true for radar-revealed bot cells
    },

    bot: {
      difficulty,
      credits: 2,
      units: {},
      shots: {},
      skipTurns: 0,
      hunts: [],
      hits: [],
      abilities: { rdr: false, gltch: false, msl: false },
    },
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'SET_DIFFICULTY':
      return makeInitialState(action.difficulty)

    case 'PLACE_UNIT': {
      const { unitId, col, row } = action
      return {
        ...state,
        player: {
          ...state.player,
          units: { ...state.player.units, [unitId]: { ...state.player.units[unitId], col, row } },
        },
      }
    }

    case 'PICKUP_UNIT':
      return {
        ...state,
        player: {
          ...state.player,
          units: {
            ...state.player.units,
            [action.unitId]: { ...state.player.units[action.unitId], col: null, row: null },
          },
        },
      }

    case 'ROTATE_UNIT': {
      const u = state.player.units[action.unitId]
      return {
        ...state,
        player: {
          ...state.player,
          units: {
            ...state.player.units,
            [action.unitId]: { ...u, rotation: ((u.rotation ?? 0) + 1) % 4 },
          },
        },
      }
    }

    case 'START_GAME':
      return {
        ...state,
        phase: 'playing',
        round: 1,
        turn: 'player',
        uiMode: 'attack',
        bot: { ...state.bot, units: autoplaceUnits() },
      }

    case 'START_GAME_MULTIPLAYER': {
      const fresh = makeInitialState()
      return {
        ...fresh,
        phase: 'playing',
        round: 1,
        turn: action.firstTurn,
        uiMode: action.firstTurn === 'player' ? 'attack' : 'layout',
        player: { ...fresh.player, units: state.player.units },
        bot: { ...fresh.bot, units: action.opponentUnits },
      }
    }

    case 'OPPONENT_SHOT': {
      if (state.phase === 'gameover') return state
      const { col, row } = action
      const key = cellKey(col, row)
      if (state.bot.shots[key]) return state

      const shot = resolveShot(col, row, state.player.units)
      const newPlayerUnits = shot.updatedUnit
        ? { ...state.player.units, [shot.unitId]: shot.updatedUnit }
        : state.player.units
      const newBotShots = { ...state.bot.shots, [key]: { result: shot.result, unitId: shot.unitId } }
      const lastShot = { by: 'bot', result: shot.result, col, row }

      if (shot.destroyed && isDefeated(newPlayerUnits)) {
        return {
          ...state,
          phase: 'gameover', winner: 'bot',
          lastShot,
          player: { ...state.player, units: newPlayerUnits },
          bot: { ...state.bot, shots: newBotShots },
        }
      }
      return {
        ...state,
        round: state.round + 1,
        turn: shot.result === 'hit' ? 'waiting' : 'player',
        lastShot,
        player: {
          ...state.player,
          units: newPlayerUnits,
          credits: capCredits(state.player.credits + ECONOMY.creditPerRound),
        },
        bot: {
          ...state.bot,
          shots: newBotShots,
          credits: capCredits(state.bot.credits + ECONOMY.creditPerRound),
        },
      }
    }

    case 'SET_UI_MODE':
      return { ...state, uiMode: action.mode }

    case 'PLAYER_SHOT': {
      const { col, row } = action
      const key = cellKey(col, row)
      if (state.player.shots[key] || state.turn !== 'player') return state

      const shot = resolveShot(col, row, state.bot.units)
      const newBotUnits = shot.updatedUnit
        ? { ...state.bot.units, [shot.unitId]: shot.updatedUnit }
        : state.bot.units

      const newShots = { ...state.player.shots, [key]: { result: shot.result, unitId: shot.unitId } }
      const newCredits = capCredits(state.player.credits + computeCreditChange(shot))
      const lastShot = { by: 'player', result: shot.result, col, row }

      if (shot.destroyed && isDefeated(newBotUnits)) {
        return {
          ...state,
          phase: 'gameover', winner: 'player',
          lastShot,
          player: { ...state.player, credits: newCredits, shots: newShots },
          bot: { ...state.bot, units: newBotUnits },
        }
      }

      // Hit = extra turn; miss = hand over to bot
      return {
        ...state,
        turn: shot.result === 'hit' ? 'player' : 'waiting',
        lastShot,
        player: { ...state.player, credits: newCredits, shots: newShots },
        bot: { ...state.bot, units: newBotUnits },
      }
    }

    case 'BOT_SHOT': {
      if (state.phase === 'gameover') return state
      const { col, row } = action
      const key = cellKey(col, row)
      if (state.bot.shots[key]) return state // already shot (e.g. by MSL)

      const shot = resolveShot(col, row, state.player.units)
      const newPlayerUnits = shot.updatedUnit
        ? { ...state.player.units, [shot.unitId]: shot.updatedUnit }
        : state.player.units

      const newBotShots = { ...state.bot.shots, [key]: { result: shot.result, unitId: shot.unitId } }
      const aiUpdate = botUpdateAI(state.bot, col, row, shot.result, shot.destroyed)
      const lastShot = { by: 'bot', result: shot.result, col, row }

      if (shot.destroyed && isDefeated(newPlayerUnits)) {
        return {
          ...state,
          phase: 'gameover', winner: 'bot',
          lastShot,
          player: { ...state.player, units: newPlayerUnits },
          bot: { ...state.bot, credits: capCredits(state.bot.credits + computeCreditChange(shot)), shots: newBotShots, ...aiUpdate },
        }
      }

      const prevGens = destroyedGenCount(state.player.units)
      const newGens  = destroyedGenCount(newPlayerUnits)
      const newJam   = Math.max(0, state.player.jamActive - 1)

      return {
        ...state,
        round: state.round + 1,
        turn: shot.result === 'hit' ? 'waiting' : 'player',
        lastShot,
        player: {
          ...state.player,
          units: newPlayerUnits,
          skipTurns: state.player.skipTurns + (newGens - prevGens),
          jamActive: newJam,
          credits: capCredits(state.player.credits + ECONOMY.creditPerRound),
        },
        bot: {
          ...state.bot,
          credits: capCredits(state.bot.credits + computeCreditChange(shot) + ECONOMY.creditPerRound),
          shots: newBotShots,
          ...aiUpdate,
        },
      }
    }

    // ─── Ability: rdr.exe (radar reveal) ─────────────────────────────────────
    case 'USE_RADAR': {
      const { col, row } = action
      const rdrUnit = Object.values(state.player.units).find(u => u.code === 'rdr' && !u.destroyed)
      const cells = getRadarCells(col, row, rdrUnit)
      const newRevealed = { ...state.player.radarRevealed }
      cells.forEach(c => { newRevealed[cellKey(c.col, c.row)] = true })
      return {
        ...state,
        lastAbility: { by: 'player', ability: 'rdr' },
        player: {
          ...state.player,
          abilities: { ...state.player.abilities, rdr: true },
          radarRevealed: newRevealed,
        },
      }
    }

    // ─── Ability: gltch.exe (jammer) ─────────────────────────────────────────
    case 'USE_GLTCH': {
      const gltchUnit = Object.values(state.player.units).find(u => u.code === 'gltch' && !u.destroyed)
      const level = gltchUnit?.level ?? 'S1'
      const jamTurns = { S1: 1, S2: 2, S3: 3 }[level]
      return {
        ...state,
        lastAbility: { by: 'player', ability: 'gltch' },
        player: {
          ...state.player,
          abilities: { ...state.player.abilities, gltch: true },
          jamActive: jamTurns,
        },
      }
    }

    // ─── Ability: msl.exe (area missile) ─────────────────────────────────────
    case 'USE_MSL': {
      const { col, row } = action
      const mslUnit = Object.values(state.player.units).find(u => u.code === 'msl' && !u.destroyed)
      const cells = getMissileCells(col, row, mslUnit)

      let newBotUnits = { ...state.bot.units }
      let newShots = { ...state.player.shots }
      let earnedCredits = 0

      for (const c of cells) {
        const k = cellKey(c.col, c.row)
        if (newShots[k]) continue
        const shot = resolveShot(c.col, c.row, newBotUnits)
        newShots[k] = { result: shot.result, unitId: shot.unitId }
        earnedCredits += computeCreditChange(shot)
        if (shot.updatedUnit) newBotUnits[shot.unitId] = shot.updatedUnit
      }

      const defeated = isDefeated(newBotUnits)
      // uiMode not changed — GamePage timer handles layout switch
      return {
        ...state,
        lastAbility: { by: 'player', ability: 'msl' },
        phase: defeated ? 'gameover' : state.phase,
        winner: defeated ? 'player' : state.winner,
        turn: defeated ? state.turn : 'waiting',
        player: {
          ...state.player,
          shots: newShots,
          credits: capCredits(state.player.credits + earnedCredits),
          abilities: { ...state.player.abilities, msl: true },
        },
        bot: { ...state.bot, units: newBotUnits },
      }
    }

    // ─── Repair unit ──────────────────────────────────────────────────────────
    case 'REPAIR_UNIT': {
      const unit = state.player.units[action.unitId]
      const cost = repairCost(unit)
      if (state.player.credits < cost) return state
      return {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - cost,
          units: { ...state.player.units, [action.unitId]: applyRepair(unit) },
        },
      }
    }

    // ─── Upgrade unit ─────────────────────────────────────────────────────────
    case 'UPGRADE_UNIT': {
      const unit = state.player.units[action.unitId]
      const cost = upgradeCost(unit)
      if (cost === Infinity || state.player.credits < cost) return state
      return {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - cost,
          units: { ...state.player.units, [action.unitId]: applyUpgrade(unit) },
        },
      }
    }

    // ─── Bot: jammer ─────────────────────────────────────────────────────────
    case 'BOT_USE_GLTCH': {
      const gltchUnit = Object.values(state.bot.units).find(u => u.code === 'gltch' && !u.destroyed)
      const level = gltchUnit?.level ?? 'S1'
      const jamTurns = { S1: 1, S2: 2, S3: 3 }[level] ?? 1
      return {
        ...state,
        lastAbility: { by: 'bot', ability: 'gltch' },
        player: { ...state.player, jamActive: state.player.jamActive + jamTurns },
        bot: { ...state.bot, abilities: { ...state.bot.abilities, gltch: true } },
      }
    }

    // ─── Bot: missile ─────────────────────────────────────────────────────────
    case 'BOT_USE_MSL': {
      if (state.phase === 'gameover') return state
      const { col, row } = action
      const mslUnit = Object.values(state.bot.units).find(u => u.code === 'msl' && !u.destroyed)
      const cells = getMissileCells(col, row, mslUnit)

      let newPlayerUnits = { ...state.player.units }
      let newBotShots = { ...state.bot.shots }
      let earned = 0

      for (const c of cells) {
        const k = cellKey(c.col, c.row)
        if (newBotShots[k]) continue
        const shot = resolveShot(c.col, c.row, newPlayerUnits)
        newBotShots[k] = { result: shot.result, unitId: shot.unitId }
        earned += computeCreditChange(shot)
        if (shot.updatedUnit) newPlayerUnits[shot.unitId] = shot.updatedUnit
      }

      const defeated = isDefeated(newPlayerUnits)
      return {
        ...state,
        lastAbility: { by: 'bot', ability: 'msl' },
        phase: defeated ? 'gameover' : state.phase,
        winner: defeated ? 'bot' : state.winner,
        player: { ...state.player, units: newPlayerUnits },
        bot: {
          ...state.bot,
          shots: newBotShots,
          credits: capCredits(state.bot.credits + earned),
          abilities: { ...state.bot.abilities, msl: true },
        },
      }
    }

    // ─── Bot: upgrade ─────────────────────────────────────────────────────────
    case 'BOT_UPGRADE_UNIT': {
      const unit = state.bot.units[action.unitId]
      if (!unit) return state
      const cost = upgradeCost(unit)
      if (cost === Infinity || state.bot.credits < cost) return state
      return {
        ...state,
        bot: {
          ...state.bot,
          credits: state.bot.credits - cost,
          units: { ...state.bot.units, [action.unitId]: applyUpgrade(unit) },
        },
      }
    }

    case 'OPPONENT_FORFEIT':
      if (state.phase === 'gameover') return state
      return { ...state, phase: 'gameover', winner: 'player', forfeitWin: true }

    case 'CLEAR_LAST_SHOT':
      return { ...state, lastShot: null }

    case 'CLEAR_LAST_ABILITY':
      return { ...state, lastAbility: null }

    // ─── Repurchase ability ───────────────────────────────────────────────────
    case 'BUY_ABILITY': {
      const { abilityKey } = action
      const cost = ECONOMY.abilityCost
      if (!state.player.abilities[abilityKey]) return state   // already available
      if (state.player.credits < cost) return state
      return {
        ...state,
        player: {
          ...state.player,
          credits: state.player.credits - cost,
          abilities: { ...state.player.abilities, [abilityKey]: false },
        },
      }
    }

    case 'AUTOPLACE_UNITS':
      return {
        ...state,
        player: { ...state.player, units: autoplacePregameUnits(state.player.units) },
      }

    case 'RESTORE_STATE':
      return action.state

    case 'RESET':
      return makeInitialState(state.bot.difficulty)

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGame(difficulty = 'easy') {
  const [state, dispatch] = useReducer(reducer, undefined, () => makeInitialState(difficulty))

  useEffect(() => {
    if (state.bot.difficulty !== difficulty && state.phase === 'pregame') {
      dispatch({ type: 'SET_DIFFICULTY', difficulty })
    }
  }, [difficulty, state.bot.difficulty, state.phase])

  const placeUnit    = useCallback((unitId, col, row) => dispatch({ type: 'PLACE_UNIT', unitId, col, row }), [])
  const pickupUnit   = useCallback((unitId)            => dispatch({ type: 'PICKUP_UNIT', unitId }), [])
  const rotateUnit   = useCallback((unitId)            => dispatch({ type: 'ROTATE_UNIT', unitId }), [])
  const startGame             = useCallback(()                         => dispatch({ type: 'START_GAME' }), [])
  const startGameMultiplayer  = useCallback((opponentUnits, firstTurn) => dispatch({ type: 'START_GAME_MULTIPLAYER', opponentUnits, firstTurn }), [])
  const opponentShot          = useCallback((col, row)                 => dispatch({ type: 'OPPONENT_SHOT', col, row }), [])
  const opponentForfeit       = useCallback(()                         => dispatch({ type: 'OPPONENT_FORFEIT' }), [])
  const setUiMode    = useCallback((mode)              => dispatch({ type: 'SET_UI_MODE', mode }), [])
  const playerShot   = useCallback((col, row)          => dispatch({ type: 'PLAYER_SHOT', col, row }), [])
  const repairUnit   = useCallback((unitId)            => dispatch({ type: 'REPAIR_UNIT', unitId }), [])
  const upgradeUnit  = useCallback((unitId)            => dispatch({ type: 'UPGRADE_UNIT', unitId }), [])
  const useRadar     = useCallback((col, row)          => dispatch({ type: 'USE_RADAR', col, row }), [])
  const useGltch     = useCallback(()                  => dispatch({ type: 'USE_GLTCH' }), [])
  const useMsl       = useCallback((col, row)          => dispatch({ type: 'USE_MSL', col, row }), [])
  const clearLastShot    = useCallback(() => dispatch({ type: 'CLEAR_LAST_SHOT' }), [])
  const clearLastAbility = useCallback(() => dispatch({ type: 'CLEAR_LAST_ABILITY' }), [])
  const buyAbility       = useCallback((abilityKey) => dispatch({ type: 'BUY_ABILITY', abilityKey }), [])
  const autoPlace    = useCallback(()  => dispatch({ type: 'AUTOPLACE_UNITS' }), [])
  const restoreState = useCallback((s) => dispatch({ type: 'RESTORE_STATE', state: s }), [])
  const reset        = useCallback(()  => dispatch({ type: 'RESET' }), [])

  const botTakeTurn = useCallback(() => {
    // Upgrade one unit if affordable
    const upgrade = botDecideUpgrade(state.bot)
    if (upgrade) dispatch({ type: 'BOT_UPGRADE_UNIT', unitId: upgrade.unitId })

    // Use ability if conditions met
    const ability = botDecideAbility(state.bot.difficulty, state.bot)
    if (ability?.type === 'gltch') dispatch({ type: 'BOT_USE_GLTCH' })
    else if (ability?.type === 'msl') dispatch({ type: 'BOT_USE_MSL', col: ability.col, row: ability.row })

    // Regular shot
    const target = botChooseShot(state.bot.difficulty, state.bot)
    if (target) dispatch({ type: 'BOT_SHOT', col: target.col, row: target.row })
  }, [state.bot])

  return {
    state, placeUnit, pickupUnit, rotateUnit, startGame, startGameMultiplayer, restoreState,
    setUiMode, playerShot, opponentShot, opponentForfeit, botTakeTurn, repairUnit, upgradeUnit,
    useRadar, useGltch, useMsl, clearLastShot, clearLastAbility, buyAbility, autoPlace, reset,
  }
}
