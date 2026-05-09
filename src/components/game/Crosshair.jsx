// Viseur 4-coins sur la grille d'attaque (mode attack)
export default function Crosshair({ col, row, cellSize }) {
  const x = col * cellSize
  const y = row * cellSize
  const s = 8   // longueur des bras du viseur
  const g = 4   // gap depuis le coin

  return (
    <svg
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: cellSize,
        height: cellSize,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Coin haut-gauche */}
      <polyline points={`${g + s},${g} ${g},${g} ${g},${g + s}`} fill="none" stroke="#000" strokeWidth="2.5" />
      {/* Coin haut-droit */}
      <polyline points={`${cellSize - g - s},${g} ${cellSize - g},${g} ${cellSize - g},${g + s}`} fill="none" stroke="#000" strokeWidth="2.5" />
      {/* Coin bas-gauche */}
      <polyline points={`${g},${cellSize - g - s} ${g},${cellSize - g} ${g + s},${cellSize - g}`} fill="none" stroke="#000" strokeWidth="2.5" />
      {/* Coin bas-droit */}
      <polyline points={`${cellSize - g},${cellSize - g - s} ${cellSize - g},${cellSize - g} ${cellSize - g - s},${cellSize - g}`} fill="none" stroke="#000" strokeWidth="2.5" />
    </svg>
  )
}
