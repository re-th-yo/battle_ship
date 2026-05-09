import { useEffect, useRef } from 'react'
import { repairCost, upgradeCost, nextLevel } from '../../lib/gameEngine.js'
import { UNIT_DEFINITIONS, ECONOMY } from '../../lib/constants.js'

const ABILITY_UNITS = ['rdr', 'gltch', 'msl']
const ABILITY_COLORS = { rdr: '#FF4444', gltch: '#9B4DCA', msl: '#FF1493' }

export default function UnitContextMenu({ unit, credits, abilities, position, onRepair, onUpgrade, onBuyAbility, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const def     = UNIT_DEFINITIONS[unit.code]
  const rCost   = repairCost(unit)
  const uCost   = upgradeCost(unit)
  const nl      = nextLevel(unit.level)
  const canRepair  = rCost > 0 && !unit.destroyed && credits >= rCost
  const canUpgrade = nl !== null && uCost < Infinity && credits >= uCost && !unit.destroyed && hitCount === 0
  const hitCount   = Object.values(unit.health).filter(v => v === 'hit').length

  const hasAbility   = ABILITY_UNITS.includes(unit.code)
  const abilityUsed  = hasAbility && abilities?.[unit.code] === true
  const canBuyAbility = abilityUsed && !unit.destroyed && credits >= ECONOMY.abilityCost

  // Clamp menu to viewport
  const menuStyle = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 210),
    top: Math.min(position.y, window.innerHeight - 260),
    zIndex: 1000,
    backgroundColor: '#0A0A0A',
    border: '1px solid #C5FF00',
    minWidth: 200,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    clipPath: 'polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)',
  }

  return (
    <div ref={menuRef} onContextMenu={e => e.preventDefault()} style={menuStyle}>
      {/* Unit header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(197,255,0,0.15)' }}>
        <div style={{ color: '#C5FF00', fontWeight: 700, letterSpacing: '0.1em', fontSize: 12 }}>
          [{unit.code.toUpperCase()}] — {def.name}
        </div>
        <div style={{ color: 'rgba(197,255,0,0.45)', fontSize: 9, marginTop: 4, lineHeight: 1.4, letterSpacing: '0.04em' }}>
          {def.desc}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(197,255,0,0.1)', display: 'flex', gap: 12, fontSize: 9 }}>
        <span style={{ color: 'rgba(197,255,0,0.4)', letterSpacing: '0.1em' }}>LV {unit.level}</span>
        {hitCount > 0 && (
          <span style={{ color: '#FF4444', letterSpacing: '0.1em' }}>{hitCount} HIT{hitCount > 1 ? 'S' : ''}</span>
        )}
        {unit.destroyed && (
          <span style={{ color: '#FF0000', fontWeight: 700, letterSpacing: '0.1em' }}>DESTROYED</span>
        )}
      </div>

      {/* Repair */}
      <CtxItem
        label={hitCount === 0 ? 'REPAIR.exe  (no damage)' : `REPAIR.exe  (${rCost} CR)`}
        enabled={canRepair}
        color="#C5FF00"
        onClick={() => { onRepair(unit.id); onClose() }}
      />

      {/* Upgrade */}
      {nl && (
        <CtxItem
          label={hitCount > 0 && !unit.destroyed ? `UPGRADE → ${nl}  (repair first)` : `UPGRADE → ${nl}  (${uCost} CR)`}
          enabled={canUpgrade}
          color="#a1ff00"
          onClick={() => { onUpgrade(unit.id); onClose() }}
        />
      )}

      {/* Buy ability */}
      {hasAbility && abilityUsed && (
        <CtxItem
          label={`BUY ${unit.code}.exe  (${ECONOMY.abilityCost} CR)`}
          enabled={canBuyAbility}
          color={ABILITY_COLORS[unit.code]}
          onClick={() => { onBuyAbility(unit.code); onClose() }}
        />
      )}

      {/* Credits footer */}
      <div style={{ padding: '6px 12px', color: 'rgba(197,255,0,0.3)', fontSize: 9, letterSpacing: '0.1em' }}>
        WALLET: {credits} CR
      </div>
    </div>
  )
}

function CtxItem({ label, enabled, color, onClick }) {
  return (
    <button
      disabled={!enabled}
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 12px',
        background: 'none', border: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, fontWeight: 700,
        color: enabled ? color : 'rgba(197,255,0,0.2)',
        cursor: enabled ? 'pointer' : 'not-allowed',
        letterSpacing: '0.05em',
        transition: 'background-color 0.08s',
      }}
      onMouseEnter={e => { if (enabled) e.currentTarget.style.backgroundColor = 'rgba(197,255,0,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {label}
    </button>
  )
}
