// Top-right HUD: ROUND + CREDITS
// Matches the ref design: small label above, lime digit boxes below
export default function RoundCreditsDisplay({ round, credits, showCredits = true }) {
  const r = String(Math.min(round, 99)).padStart(2, '0')
  const cr = String(Math.min(credits, 999)).padStart(3, '0')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
      userSelect: 'none',
    }}>
      <Segment label="ROUND" value={r} digitW={44} digitH={54} fontSize={36} />
      {showCredits && (
        <Segment label="CR" value={cr} digitW={34} digitH={42} fontSize={26} />
      )}
    </div>
  )
}

function Segment({ label, value, digitW, digitH, fontSize }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.3em',
        color: '#C5FF00',
        textAlign: 'right',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {value.split('').map((ch, i) => (
          <DigitBox key={i} digit={ch} w={digitW} h={digitH} fontSize={fontSize} />
        ))}
      </div>
    </div>
  )
}

function DigitBox({ digit, w, h, fontSize }) {
  return (
    <div style={{
      width: w,
      height: h,
      backgroundColor: '#C5FF00',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: "'PPFraktionMono', 'JetBrains Mono', monospace",
        fontWeight: 700,
        fontSize,
        color: '#0A0A0A',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {digit}
      </span>
    </div>
  )
}
