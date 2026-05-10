import { UNIT_DEFINITIONS } from '../../lib/constants.js'
import { getUnitCells, cellKey } from '../../lib/gameEngine.js'

// PNG assets for specific unit+level combos
const UNIT_IMAGES = {
  trll_S1: '/assets/units/trll_s1.png',
}

export default function UnitPiece({ unit, cellSize, onClick, onContextMenu, faded = false }) {
  const def   = UNIT_DEFINITIONS[unit.code]
  const color = def.color

  // getUnitCells applies unit.rotation — gives correct absolute positions
  const cells = getUnitCells(unit)

  function handleContextMenu(e) {
    e.preventDefault()
    onContextMenu?.(unit, { x: e.clientX, y: e.clientY })
  }

  const imageSrc = UNIT_IMAGES[`${unit.code}_${unit.level}`]

  if (imageSrc) {
    const levelDef = def.levels[unit.level]
    const minCol   = Math.min(...cells.map(c => c.col))
    const minRow   = Math.min(...cells.map(c => c.row))
    const opacity  = faded ? 0.3 : (unit.destroyed ? 0.4 : 1)
    // Each rotation uses rotate(90deg) + optional scaleX(-1) so the 3D render
    // stays coherent (no upside-down 180° flips, no reversed-lighting 270°).
    const IMG_TRANSFORM = {
      0: 'scaleX(-1)',
      1: 'rotate(90deg) scaleX(-1)',
      2: 'rotate(90deg)',
      3: undefined,
    }

    return (
      <>
        <img
          src={imageSrc}
          draggable={false}
          style={{
            position: 'absolute',
            left: minCol * cellSize,
            top: minRow * cellSize,
            width: levelDef.w * cellSize,
            height: levelDef.h * cellSize,
            opacity,
            pointerEvents: 'none',
            userSelect: 'none',
            transform: IMG_TRANSFORM[unit.rotation ?? 0],
            transformOrigin: 'center center',
          }}
        />
        {cells.map(({ col: abCol, row: abRow }, i) => {
          const isHit = unit.health[cellKey(abCol, abRow)] === 'hit'
          return (
            <div
              key={i}
              onClick={onClick}
              onContextMenu={onContextMenu ? handleContextMenu : undefined}
              style={{
                position: 'absolute',
                left: abCol * cellSize,
                top: abRow * cellSize,
                width: cellSize,
                height: cellSize,
                cursor: onClick ? 'pointer' : (onContextMenu ? 'context-menu' : 'default'),
                userSelect: 'none',
                backgroundColor: isHit ? 'rgba(0,0,0,0.45)' : 'transparent',
              }}
            />
          )
        })}
      </>
    )
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
            }}
          >
            {isFirst && !isHit && (
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
          </div>
        )
      })}
    </>
  )
}
