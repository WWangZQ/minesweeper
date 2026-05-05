import { create } from 'zustand'
import type { RoomSummary } from '../types'

interface LobbyState {
  playerName: string
  playerId: string
  rooms: RoomSummary[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected'

  setPlayerName: (name: string) => void
  setPlayerId: (id: string) => void
  setRooms: (rooms: RoomSummary[]) => void
  setConnectionStatus: (status: LobbyState['connectionStatus']) => void
}

export const useLobbyStore = create<LobbyState>((set) => ({
  playerName: sessionStorage.getItem('playerName') || '',
  playerId: sessionStorage.getItem('playerId') || '',
  rooms: [],
  connectionStatus: 'disconnected',

  setPlayerName: (name) => {
    sessionStorage.setItem('playerName', name)
    set({ playerName: name })
  },
  setPlayerId: (id) => {
    sessionStorage.setItem('playerId', id)
    set({ playerId: id })
  },
  setRooms: (rooms) => set({ rooms }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}))
