// Clusters de pixels bleus décoratifs (4 coins de l'écran)
// Reproduit les groupes de motifs circuit-board visibles sur les maquettes

function PixelCluster() {
  // Motif en croix/diamant bleu
  const pattern = [
    [0,1],[0,2],
    [1,0],[1,1],[1,2],[1,3],
    [2,1],[2,2],
  ]
  return (
    <div className="relative" style={{ width: 32, height: 32 }}>
      {pattern.map(([c, r], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c * 8,
            top: r * 8,
            width: 5,
            height: 5,
            border: '1px solid #2c00ff',
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  )
}

function CornerGroup({ className }) {
  return (
    <div className={`absolute grid gap-3 ${className}`} style={{ gridTemplateColumns: 'repeat(3, 32px)' }}>
      {Array.from({ length: 9 }).map((_, i) => <PixelCluster key={i} />)}
    </div>
  )
}

export default function DecorPixels() {
  return (
    <>
      <CornerGroup className="top-6 left-6"   />
      <CornerGroup className="top-6 right-6"  />
      <CornerGroup className="bottom-6 left-6"  />
      <CornerGroup className="bottom-6 right-6" />
    </>
  )
}
