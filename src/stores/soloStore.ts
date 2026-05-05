import { create } from 'zustand'
import type { Difficulty, DifficultyConfig } from '../types'
import { DIFFICULTIES } from '../types'

// Lightweight cell type for solo play
export interface SoloCell {
  x: number
  y: number
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacentMines: number
}

interface SoloState {
  board: SoloCell[][] | null
  config: DifficultyConfig | null
  phase: 'idle' | 'playing' | 'won' | 'lost'
  flagsPlaced: number
  elapsedSeconds: number
  timerInterval: ReturnType<typeof setInterval> | null
  mouseDown: boolean

  startGame: (difficulty: Difficulty) => void
  revealCell: (x: number, y: number) => void
  toggleFlag: (x: number, y: number) => void
  setMouseDown: (down: boolean) => void
  reset: () => void
  stopTimer: () => void
}

function generateBoard(config: DifficultyConfig): SoloCell[][] {
  const board: SoloCell[][] = []
  for (let y = 0; y < config.height; y++) {
    board[y] = []
    for (let x = 0; x < config.width; x++) {
      board[y][x] = { x, y, mine: false, revealed: false, flagged: false, adjacentMines: 0 }
    }
  }

  // Fisher-Yates mine placement
  const positions: { x: number; y: number }[] = []
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      positions.push({ x, y })
    }
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  for (let i = 0; i < config.mines; i++) {
    const { x, y } = positions[i]
    board[y][x].mine = true
  }

  // Compute adjacent mine counts
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board[y][x].mine) continue
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height && board[ny][nx].mine) {
            count++
          }
        }
      }
      board[y][x].adjacentMines = count
    }
  }

  return board
}

function checkWin(board: SoloCell[][], config: DifficultyConfig): boolean {
  const totalSafe = config.width * config.height - config.mines
  let revealedSafe = 0
  for (const row of board) {
    for (const c of row) {
      if (c.revealed && !c.mine) revealedSafe++
    }
  }
  return revealedSafe >= totalSafe
}

function revealBFS(board: SoloCell[][], x: number, y: number, config: DifficultyConfig): void {
  const cell = board[y]?.[x]
  if (!cell || cell.revealed || cell.flagged) return

  cell.revealed = true
  cell.flagged = false

  if (cell.adjacentMines === 0 && !cell.mine) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
          revealBFS(board, nx, ny, config)
        }
      }
    }
  }
}

export const useSoloStore = create<SoloState>((set, get) => ({
  board: null,
  config: null,
  phase: 'idle',
  flagsPlaced: 0,
  elapsedSeconds: 0,
  timerInterval: null,
  mouseDown: false,

  startGame: (difficulty) => {
    const config = DIFFICULTIES[difficulty]
    const board = generateBoard(config)
    const existing = get().timerInterval
    if (existing) clearInterval(existing)
    const id = setInterval(() => {
      set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 }))
    }, 1000)
    set({
      board,
      config,
      phase: 'playing',
      flagsPlaced: 0,
      elapsedSeconds: 0,
      timerInterval: id,
      mouseDown: false,
    })
  },

  revealCell: (x, y) => {
    const { board, config, phase, mouseDown } = get()
    if (!board || !config || phase !== 'playing') return
    const cell = board[y]?.[x]
    if (!cell || cell.revealed || cell.flagged) return

    if (cell.mine) {
      // Reveal all mines
      const newBoard = board.map((row) =>
        row.map((c) => {
          if (c.mine && !c.revealed) {
            return { ...c, revealed: true }
          }
          return c
        })
      )
      // Reveal the clicked mine last (for visual)
      newBoard[y] = newBoard[y].map((c) => (c.x === x ? { ...c, revealed: true } : c))
      get().stopTimer()
      set({ board: newBoard, phase: 'lost' })
      return
    }

    // Clone board for immutable update
    const newBoard = board.map((row) => row.map((c) => ({ ...c })))
    revealBFS(newBoard, x, y, config)
    const won = checkWin(newBoard, config)
    if (won) get().stopTimer()
    set({ board: newBoard, phase: won ? 'won' : 'playing' })
    // Recalculate flags
    let flags = 0
    for (const row of newBoard) {
      for (const c of row) {
        if (c.flagged) flags++
      }
    }
    set({ flagsPlaced: flags })
  },

  toggleFlag: (x, y) => {
    const { board, phase } = get()
    if (!board || phase !== 'playing') return
    const cell = board[y]?.[x]
    if (!cell || cell.revealed) return

    const newBoard = board.map((row) => row.map((c) => ({ ...c })))
    newBoard[y][x].flagged = !newBoard[y][x].flagged

    let flags = 0
    for (const row of newBoard) {
      for (const c of row) {
        if (c.flagged) flags++
      }
    }
    set({ board: newBoard, flagsPlaced: flags })
  },

  setMouseDown: (down) => set({ mouseDown: down }),

  reset: () => {
    get().stopTimer()
    set({ board: null, config: null, phase: 'idle', flagsPlaced: 0, elapsedSeconds: 0 })
  },

  stopTimer: () => {
    const id = get().timerInterval
    if (id) clearInterval(id)
    set({ timerInterval: null })
  },
}))
