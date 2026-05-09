import { useNavigate } from 'react-router-dom'
import { useGameContext } from '../store/GameContext.jsx'
import { ROUTES } from '../lib/constants.js'

export default function ResultPage() {
  const navigate = useNavigate()
  const { game } = useGameContext()
  const { state, reset } = game
  const { winner, round, player, bot, forfeitWin } = state

  const isVictory = winner === 'player'

  const playerHits   = Object.values(player.shots).filter(s => s.result === 'hit').length
  const botHits      = Object.values(bot.shots).filter(s => s.result === 'hit').length

  function handleReplay() {
    reset()
    navigate(ROUTES.home)
  }

  return (
    <div style={{
      position: 'relative', width:'100%', height:'100vh',
      backgroundColor:'#0A0A0A', overflow:'hidden',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:'JetBrains Mono, monospace',
    }}>
      {/* Lignes diagonales */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={-300 + i*180} y1="0" x2={-300 + i*180 + 1200} y2="1200"
            stroke="#FF00FF" strokeWidth="0.8" strokeOpacity="0.08" />
        ))}
      </svg>

      <div style={{ position:'relative', zIndex:5, display:'flex', flexDirection:'column', alignItems:'center', gap:32 }}>
        {/* Titre résultat */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontSize: 'clamp(24px, 6vw, 56px)',
            fontWeight: 700,
            color: isVictory ? '#C5FF00' : '#FF0000',
            letterSpacing: '0.1em',
          }}>
            {isVictory ? '// VICTORY' : '// DEFEAT'}
          </div>
          {forfeitWin && (
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: 'rgba(197,255,0,0.5)',
              letterSpacing: '0.18em',
            }}>
              // OPPONENT LEFT THE GAME
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          border: '1px solid #C5FF00',
          padding: '20px 32px',
          display: 'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 32px',
        }}>
          {[
            ['ROUNDS', round],
            ['HITS DEALT', playerHits],
            ['HITS TAKEN', botHits],
            ['CREDITS', player.credits],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize:9, color:'#C5FF00', opacity:0.45, letterSpacing:'0.2em' }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#C5FF00' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Bouton rejouer */}
        <button
          onClick={handleReplay}
          style={{
            backgroundColor: '#C5FF00', color: '#000',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
            padding: '12px 28px', border: 'none', cursor: 'pointer',
            clipPath: 'polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor='#fff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor='#C5FF00' }}
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  )
}
