import type { CellState, CellVisible, DifficultyConfig } from './types.js'

export function generateBoard(config: DifficultyConfig): CellState[][] {
  const board: CellState[][] = []
  for (let y = 0; y < config.height; y++) {
    board[y] = []
    for (let x = 0; x < config.width; x++) {
      board[y][x] = { x, y, mine: false, revealed: false, flagged: false, adjacentMines: 0 }
    }
  }

  // Fisher-Yates to pick mine positions
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
      board[y][x].adjacentMines = countAdjacentMines(board, x, y, config)
    }
  }

  return board
}

function countAdjacentMines(board: CellState[][], cx: number, cy: number, config: DifficultyConfig): number {
  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height && board[ny][nx].mine) {
        count++
      }
    }
  }
  return count
}

export function generateMineLayout(config: DifficultyConfig): { x: number; y: number }[] {
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
  return positions.slice(0, config.mines)
}

export function cloneBoard(board: CellState[][]): CellState[][] {
  return board.map(row =>
    row.map(cell => ({ ...cell }))
  )
}

export function buildBoardFromMines(config: DifficultyConfig, mineLayout: { x: number; y: number }[]): CellState[][] {
  const board: CellState[][] = []
  for (let y = 0; y < config.height; y++) {
    board[y] = []
    for (let x = 0; x < config.width; x++) {
      board[y][x] = { x, y, mine: false, revealed: false, flagged: false, adjacentMines: 0 }
    }
  }
  for (const { x, y } of mineLayout) {
    board[y][x].mine = true
  }
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board[y][x].mine) continue
      board[y][x].adjacentMines = countAdjacentMines(board, x, y, config)
    }
  }
  return board
}

export function revealCell(board: CellState[][], x: number, y: number, config: DifficultyConfig): { cells: CellVisible[]; hitMine: boolean } {
  const cell = board[y]?.[x]
  if (!cell || cell.revealed || cell.flagged) return { cells: [], hitMine: false }

  if (cell.mine) {
    cell.revealed = true
    const allMines: CellVisible[] = []
    for (const row of board) {
      for (const c of row) {
        if (c.mine && !c.revealed) {
          c.revealed = true
          allMines.push({ x: c.x, y: c.y, revealed: true, flagged: false, adjacentMines: 0, mine: true })
        }
      }
    }
    allMines.push({ x, y, revealed: true, flagged: false, adjacentMines: 0, mine: true })
    return { cells: allMines, hitMine: true }
  }

  const revealed: CellVisible[] = []
  const stack: { x: number; y: number }[] = [{ x, y }]

  while (stack.length > 0) {
    const { x: cx, y: cy } = stack.pop()!
    const cur = board[cy]?.[cx]
    if (!cur || cur.revealed || cur.flagged) continue

    cur.revealed = true
    cur.flagged = false
    revealed.push({ x: cx, y: cy, revealed: true, flagged: false, adjacentMines: cur.adjacentMines })

    if (cur.adjacentMines === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = cx + dx
          const ny = cy + dy
          if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
            stack.push({ x: nx, y: ny })
          }
        }
      }
    }
  }

  return { cells: revealed, hitMine: false }
}

export function toggleFlag(board: CellState[][], x: number, y: number): boolean {
  const cell = board[y]?.[x]
  if (!cell || cell.revealed) return false
  cell.flagged = !cell.flagged
  return cell.flagged
}

export function checkWin(board: CellState[][], config: DifficultyConfig): boolean {
  let revealedCount = 0
  const totalSafe = config.width * config.height - config.mines
  for (const row of board) {
    for (const cell of row) {
      if (cell.revealed && !cell.mine) revealedCount++
    }
  }
  return revealedCount >= totalSafe
}

export function boardToVisible(board: CellState[][], includeMines: boolean): CellVisible[] {
  const result: CellVisible[] = []
  for (const row of board) {
    for (const cell of row) {
      const v: CellVisible = {
        x: cell.x,
        y: cell.y,
        revealed: cell.revealed,
        flagged: cell.flagged,
        adjacentMines: cell.adjacentMines,
      }
      if (includeMines && cell.mine) v.mine = true
      result.push(v)
    }
  }
  return result
}
