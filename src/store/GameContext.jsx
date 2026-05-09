import { createContext, useContext, useState } from 'react'
import { useGame } from '../hooks/useGame.js'

// Contexte partagé entre toutes les pages
const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [difficulty, setDifficulty] = useState('easy')
  const game = useGame(difficulty)

  return (
    <GameContext.Provider value={{ game, difficulty, setDifficulty }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGameContext must be used inside <GameProvider>')
  return ctx
}
