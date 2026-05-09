import { useRef, useState, useMemo, useEffect } from 'react'
import { GRID_COLS, GRID_ROWS, ROW_LABELS, COL_LABELS, UNIT_DEFINITIONS } from '../../lib/constants.js'
import { getUnitCells, getUnitCellsAtLevel, getMaxLevel, isInBounds, hasCollision, cellKey, rotateCells, getRadarCells, getMissileCells } from '../../lib/gameEngine.js'
import UnitPiece from './UnitPiece.jsx'
import ShotMarker from './ShotMarker.jsx'
import Crosshair from './Crosshair.jsx'

const LABEL_W = 22
const LABEL_H = 18

export default function GameGrid({
  mode,
  units = {},
  shots = {},
  selectedUnit = null,
  onCellClick,
  onCellHover,
  onUnitPickup,
  onUnitContextMenu,
  canInteract = true,
  cellSize = 48,
  abilityMode = null,
  abilityUnit = null,
  radarRevealed = {},
  flashCell = null,
  onGridRightClick,
  // Attack selection (col/row system)
  selectedCol = null,
  selectedRow = null,
  onColClick,
  onRowClick,
}) {
  const containerRef = useRef(null)
  const [hoverCell, setHoverCell] = useState(null)

  useEffect(() => { onCellHover?.(hoverCell) }, [hoverCell?.col, hoverCell?.row])

  const isAttack  = mode === 'attack'
  const isPregame = mode === 'pregame'
  const isLayout  = mode === 'layout'

  function cellFromEvent(e) {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / cellSize)
    const row = Math.floor((e.clientY - rect.top) / cellSize)
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS)
      return { col, row }
    return null
  }

  function handleMouseMove(e) {
    const cell = cellFromEvent(e)
    setHoverCell(prev => {
      if (!cell && !prev) return prev
      if (cell && prev && cell.col === prev.col && cell.row === prev.row) return prev
      return cell
    })
  }
  function handleMouseLeave() { setHoverCell(null) }

  function handleClick() {
    if (!canInteract || !hoverCell) return
    onCellClick?.(hoverCell.col, hoverCell.row)
  }

  // Placement preview
  const { previewCells, previewS3Cells, previewValid } = useMemo(() => {
    if (!isPregame || !selectedUnit || !hoverCell) return { previewCells: [], previewS3Cells: [], previewValid: false }
    const unit = units[selectedUnit]
    if (!unit) return { previewCells: [], previewS3Cells: [], previewValid: false }
    const baseCells = UNIT_DEFINITIONS[unit.code].levels[unit.level].cells
    const rotated   = rotateCells(baseCells, unit.rotation ?? 0)
    const testCells = rotated.map(([dc, dr]) => ({ col: hoverCell.col + dc, row: hoverCell.row + dr }))
    const maxLevel    = getMaxLevel(unit.code)
    const maxBase     = UNIT_DEFINITIONS[unit.code].levels[maxLevel].cells
    const maxRotated  = rotateCells(maxBase, unit.rotation ?? 0)
    const maxCells    = maxRotated.map(([dc, dr]) => ({ col: hoverCell.col + dc, row: hoverCell.row + dr }))
    const s1KeySet    = new Set(testCells.map(c => cellKey(c.col, c.row)))
    const previewS3Cells = maxCells.filter(c => !s1KeySet.has(cellKey(c.col, c.row)))
    const valid = isInBounds(testCells) && isInBounds(maxCells) &&
      !Object.values(units).some(other => {
        if (other.id === unit.id || other.col == null) return false
        return hasCollision(maxCells, getUnitCellsAtLevel(other, getMaxLevel(other.code)))
      })
    return { previewCells: testCells, previewS3Cells, previewValid: valid }
  }, [isPregame, selectedUnit, hoverCell, units])

  // Ability area preview
  const abilityCells = useMemo(() => {
    if (!abilityMode || !hoverCell) return []
    if (abilityMode === 'rdr') return getRadarCells(hoverCell.col, hoverCell.row, abilityUnit)
    if (abilityMode === 'msl') return getMissileCells(hoverCell.col, hoverCell.row, abilityUnit)
    return []
  }, [abilityMode, hoverCell, abilityUnit])

  const gridBg    = isAttack ? '#C5FF00' : 'transparent'
  const crossColor= isAttack ? 'rgba(0,0,0,0.30)' : '#2c00ff'
  const labelColor= isAttack ? '#000000' : isPregame ? '#222299' : '#2c00ff'

  const inAbilityMode = !!abilityMode && isAttack
  const cursor = isAttack && canInteract && !inAbilityMode
    ? 'none'
    : (isPregame && selectedUnit) || inAbilityMode ? 'crosshair' : 'default'

  const radarRevealedSet = new Set(Object.keys(radarRevealed))

  // Hover col/row in attack mode (for preview before lock)
  const hoverCol = isAttack && canInteract && hoverCell ? hoverCell.col : null
  const hoverRow = isAttack && canInteract && hoverCell ? hoverCell.row : null

  // Intersection target (locked)
  const hasTarget = selectedCol != null && selectedRow != null
  const targetKey = hasTarget ? cellKey(selectedCol, selectedRow) : null
  const targetAlreadyShot = hasTarget && !!shots[targetKey]

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', userSelect: 'none' }}>

      {/* Column headers */}
      <div style={{ display: 'flex', marginLeft: LABEL_W, marginBottom: 2 }}>
        {COL_LABELS.map((lbl, i) => {
          const isSelected = selectedCol === i
          const isHovered  = !isSelected && hoverCol === i
          return (
            <div
              key={i}
              style={{
                width: cellSize, textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                color: isAttack && (isSelected || isHovered) ? '#000' : labelColor,
                fontWeight: isSelected ? 700 : 400,
                opacity: isSelected ? 1 : isHovered ? 0.75 : 0.5,
                backgroundColor: isAttack && isSelected ? 'rgba(0,0,0,0.18)' : 'transparent',
                transition: 'opacity 0.1s, background-color 0.1s',
                paddingBottom: 1,
              }}
            >{lbl}</div>
          )
        })}
      </div>

      <div style={{ display: 'flex' }}>
        {/* Row labels */}
        <div style={{ display: 'flex', flexDirection: 'column', width: LABEL_W }}>
          {ROW_LABELS.map((lbl, i) => {
            const isSelected = selectedRow === i
            const isHovered  = !isSelected && hoverRow === i
            return (
              <div
                key={i}
                style={{
                  height: cellSize,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 4,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  color: isAttack && (isSelected || isHovered) ? '#000' : labelColor,
                  fontWeight: isSelected ? 700 : 400,
                  opacity: isSelected ? 1 : isHovered ? 0.75 : 0.5,
                  backgroundColor: isAttack && isSelected ? 'rgba(0,0,0,0.18)' : 'transparent',
                  transition: 'opacity 0.1s, background-color 0.1s',
                }}
              >{lbl}</div>
            )
          })}
        </div>

        {/* Interactive grid area */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onContextMenu={e => { e.preventDefault(); onGridRightClick?.() }}
          style={{
            position: 'relative',
            width: GRID_COLS * cellSize,
            height: GRID_ROWS * cellSize,
            backgroundColor: gridBg,
            cursor,
          }}
        >
          {/* + crosses at grid intersections */}
          {Array.from({ length: GRID_ROWS + 1 }, (_, row) =>
            Array.from({ length: GRID_COLS + 1 }, (_, col) => (
              <span key={`+${col},${row}`} style={{
                position: 'absolute',
                left: col * cellSize,
                top: row * cellSize,
                transform: 'translate(-50%, -50%)',
                color: crossColor,
                fontSize: (isAttack || isLayout) ? 15 : 11,
                fontWeight: (isAttack || isLayout) ? 'bold' : 'normal',
                opacity: 0.45, pointerEvents: 'none',
                fontFamily: 'monospace', lineHeight: 1,
              }}>+</span>
            ))
          )}

          {/* ── Step 1: hover column preview (no col locked yet) */}
          {isAttack && canInteract && hoverCell && selectedCol == null && Array.from({ length: GRID_ROWS }, (_, r) => (
            <div key={`hcol-${r}`} style={{
              position: 'absolute',
              left: hoverCell.col * cellSize, top: r * cellSize,
              width: cellSize, height: cellSize,
              backgroundColor: 'rgba(0,0,0,0.10)',
              pointerEvents: 'none',
            }} />
          ))}
          {/* ── Step 2: hover row preview (col locked, no row yet) */}
          {isAttack && canInteract && hoverCell && selectedCol != null && selectedRow == null && Array.from({ length: GRID_COLS }, (_, c) => (
            <div key={`hrow-${c}`} style={{
              position: 'absolute',
              left: c * cellSize, top: hoverCell.row * cellSize,
              width: cellSize, height: cellSize,
              backgroundColor: 'rgba(0,0,0,0.10)',
              pointerEvents: 'none',
            }} />
          ))}

          {/* ── Attack column overlay (locked selection) */}
          {isAttack && selectedCol != null && Array.from({ length: GRID_ROWS }, (_, r) => {
            const isIntersect = r === selectedRow
            return (
              <div key={`col-ov-${r}`} style={{
                position: 'absolute',
                left: selectedCol * cellSize, top: r * cellSize,
                width: cellSize, height: cellSize,
                backgroundColor: isIntersect ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.22)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* ── Attack row overlay (locked selection) */}
          {isAttack && selectedRow != null && Array.from({ length: GRID_COLS }, (_, c) => {
            const isIntersect = c === selectedCol
            return (
              <div key={`row-ov-${c}`} style={{
                position: 'absolute',
                left: c * cellSize, top: selectedRow * cellSize,
                width: cellSize, height: cellSize,
                backgroundColor: isIntersect ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.22)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* ── Intersection highlight (both col + row locked) */}
          {isAttack && hasTarget && !targetAlreadyShot && (
            <div style={{
              position: 'absolute',
              left: selectedCol * cellSize + 2, top: selectedRow * cellSize + 2,
              width: cellSize - 4, height: cellSize - 4,
              backgroundColor: 'rgba(0,0,0,0.55)',
              border: '2px solid #000',
              pointerEvents: 'none', zIndex: 4,
            }} />
          )}

          {/* S3 ghost footprints (pregame) */}
          {isPregame && Object.values(units).map(unit => {
            if (unit.col == null) return null
            const maxLevel  = getMaxLevel(unit.code)
            if (maxLevel === unit.level) return null
            const s1Keys    = new Set(getUnitCells(unit).map(c => cellKey(c.col, c.row)))
            const ghostCells = getUnitCellsAtLevel(unit, maxLevel).filter(c => !s1Keys.has(cellKey(c.col, c.row)))
            return ghostCells.map(({ col: gc, row: gr }, i) => (
              <div key={`ghost-${unit.id}-${i}`} style={{
                position: 'absolute',
                left: gc * cellSize + 2, top: gr * cellSize + 2,
                width: cellSize - 4, height: cellSize - 4,
                backgroundColor: 'rgba(44,0,255,0.08)',
                border: '1px dashed rgba(44,0,255,0.35)',
                pointerEvents: 'none',
              }} />
            ))
          })}

          {/* Units (pregame + layout) */}
          {!isAttack && Object.values(units).map(unit => (
            unit.col != null && (
              <UnitPiece
                key={unit.id}
                unit={unit}
                cellSize={cellSize}
                onClick={isPregame ? () => onUnitPickup?.(unit.id) : undefined}
                onContextMenu={mode === 'layout' ? onUnitContextMenu : undefined}
              />
            )
          ))}

          {/* Destroyed units revealed in attack mode */}
          {isAttack && Object.values(units).map(unit => (
            unit.destroyed && unit.col != null && (
              <UnitPiece key={unit.id} unit={unit} cellSize={cellSize} faded />
            )
          ))}

          {/* Radar-revealed cells */}
          {isAttack && Array.from(radarRevealedSet).map(key => {
            const [col, row] = key.split(',').map(Number)
            if (shots[key]) return null
            const hasUnit = Object.values(units).some(u =>
              getUnitCells(u).some(c => c.col === col && c.row === row)
            )
            return (
              <div key={`rdr-${key}`} style={{
                position: 'absolute',
                left: col * cellSize + 2, top: row * cellSize + 2,
                width: cellSize - 4, height: cellSize - 4,
                border: `1px solid ${hasUnit ? 'rgba(255,0,0,0.6)' : 'rgba(0,0,0,0.2)'}`,
                backgroundColor: hasUnit ? 'rgba(255,0,0,0.12)' : 'rgba(0,0,0,0.05)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* Shot markers */}
          {Object.entries(shots).map(([key, info]) => {
            const [col, row] = key.split(',').map(Number)
            return (
              <ShotMarker key={key} col={col} row={row} result={info.result} cellSize={cellSize} lightBg={isAttack} />
            )
          })}

          {/* Cell flash */}
          {flashCell && (
            <div
              className="cell-flash"
              style={{
                position: 'absolute',
                left: flashCell.col * cellSize, top: flashCell.row * cellSize,
                width: cellSize, height: cellSize,
                backgroundColor: '#ffffff',
                pointerEvents: 'none', zIndex: 20,
              }}
            />
          )}

          {/* Ability area preview */}
          {inAbilityMode && abilityCells.map(({ col, row }, i) => (
            <div key={`abl-${i}`} style={{
              position: 'absolute',
              left: col * cellSize + 1, top: row * cellSize + 1,
              width: cellSize - 2, height: cellSize - 2,
              backgroundColor: abilityMode === 'rdr' ? 'rgba(255,0,0,0.18)' : 'rgba(255,20,147,0.22)',
              border: `1px solid ${abilityMode === 'rdr' ? 'rgba(255,60,60,0.7)' : 'rgba(255,20,147,0.8)'}`,
              pointerEvents: 'none',
            }} />
          ))}

          {/* Placement preview S3 ghost */}
          {isPregame && previewS3Cells.map(({ col, row }, i) => (
            <div key={`ps3-${i}`} style={{
              position: 'absolute',
              left: col * cellSize + 2, top: row * cellSize + 2,
              width: cellSize - 4, height: cellSize - 4,
              backgroundColor: previewValid ? 'rgba(197,255,0,0.10)' : 'rgba(255,60,60,0.10)',
              border: `1px dashed ${previewValid ? 'rgba(197,255,0,0.5)' : 'rgba(255,60,60,0.5)'}`,
              pointerEvents: 'none',
            }} />
          ))}
          {isPregame && previewCells.map(({ col, row }, i) => (
            <div key={`p1-${i}`} style={{
              position: 'absolute',
              left: col * cellSize + 2, top: row * cellSize + 2,
              width: cellSize - 4, height: cellSize - 4,
              backgroundColor: previewValid ? 'rgba(197,255,0,0.4)' : 'rgba(255,60,60,0.4)',
              border: `1px solid ${previewValid ? '#C5FF00' : '#FF3C3C'}`,
              pointerEvents: 'none',
            }} />
          ))}

          {/* Crosshair — only for ability targeting */}
          {inAbilityMode && canInteract && hoverCell &&
            !shots[cellKey(hoverCell.col, hoverCell.row)] && (
            <Crosshair col={hoverCell.col} row={hoverCell.row} cellSize={cellSize} />
          )}
        </div>
      </div>
    </div>
  )
}
