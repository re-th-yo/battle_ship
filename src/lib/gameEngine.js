import { UNIT_DEFINITIONS, GRID_COLS, GRID_ROWS, ECONOMY, ABILITIES } from './constants.js'

// ─── Helpers géométriques ───────────────────────────────────────────────────

export function cellKey(col, row) { return `${col},${row}` }
export function parseKey(key) {
  const [col, row] = key.split(',').map(Number)
  return { col, row }
}

// Rotate cell offsets 90° clockwise once and re-normalize to (0,0) origin
function rotateCells90(cells) {
  const rotated = cells.map(([dc, dr]) => [dr, -dc])
  const minCol = Math.min(...rotated.map(([dc]) => dc))
  const minRow = Math.min(...rotated.map(([, dr]) => dr))
  return rotated.map(([dc, dr]) => [dc - minCol, dr - minRow])
}

// Rotate cell offsets by (rotation % 4) × 90° clockwise
export function rotateCells(cells, rotation = 0) {
  let result = cells
  const n = ((rotation % 4) + 4) % 4
  for (let i = 0; i < n; i++) result = rotateCells90(result)
  return result
}

// Absolute positions of all cells of a placed unit, respecting rotation
export function getUnitCells(unit) {
  if (unit.col == null || unit.row == null) return []
  const def = UNIT_DEFINITIONS[unit.code]
  const baseCells = def.levels[unit.level].cells
  const cells = rotateCells(baseCells, unit.rotation ?? 0)
  return cells.map(([dc, dr]) => ({ col: unit.col + dc, row: unit.row + dr }))
}

// Like getUnitCells but at a specific level (used for S3 ghost rendering)
export function getUnitCellsAtLevel(unit, level) {
  if (unit.col == null || unit.row == null) return []
  const def = UNIT_DEFINITIONS[unit.code]
  const baseCells = (def.levels[level] ?? def.levels[unit.level]).cells
  const cells = rotateCells(baseCells, unit.rotation ?? 0)
  return cells.map(([dc, dr]) => ({ col: unit.col + dc, row: unit.row + dr }))
}

// Highest available level for a unit (S3 → S2 → S1)
export function getMaxLevel(code) {
  const lvls = UNIT_DEFINITIONS[code].levels
  return lvls.S3 ? 'S3' : lvls.S2 ? 'S2' : 'S1'
}

export function isInBounds(cells) {
  return cells.every(c => c.col >= 0 && c.col < GRID_COLS && c.row >= 0 && c.row < GRID_ROWS)
}

export function hasCollision(cells1, cells2) {
  const set = new Set(cells1.map(c => cellKey(c.col, c.row)))
  return cells2.some(c => set.has(cellKey(c.col, c.row)))
}

// Uses getUnitCells so rotation is always respected
export function canPlace(unit, col, row, allUnits) {
  const tempUnit = { ...unit, col, row }
  const testCells = getUnitCells(tempUnit)
  if (!isInBounds(testCells)) return false
  for (const other of Object.values(allUnits)) {
    if (other.id === unit.id) continue
    if (other.col == null) continue
    if (hasCollision(testCells, getUnitCells(other))) return false
  }
  return true
}

// Pregame placement: checks S3 max-footprint so upgrades never cause overlaps
export function canPlacePregame(unit, col, row, allUnits) {
  const tempUnit = { ...unit, col, row }
  const s1Cells  = getUnitCells(tempUnit)
  const maxCells = getUnitCellsAtLevel(tempUnit, getMaxLevel(unit.code))
  if (!isInBounds(s1Cells) || !isInBounds(maxCells)) return false
  for (const other of Object.values(allUnits)) {
    if (other.id === unit.id) continue
    if (other.col == null) continue
    const otherMax = getUnitCellsAtLevel(other, getMaxLevel(other.code))
    if (hasCollision(maxCells, otherMax)) return false
  }
  return true
}

// ─── Création d'état ─────────────────────────────────────────────────────────

function makeUnit(id, code) {
  return { id, code, level: 'S1', col: null, row: null, health: {}, destroyed: false, rotation: 0 }
}

export function createPlayerUnits() {
  return {
    gn_01: makeUnit('gn_01', 'gn'),
    gn_02: makeUnit('gn_02', 'gn'),
    rdr:   makeUnit('rdr',   'rdr'),
    trll:  makeUnit('trll',  'trll'),
    shld:  makeUnit('shld',  'shld'),
    gltch: makeUnit('gltch', 'gltch'),
    msl:   makeUnit('msl',   'msl'),
  }
}

// Place aléatoirement toutes les unités du bot sur la grille
export function autoplaceUnits() {
  const units = createPlayerUnits()
  const placed = {}

  for (const id of Object.keys(units)) {
    let success = false
    let tries = 0
    while (!success && tries < 500) {
      const col = Math.floor(Math.random() * GRID_COLS)
      const row = Math.floor(Math.random() * GRID_ROWS)
      if (canPlace(units[id], col, row, placed)) {
        units[id] = { ...units[id], col, row }
        placed[id] = units[id]
        success = true
      }
      tries++
    }
    // fallback scan si random échoue
    if (!success) {
      outer: for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (canPlace(units[id], c, r, placed)) {
            units[id] = { ...units[id], col: c, row: r }
            placed[id] = units[id]
            break outer
          }
        }
      }
    }
  }
  return units
}

