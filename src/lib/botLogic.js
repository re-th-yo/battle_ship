import { GRID_COLS, GRID_ROWS } from './constants.js'
import { cellKey, upgradeCost } from './gameEngine.js'

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function allCells() {
  const cells = []
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++)
      cells.push({ col, row })
  return cells
}

function getUnshot(shots) {
  return allCells().filter(c => !shots[cellKey(c.col, c.row)])
}

function pickRandom(arr) {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function adjacent(col, row, shots) {
  return [
    { col: col - 1, row },
    { col: col + 1, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ].filter(c =>
    c.col >= 0 && c.col < GRID_COLS &&
    c.row >= 0 && c.row < GRID_ROWS &&
    !shots[cellKey(c.col, c.row)]
  )
}

// Tente de prolonger une ligne de hits (pour le mode difficile)
function alignedTarget(hits, shots) {
  if (hits.length < 2) return null

  const last = hits[hits.length - 1]
  const prev = hits[hits.length - 2]

  // Alignement horizontal
  if (last.row === prev.row) {
    const cols = hits.map(h => h.col)
    const minCol = Math.min(...cols)
    const maxCol = Math.max(...cols)
    const row = last.row
    if (minCol - 1 >= 0 && !shots[cellKey(minCol - 1, row)])
      return { col: minCol - 1, row }
    if (maxCol + 1 < GRID_COLS && !shots[cellKey(maxCol + 1, row)])
      return { col: maxCol + 1, row }
  }

  // Alignement vertical
  if (last.col === prev.col) {
    const rows = hits.map(h => h.row)
    const minRow = Math.min(...rows)
    const maxRow = Math.max(...rows)
    const col = last.col
    if (minRow - 1 >= 0 && !shots[cellKey(col, minRow - 1)])
      return { col, row: minRow - 1 }
    if (maxRow + 1 < GRID_ROWS && !shots[cellKey(col, maxRow + 1)])
      return { col, row: maxRow + 1 }
  }

  return null
}

// ─── Choisir la case à tirer ─────────────────────────────────────────────────

// difficulty : 'easy' | 'medium' | 'hard'
// botState   : { shots: {}, hunts: [], hits: [] }
// Retourne { col, row }
export function botChooseShot(difficulty, botState) {
  const { shots = {}, hunts = [], hits = [] } = botState
  const unshot = getUnshot(shots)

  if (unshot.length === 0) return null // grille entièrement jouée (ne devrait pas arriver)

  if (difficulty === 'easy') {
    return pickRandom(unshot)
  }

  if (difficulty === 'medium') {
    const validHunts = hunts.filter(c => !shots[cellKey(c.col, c.row)])
    if (validHunts.length > 0) return validHunts[0]
    return pickRandom(unshot)
  }

  // hard : alignement > chasse > aléatoire
  if (difficulty === 'hard') {
    const aligned = alignedTarget(hits, shots)
    if (aligned) return aligned
    const validHunts = hunts.filter(c => !shots[cellKey(c.col, c.row)])
    if (validHunts.length > 0) return validHunts[0]
    return pickRandom(unshot)
  }

  return pickRandom(unshot)
}

// ─── Bot: décision d'utiliser une capacité ───────────────────────────────────

// Returns null | { type:'gltch' } | { type:'msl', col, row }
export function botDecideAbility(difficulty, botState) {
  const { hunts = [], hits = [], abilities = {}, units = {} } = botState

  // gltch: jam player view — trigger when bot has confirmed hits to exploit
  if (!abilities.gltch) {
    const gltchUnit = Object.values(units).find(u => u.code === 'gltch' && !u.destroyed)
    if (gltchUnit) {
      const threshold = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 2
      if (hits.length >= threshold) return { type: 'gltch' }
    }
  }

  // msl: area strike — use when hunt queue has a confirmed adjacent target
  if (!abilities.msl && hunts.length > 0) {
    const mslUnit = Object.values(units).find(u => u.code === 'msl' && !u.destroyed)
    if (mslUnit) return { type: 'msl', col: hunts[0].col, row: hunts[0].row }
  }

  return null
}

// ─── Bot: décision d'upgrade ─────────────────────────────────────────────────

// Returns null | { unitId }
export function botDecideUpgrade(botState) {
  const { credits = 0, units = {} } = botState
  const priority = ['msl', 'shld', 'gltch', 'trll', 'rdr']
  for (const code of priority) {
    const unit = Object.values(units).find(u => u.code === code && !u.destroyed)
    if (!unit) continue
    const cost = upgradeCost(unit)
    if (cost !== Infinity && credits >= cost) return { unitId: unit.id }
  }
  return null
}

// ─── Mettre à jour l'état IA après un tir ────────────────────────────────────

// Retourne { hunts, hits } mis à jour
export function botUpdateAI(botState, col, row, result, destroyed) {
  let { hunts = [], hits = [] } = botState

  if (result === 'hit') {
    if (destroyed) {
      // Unité coulée : on réinitialise la chasse
      hunts = []
      hits = []
    } else {
      // Nouveau hit : ajouter les cases adjacentes à la file
      hits = [...hits, { col, row }]
      const adj = adjacent(col, row, botState.shots)
      // Dédoublonnage
      const existingKeys = new Set(hunts.map(c => cellKey(c.col, c.row)))
      for (const c of adj) {
        if (!existingKeys.has(cellKey(c.col, c.row))) {
          hunts = [...hunts, c]
          existingKeys.add(cellKey(c.col, c.row))
        }
      }
    }
  } else {
    // Raté : on retire cette case de la file de chasse si elle y était
    hunts = hunts.filter(c => !(c.col === col && c.row === row))
  }

  return { hunts, hits }
}
