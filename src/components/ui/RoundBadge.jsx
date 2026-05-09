// Badge "ROUND XX" affiché en haut à droite
export default function RoundBadge({ round }) {
  const label = String(round).padStart(2, '0')
  return (
    <div
      className="absolute top-4 right-4 z-20 flex flex-col items-center bg-lime text-dark font-mono font-bold leading-none select-none"
      style={{
        padding: '4px 10px 6px',
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: '0.2em' }}>ROUND</span>
      <span style={{ fontSize: 32, letterSpacing: '0.05em', lineHeight: 1 }}>{label}</span>
    </div>
  )
}
