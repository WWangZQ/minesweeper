import { create } from 'zustand'
import type { CellVisible, DifficultyConfig, GameMode, GamePhase, Player } from '../types'

interface GameState {
  board: CellVisible[][] | null
  config: DifficultyConfig | null
  mode: GameMode | null
  phase: GamePhase
  roomId: string

  myPlayerId: string
  flagsPlaced: number
  cellsRevealed: number
  alive: boolean
  finished: boolean
  finishTime: number | null

  elapsedSeconds: number
  timerInterval: ReturnType<typeof setInterval> | null

  players: Player[]
  creatorId: string
  gameOverPayload: any | null
  rematchVoted: boolean
  rematchVotes: number
  rematchTotal: number
  opponentLeft: boolean

  initBoard: (cells: CellVisible[], config: DifficultyConfig) => void
  patchCells: (cells: CellVisible[]) => void
  updatePlayer: (playerId: string, update: Partial<Player>) => void
  setPlayers: (players: Player[]) => void
  setPhase: (phase: GamePhase) => void
  setMode: (mode: GameMode) => void
  setRoomId: (id: string) => void
  setMyPlayerId: (id: string) => void
  setCreatorId: (id: string) => void
  setElapsed: (seconds: number) => void
  setGameOverPayload: (p: any) => void
  setRematchVote: (voted: boolean, votes: number, total: number) => void
  setOpponentLeft: () => void
  startTimer: () => void
  stopTimer: () => void
  reset: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  board: null,
  config: null,
  mode: null,
  phase: 'waiting',
  roomId: '',
  myPlayerId: '',
  flagsPlaced: 0,
  cellsRevealed: 0,
  alive: true,
  finished: false,
  finishTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  players: [],
  creatorId: '',
  gameOverPayload: null,
  rematchVoted: false,
  rematchVotes: 0,
  rematchTotal: 0,
  opponentLeft: false,

  initBoard: (cells, config) => {
    const board: CellVisible[][] = []
    for (let y = 0; y < config.height; y++) {
      board[y] = new Array(config.width)
    }
    for (const cell of cells) {
      board[cell.y][cell.x] = cell
    }
    set({ board, config })
  },

  patchCells: (cells) => {
    const { board } = get()
    if (!board) return
    const newBoard = board.slice()
    for (const cell of cells) {
      if (cell.y < newBoard.length) {
        const row = newBoard[cell.y].slice()
        row[cell.x] = cell
        newBoard[cell.y] = row
      }
    }
    set({ board: newBoard })
  },

  updatePlayer: (playerId, update) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, ...update } : p
      ),
    }))
    // If it's me, update local state too
    const { myPlayerId } = get()
    if (playerId === myPlayerId) {
      if (update.flagsPlaced !== undefined) set({ flagsPlaced: update.flagsPlaced })
      if (update.cellsRevealed !== undefined) set({ cellsRevealed: update.cellsRevealed })
      if (update.alive !== undefined) set({ alive: update.alive })
      if (update.finished !== undefined) set({ finished: update.finished })
      if (update.finishTime !== undefined) set({ finishTime: update.finishTime })
    }
  },

  setPlayers: (players) => set({ players }),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setRoomId: (id) => set({ roomId: id }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setCreatorId: (id) => set({ creatorId: id }),
  setElapsed: (seconds) => set({ elapsedSeconds: seconds }),
  setGameOverPayload: (p) => set({ gameOverPayload: p }),
  setRematchVote: (voted, votes, total) => set({ rematchVoted: voted, rematchVotes: votes, rematchTotal: total }),
  setOpponentLeft: () => set({ opponentLeft: true }),

  startTimer: () => {
    const existing = get().timerInterval
    if (existing) clearInterval(existing)
    const id = setInterval(() => {
      set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 }))
    }, 1000)
    set({ timerInterval: id, elapsedSeconds: 0 })
  },

  stopTimer: () => {
    const id = get().timerInterval
    if (id) clearInterval(id)
    set({ timerInterval: null })
  },

  reset: () => set({
    board: null,
    config: null,
    phase: 'waiting',
    flagsPlaced: 0,
    cellsRevealed: 0,
    alive: true,
    finished: false,
    finishTime: null,
    elapsedSeconds: 0,
    gameOverPayload: null,
    rematchVoted: false,
    rematchVotes: 0,
    rematchTotal: 0,
    opponentLeft: false,
  }),
}))
