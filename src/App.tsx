import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import LobbyPage from './pages/LobbyPage'
import RoomPage from './pages/RoomPage'
import GamePage from './pages/GamePage'
import SoloPage from './pages/SoloPage'

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <HashRouter>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/solo" element={<SoloPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </HashRouter>
    </>
  )
}
