import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTES } from './lib/constants.js'
import { GameProvider } from './store/GameContext.jsx'
import HomePage    from './pages/HomePage.jsx'
import LobbyPage   from './pages/LobbyPage.jsx'
import PreGamePage from './pages/PreGamePage.jsx'
import GamePage    from './pages/GamePage.jsx'
import ResultPage  from './pages/ResultPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <Routes>
          <Route path={ROUTES.home}    element={<HomePage />} />
          <Route path={ROUTES.lobby}   element={<LobbyPage />} />
          <Route path={ROUTES.pregame} element={<PreGamePage />} />
          <Route path={ROUTES.game}    element={<GamePage />} />
          <Route path={ROUTES.result}  element={<ResultPage />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  )
}
