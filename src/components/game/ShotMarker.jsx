// Shot marker on the grid
// hit  → magenta X cross
// miss → dot, color adapts to grid background
export default function ShotMarker({ col, row, result, cellSize, lightBg = false }) {
  const isHit = result === 'hit'
  const size = cellSize - 4

  return (
    <div
      style={{
        position: 'absolute',
        left: col * cellSize + 2,
        top: row * cellSize + 2,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {isHit ? (
        <img
          src="/assets/dot_eliminated.svg"
          draggable={false}
          style={{ width: size, height: size, pointerEvents: 'none' }}
        />
      ) : (
        // lightBg=true (attack/lime board) → dark dot; lightBg=false (layout/dark) → lime dot
        <div style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: '50%',
          backgroundColor: lightBg ? 'rgba(0,0,0,0.5)' : 'rgba(197,255,0,0.7)',
          border: `1px solid ${lightBg ? 'rgba(0,0,0,0.7)' : 'rgba(197,255,0,0.9)'}`,
        }} />
      )}
    </div>
  )
}