// Place aléatoirement les unités existantes du joueur (pour le bouton RANDOM en pregame)
export function autoplacePregameUnits(units) {
  const placed = {}
  for (const [id, u] of Object.entries(units)) {
    const base = { ...u, col: null, row: null }
    let success = false
    let tries = 0
    while (!success && tries < 500) {
      const col = Math.floor(Math.random() * GRID_COLS)
      const row = Math.floor(Math.random() * GRID_ROWS)
      const rotation = Math.floor(Math.random() * 4)
      const test = { ...base, col, row, rotation }
      if (canPlacePregame(test, col, row, placed)) {
        placed[id] = test
        success = true
      }
      tries++
    }
    if (!success) {
      outer: for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const test = { ...base, col: c, row: r, rotation: 0 }
          if (canPlacePregame(test, c, r, placed)) { placed[id] = test; break outer }
        }
      }
    }
  }
  return { ...units, ...placed }
}

// ─── Traitement d'un tir ─────────────────────────────────────────────────────

// Résout un tir sur la grille d'une cible
// Retourne { result: 'hit'|'miss', unitId, destroyed, updatedUnit }
export function resolveShot(col, row, targetUnits) {
  const key = cellKey(col, row)

  for (const [id, unit] of Object.entries(targetUnits)) {
    const cells = getUnitCells(unit)
    if (cells.some(c => c.col === col && c.row === row)) {
      const newHealth = { ...unit.health, [key]: 'hit' }
      const destroyed = cells.every(c => newHealth[cellKey(c.col, c.row)] === 'hit')
      return {
        result: 'hit',
        unitId: id,
        destroyed,
        updatedUnit: { ...unit, health: newHealth, destroyed },
      }
    }
  }
  return { result: 'miss', unitId: null, destroyed: false, updatedUnit: null }
}

// ─── Économie ────────────────────────────────────────────────────────────────

// Calcule la variation de crédits suite à un résultat de tir
export function computeCreditChange(shotResult) {
  if (shotResult.result !== 'hit') return 0
  if (shotResult.destroyed) return ECONOMY.creditLastHit + ECONOMY.creditDestroyBonus
  return ECONOMY.creditPerHit
}

// ─── Condition de victoire ───────────────────────────────────────────────────

// Retourne true si les 2 générateurs de l'adversaire sont détruits
export function isDefeated(units) {
  const gens = Object.values(units).filter(u => u.code === 'gn')
  return gens.length > 0 && gens.every(u => u.destroyed)
}

// Compte les générateurs détruits (pour skip-turn)
export function destroyedGenCount(units) {
  return Object.values(units).filter(u => u.code === 'gn' && u.destroyed).length
}

// ─── Abilities ───────────────────────────────────────────────────────────────

// Radar: cross pattern cells around (col,row) with arm length from unit level
export function getRadarCells(col, row, rdrUnit) {
  const arm = ABILITIES.rdr.armLength[rdrUnit?.level ?? 'S1']
  const cells = []
  for (let d = -arm; d <= arm; d++) {
    if (d !== 0) {
      cells.push({ col: col + d, row })
      cells.push({ col, row: row + d })
    }
  }
  cells.push({ col, row })
  return cells.filter(c => c.col >= 0 && c.col < GRID_COLS && c.row >= 0 && c.row < GRID_ROWS)
}

// Missile area: S1=2×2, S2=cross(r=2), S3=3×3
export function getMissileCells(col, row, mslUnit) {
  const level = mslUnit?.level ?? 'S1'
  const cells = []
  if (level === 'S1') {
    for (let dc = 0; dc < 2; dc++)
      for (let dr = 0; dr < 2; dr++)
        cells.push({ col: col + dc, row: row + dr })
  } else if (level === 'S2') {
    for (let d = -2; d <= 2; d++) {
      cells.push({ col: col + d, row })
      cells.push({ col, row: row + d })
    }
  } else {
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++)
        cells.push({ col: col + dc, row: row + dr })
  }
  return cells.filter(c => c.col >= 0 && c.col < GRID_COLS && c.row >= 0 && c.row < GRID_ROWS)
}

// ─── Repair / Upgrade ────────────────────────────────────────────────────────

// Cost to repair a unit (heal all hit cells)
export function repairCost(unit) {
  const hitCount = Object.values(unit.health).filter(v => v === 'hit').length
  return hitCount * ECONOMY.repairCostPerCell
}

// Apply repair: clear health, un-destroy
export function applyRepair(unit) {
  return { ...unit, health: {}, destroyed: false }
}

// Next upgrade level string or null
export function nextLevel(currentLevel) {
  if (currentLevel === 'S1') return 'S2'
  if (currentLevel === 'S2') return 'S3'
  return null
}

// Cost to upgrade unit to next level
export function upgradeCost(unit) {
  const def = UNIT_DEFINITIONS[unit.code]
  if (!def.upgradeable) return Infinity
  const next = nextLevel(unit.level)
  if (!next) return Infinity
  const key = `${unit.level}to${next}`
  return def.upgradeCost?.[key] ?? Infinity
}

// Apply upgrade: change level, reset health (unit grows, old hits invalid)
export function applyUpgrade(unit) {
  const nl = nextLevel(unit.level)
  if (!nl) return unit
  return { ...unit, level: nl, health: {}, destroyed: false }
}
