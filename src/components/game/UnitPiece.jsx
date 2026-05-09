import { UNIT_DEFINITIONS } from '../../lib/constants.js'
import { getUnitCells, cellKey } from '../../lib/gameEngine.js'

export default function UnitPiece({ unit, cellSize, onClick, onContextMenu, faded = false }) {
  const def   = UNIT_DEFINITIONS[unit.code]
  const color = def.color

  // getUnitCells applies unit.rotation — gives correct absolute positions
  const cells = getUnitCells(unit)

  function handleContextMenu(e) {
    e.preventDefault()
    onContextMenu?.(unit, { x: e.clientX, y: e.clientY })
  }

  return (
    <>
      {cells.map(({ col: abCol, row: abRow }, i) => {
        const isHit   = unit.health[cellKey(abCol, abRow)] === 'hit'
        const isFirst = i === 0

        return (
          <div
            key={i}
            onClick={onClick}
            onContextMenu={onContextMenu ? handleContextMenu : undefined}
            style={{
              position: 'absolute',
              left: abCol * cellSize + 2,
              top: abRow * cellSize + 2,
              width: cellSize - 4,
              height: cellSize - 4,
              backgroundColor: isHit ? 'rgba(0,0,0,0.3)' : color,
              borderRadius: 4,
              opacity: faded ? 0.3 : (unit.destroyed ? 0.4 : 1),
              cursor: onClick ? 'pointer' : (onContextMenu ? 'context-menu' : 'default'),
              overflow: 'hidden',
              userSelect: 'none',
              border: isHit ? '2px solid #FF0000' : 'none',
            }}
          >
            {isFirst && (
              <div style={{
                position: 'absolute',
                top: 2, left: 3,
                color: unit.code === 'shld' ? '#000' : 'white',
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1,
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 8, opacity: 0.85 }}>{unit.code}.</div>
                <div style={{ fontSize: 11, fontWeight: 'bold' }}>{unit.level}</div>
              </div>
            )}
            {isHit && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FF0000', fontSize: cellSize * 0.5, fontWeight: 'bold',
                opacity: 0.9, pointerEvents: 'none',
              }}>
                ✕
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
