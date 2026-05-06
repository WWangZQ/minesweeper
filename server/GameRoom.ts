import type { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import type {
  CellState, CellVisible, Difficulty, DifficultyConfig, GameMode, GamePhase,
  Player, RoomSummary, ServerMessage
} from './types.js'
import { DIFFICULTIES } from './types.js'
import {
  generateBoard, generateMineLayout, buildBoardFromMines,
  revealCell, toggleFlag, checkWin, boardToVisible
} from './GameLogic.js'

export class GameRoom {
  id: string
  mode: GameMode
  difficulty: Difficulty
  config: DifficultyConfig
  phase: GamePhase = 'waiting'
  players: Player[] = []
  sharedBoard: CellState[][] | null = null
  boards: Map<string, CellState[][]> = new Map()
  startedAt: number | null = null
  creatorId: string = ''
  private mineLayout: { x: number; y: number }[] = []
  private firstClickDone: boolean = false
  // Race mode: per-player first-click tracking
  private raceFirstClicks: Map<string, boolean> = new Map()

  // Connection sockets: playerId → WebSocket
  private sockets: Map<string, WebSocket> = new Map()

  constructor(id: string, mode: GameMode, difficulty: Difficulty) {
    this.id = id
    this.mode = mode
    this.difficulty = difficulty
    this.config = DIFFICULTIES[difficulty]
  }

  addPlayer(ws: WebSocket, playerName: string): Player {
    const id = uuidv4()
    const player: Player = {
      id,
      name: playerName,
      roomId: this.id,
      flagsPlaced: 0,
      cellsRevealed: 0,
      alive: true,
      finished: false,
      finishTime: null,
    }
    this.players.push(player)
    this.sockets.set(id, ws)

    if (this.players.length === 1) {
      this.creatorId = id
    }
    return player
  }

  removePlayer(playerId: string): void {
    this.players = this.players.filter(p => p.id !== playerId)
    this.sockets.delete(playerId)
    if (this.creatorId === playerId && this.players.length > 0) {
      this.creatorId = this.players[0].id
    }
  }

  getSocket(playerId: string): WebSocket | undefined {
    return this.sockets.get(playerId)
  }

  hasPlayer(playerId: string): boolean {
    return this.players.some(p => p.id === playerId)
  }

  startGame(): void {
    if (this.phase === 'playing') return
    this.phase = 'playing'
    this.startedAt = Date.now()

    for (const p of this.players) {
      p.alive = true
      p.finished = false
      p.finishTime = null
      p.flagsPlaced = 0
      p.cellsRevealed = 0
    }

    if (this.mode === 'race') {
      // Generate one master layout, but defer actual mine placement to first click
      this.mineLayout = generateMineLayout(this.config)
      this.raceFirstClicks.clear()
      this.boards.clear()
      for (const p of this.players) {
        const board = this.emptyBoard(this.config)
        this.boards.set(p.id, board)
        this.raceFirstClicks.set(p.id, false)
        const visible = boardToVisible(board, false)
        this.sendTo(p.id, {
          type: 'game_started',
          payload: {
            board: visible,
            config: this.config,
            mode: this.mode,
            players: this.players,
          },
        })
      }
    } else {
      // Battle / Co-op: empty shared board, mines placed on first click
      this.firstClickDone = false
      this.sharedBoard = this.emptyBoard(this.config)
      const visible = boardToVisible(this.sharedBoard, false)
      this.broadcast({
        type: 'game_started',
        payload: {
          board: visible,
          config: this.config,
          mode: this.mode,
          players: this.players,
        },
      })
    }
  }

  handleReveal(playerId: string, x: number, y: number): void {
    if (this.phase !== 'playing') return

    const player = this.players.find(p => p.id === playerId)
    if (!player || !player.alive || player.finished) return

    const board = this.mode === 'race'
      ? this.boards.get(playerId)!
      : this.sharedBoard!

    if (!board) return

    // First click: place mines with safe zone around click
    if (this.mode === 'race') {
      if (!this.raceFirstClicks.get(playerId)) {
        this.raceFirstClicks.set(playerId, true)
        this.placeMinesFromLayout(board, this.config, x, y)
      }
    } else if (!this.firstClickDone) {
      this.firstClickDone = true
      this.placeMinesInBoard(board, this.config, x, y)
    }

    const { cells, hitMine } = revealCell(board, x, y, this.config)

    if (cells.length === 0) return

    if (hitMine) {
      player.alive = false
      player.finished = true

      if (this.mode === 'coop') {
        // All players lose
        for (const p of this.players) {
          p.alive = false
          p.finished = true
        }
        this.phase = 'finished'
        // Send all mine positions to all players
        const fullVisible = boardToVisible(this.sharedBoard!, true)
        this.broadcast({ type: 'board_update', payload: { cells: fullVisible } })
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId: undefined,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: false,
              finished: true,
              finishTime: null,
              startTime: this.startedAt!,
            })),
            reason: 'coop_mine',
          },
        })
        return
      }

      // Send mine reveal to all (battle) or just the player (race)
      if (this.mode === 'battle') {
        this.broadcast({ type: 'board_update', payload: { cells } })
      } else {
        this.sendTo(playerId, { type: 'board_update', payload: { cells } })
      }

      this.broadcastPlayerUpdate(player)

      // Check if battle is over
      if (this.mode === 'battle') {
        const alive = this.players.filter(p => p.alive)
        if (alive.length <= 1) {
          this.phase = 'finished'
          this.broadcast({
            type: 'game_over',
            payload: {
              winnerId: alive[0]?.id,
              players: this.players.map(p => ({
                playerId: p.id,
                alive: p.alive,
                finished: p.finished,
                finishTime: p.finishTime,
                startTime: this.startedAt!,
              })),
              reason: alive.length === 0 ? 'all_eliminated' : 'win_clear',
            },
          })
        }
      } else {
        // race: check if all eliminated/finished
        this.checkRaceComplete()
      }
      return
    }

    // Normal reveal — count safe cells revealed
    let safeCount = 0
    for (const c of cells) {
      if (c.adjacentMines > 0 || c.adjacentMines === 0) safeCount++ // count non-mine reveals
    }
    player.cellsRevealed += safeCount

    if (this.mode === 'race') {
      this.sendTo(playerId, { type: 'board_update', payload: { cells } })
    } else {
      this.broadcast({ type: 'board_update', payload: { cells } })
    }

    this.broadcastPlayerUpdate(player)

    // Check win
    if (checkWin(board, this.config)) {
      player.finished = true
      player.finishTime = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0

      if (this.mode === 'battle') {
        // Board cleared with no mines hit — compare cellsRevealed to determine winner
        for (const p of this.players) {
          if (!p.finished) p.finished = true
          if (p.finishTime == null) p.finishTime = player.finishTime
        }
        this.phase = 'finished'
        const alivePlayers = this.players.filter(p => p.alive)
        const maxRevealed = Math.max(...alivePlayers.map(p => p.cellsRevealed))
        const topPlayers = alivePlayers.filter(p => p.cellsRevealed === maxRevealed)
        const winnerId = topPlayers.length === 1 ? topPlayers[0].id : undefined
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: p.alive,
              finished: p.finished,
              finishTime: p.finishTime,
              startTime: this.startedAt!,
            })),
            reason: winnerId ? 'win_clear' : 'tie',
          },
        })
      } else if (this.mode === 'race') {
        this.broadcastPlayerUpdate(player)
        this.checkRaceComplete()
      } else {
        // coop: everyone wins
        for (const p of this.players) {
          p.finished = true
          p.finishTime = player.finishTime
        }
        this.phase = 'finished'
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId: undefined,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: true,
              finished: true,
              finishTime: p.finishTime,
              startTime: this.startedAt!,
            })),
            reason: 'coop_complete',
          },
        })
      }
    }
  }

  handleChord(playerId: string, x: number, y: number): void {
    if (this.phase !== 'playing') return

    const player = this.players.find(p => p.id === playerId)
    if (!player || !player.alive || player.finished) return

    const board = this.mode === 'race'
      ? this.boards.get(playerId)!
      : this.sharedBoard!

    if (!board) return

    const cell = board[y]?.[x]
    if (!cell || !cell.revealed || cell.mine || cell.adjacentMines === 0) return

    // Count adjacent flags
    let adjacentFlags = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < this.config.width && ny >= 0 && ny < this.config.height && board[ny][nx].flagged) {
          adjacentFlags++
        }
      }
    }

    if (adjacentFlags !== cell.adjacentMines) return

    // Reveal all non-flagged, non-revealed adjacent cells
    const allRevealed: CellVisible[] = []
    let hitMine = false

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < this.config.width && ny >= 0 && ny < this.config.height) {
          const neighbor = board[ny][nx]
          if (!neighbor.revealed && !neighbor.flagged) {
            const result = revealCell(board, nx, ny, this.config)
            if (result.hitMine) hitMine = true
            allRevealed.push(...result.cells)
          }
        }
      }
    }

    if (allRevealed.length === 0) return

    if (hitMine) {
      player.alive = false
      player.finished = true

      if (this.mode === 'coop') {
        for (const p of this.players) {
          p.alive = false
          p.finished = true
        }
        this.phase = 'finished'
        const fullVisible = boardToVisible(this.sharedBoard!, true)
        this.broadcast({ type: 'board_update', payload: { cells: fullVisible } })
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId: undefined,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: false,
              finished: true,
              finishTime: null,
              startTime: this.startedAt!,
            })),
            reason: 'coop_mine',
          },
        })
        return
      }

      if (this.mode === 'battle') {
        this.broadcast({ type: 'board_update', payload: { cells: allRevealed } })
      } else {
        this.sendTo(playerId, { type: 'board_update', payload: { cells: allRevealed } })
      }

      this.broadcastPlayerUpdate(player)

      if (this.mode === 'battle') {
        const alive = this.players.filter(p => p.alive)
        if (alive.length <= 1) {
          this.phase = 'finished'
          this.broadcast({
            type: 'game_over',
            payload: {
              winnerId: alive[0]?.id,
              players: this.players.map(p => ({
                playerId: p.id,
                alive: p.alive,
                finished: p.finished,
                finishTime: p.finishTime,
                startTime: this.startedAt!,
              })),
              reason: alive.length === 0 ? 'all_eliminated' : 'win_clear',
            },
          })
        }
      } else {
        this.checkRaceComplete()
      }
      return
    }

    // Count safe cells revealed via chord
    let safeCount = 0
    for (const c of allRevealed) {
      if (c.adjacentMines > 0 || c.adjacentMines === 0) safeCount++
    }
    player.cellsRevealed += safeCount

    if (this.mode === 'race') {
      this.sendTo(playerId, { type: 'board_update', payload: { cells: allRevealed } })
    } else {
      this.broadcast({ type: 'board_update', payload: { cells: allRevealed } })
    }

    this.broadcastPlayerUpdate(player)

    // Check win
    if (checkWin(board, this.config)) {
      player.finished = true
      player.finishTime = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0

      if (this.mode === 'battle') {
        // Board cleared with no mines hit — compare cellsRevealed to determine winner
        for (const p of this.players) {
          if (!p.finished) p.finished = true
          if (p.finishTime == null) p.finishTime = player.finishTime
        }
        this.phase = 'finished'
        const alivePlayers = this.players.filter(p => p.alive)
        const maxRevealed = Math.max(...alivePlayers.map(p => p.cellsRevealed))
        const topPlayers = alivePlayers.filter(p => p.cellsRevealed === maxRevealed)
        const winnerId = topPlayers.length === 1 ? topPlayers[0].id : undefined
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: p.alive,
              finished: p.finished,
              finishTime: p.finishTime,
              startTime: this.startedAt!,
            })),
            reason: winnerId ? 'win_clear' : 'tie',
          },
        })
      } else if (this.mode === 'race') {
        this.broadcastPlayerUpdate(player)
        this.checkRaceComplete()
      } else {
        for (const p of this.players) {
          p.finished = true
          p.finishTime = player.finishTime
        }
        this.phase = 'finished'
        this.broadcast({
          type: 'game_over',
          payload: {
            winnerId: undefined,
            players: this.players.map(p => ({
              playerId: p.id,
              alive: true,
              finished: true,
              finishTime: p.finishTime,
              startTime: this.startedAt!,
            })),
            reason: 'coop_complete',
          },
        })
      }
    }
  }

  handleFlag(playerId: string, x: number, y: number): void {
    if (this.phase !== 'playing') return

    const player = this.players.find(p => p.id === playerId)
    if (!player || !player.alive || player.finished) return

    const board = this.mode === 'race'
      ? this.boards.get(playerId)!
      : this.sharedBoard!

    if (!board) return

    const cell = board[y]?.[x]
    if (!cell || cell.revealed) return

    const wasFlagged = cell.flagged
    const newFlagged = toggleFlag(board, x, y)

    if (wasFlagged !== newFlagged) {
      player.flagsPlaced += newFlagged ? 1 : -1
    }

    const cellUpdate: CellVisible = {
      x, y,
      revealed: cell.revealed,
      flagged: cell.flagged,
      adjacentMines: cell.adjacentMines,
    }

    if (this.mode === 'race') {
      this.sendTo(playerId, { type: 'board_update', payload: { cells: [cellUpdate] } })
    } else {
      this.broadcast({ type: 'board_update', payload: { cells: [cellUpdate] } })
    }

    this.broadcastPlayerUpdate(player)
  }

  resetForRematch(): void {
    this.phase = 'waiting'
    this.startedAt = null
    this.sharedBoard = null
    this.boards.clear()
    this.mineLayout = []
    this.firstClickDone = false
    this.raceFirstClicks.clear()

    for (const p of this.players) {
      p.alive = true
      p.finished = false
      p.finishTime = null
      p.flagsPlaced = 0
      p.cellsRevealed = 0
    }

    this.broadcast({
      type: 'state',
      payload: {
        roomId: this.id,
        mode: this.mode,
        difficulty: this.difficulty,
        phase: this.phase,
        players: this.players,
        creatorId: this.creatorId,
      },
    })
  }

  getSummary(): RoomSummary {
    return {
      roomId: this.id,
      mode: this.mode,
      difficulty: this.difficulty,
      playerCount: this.players.length,
      maxPlayers: this.mode === 'coop' ? 4 : 2,
      phase: this.phase,
    }
  }

  private checkRaceComplete(): void {
    const allDone = this.players.every(p => p.finished)
    if (allDone) {
      this.phase = 'finished'
      this.broadcast({
        type: 'game_over',
        payload: {
          winnerId: this.players
            .filter(p => p.alive)
            .sort((a, b) => (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity))[0]?.id,
          players: this.players.map(p => ({
            playerId: p.id,
            alive: p.alive,
            finished: p.finished,
            finishTime: p.finishTime,
            startTime: this.startedAt!,
          })),
          reason: 'win_speed',
        },
      })
    }
  }

  private broadcastPlayerUpdate(player: Player): void {
    this.broadcast({
      type: 'player_update',
      payload: {
        playerId: player.id,
        flagsPlaced: player.flagsPlaced,
        cellsRevealed: player.cellsRevealed,
        alive: player.alive,
        finished: player.finished,
        finishTime: player.finishTime,
      },
    })
  }

  sendTo(playerId: string, msg: ServerMessage): void {
    const ws = this.sockets.get(playerId)
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(msg))
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg)
    for (const ws of this.sockets.values()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data)
      }
    }
  }

  private emptyBoard(config: DifficultyConfig): CellState[][] {
    const board: CellState[][] = []
    for (let y = 0; y < config.height; y++) {
      board[y] = []
      for (let x = 0; x < config.width; x++) {
        board[y][x] = { x, y, mine: false, revealed: false, flagged: false, adjacentMines: 0 }
      }
    }
    return board
  }

  private placeMinesInBoard(board: CellState[][], config: DifficultyConfig, safeX: number, safeY: number): void {
    // Exclude 3x3 safe zone (standard since Windows Vista)
    const safeZone = new Set<string>()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = safeX + dx
        const ny = safeY + dy
        if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
          safeZone.add(`${nx},${ny}`)
        }
      }
    }

    const positions: { x: number; y: number }[] = []
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        if (!safeZone.has(`${x},${y}`)) {
          positions.push({ x, y })
        }
      }
    }
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[positions[i], positions[j]] = [positions[j], positions[i]]
    }

    const mineCount = Math.min(config.mines, positions.length)
    for (let i = 0; i < mineCount; i++) {
      const { x, y } = positions[i]
      board[y][x].mine = true
    }

    // Recompute adjacent mine counts
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
  }

  // Race mode: use shared mineLayout, skipping mines in the player's safe zone.
  // Pad with extra random mines to maintain the correct mine count.
  private placeMinesFromLayout(board: CellState[][], config: DifficultyConfig, safeX: number, safeY: number): void {
    const safeZone = new Set<string>()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = safeX + dx
        const ny = safeY + dy
        if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
          safeZone.add(`${nx},${ny}`)
        }
      }
    }

    // Place mines from the shared layout, skipping safe zone
    let placed = 0
    for (const { x, y } of this.mineLayout) {
      if (!safeZone.has(`${x},${y}`)) {
        board[y][x].mine = true
        placed++
      }
    }

    // If some mines were in the safe zone, pad with random ones outside safe zone
    if (placed < config.mines) {
      const need = config.mines - placed
      const candidates: { x: number; y: number }[] = []
      for (let y = 0; y < config.height; y++) {
        for (let x = 0; x < config.width; x++) {
          if (!board[y][x].mine && !safeZone.has(`${x},${y}`)) {
            candidates.push({ x, y })
          }
        }
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
      }
      for (let i = 0; i < Math.min(need, candidates.length); i++) {
        const { x, y } = candidates[i]
        board[y][x].mine = true
      }
    }

    // Recompute adjacent mine counts
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
  }
}
