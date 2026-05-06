export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode = 'battle' | 'race' | 'coop'
export type GamePhase = 'waiting' | 'playing' | 'finished'

export interface DifficultyConfig {
  width: number
  height: number
  mines: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy:   { width: 9,  height: 9,  mines: 10 },
  medium: { width: 16, height: 16, mines: 40 },
  hard:   { width: 30, height: 16, mines: 99 },
}

export interface CellVisible {
  x: number
  y: number
  revealed: boolean
  flagged: boolean
  adjacentMines: number
  mine?: boolean
}

export interface Player {
  id: string
  name: string
  roomId: string
  flagsPlaced: number
  cellsRevealed: number
  alive: boolean
  finished: boolean
  finishTime: number | null
}

export interface RoomSummary {
  roomId: string
  mode: GameMode
  difficulty: Difficulty
  playerCount: number
  maxPlayers: number
  phase: GamePhase
}

export type ClientMessage =
  | { type: 'create_room';  payload: { mode: GameMode; difficulty: Difficulty; playerName: string } }
  | { type: 'join_room';    payload: { roomId: string; playerName: string } }
  | { type: 'leave_room';   payload: { roomId: string } }
  | { type: 'start_game';   payload: { roomId: string } }
  | { type: 'reveal_cell';  payload: { roomId: string; x: number; y: number } }
  | { type: 'flag_cell';    payload: { roomId: string; x: number; y: number } }
  | { type: 'chord_cell';   payload: { roomId: string; x: number; y: number } }
  | { type: 'rematch';      payload: { roomId: string } }
  | { type: 'get_rooms' }

export type ServerMessage =
  | { type: 'room_created';  payload: { roomId: string } }
  | { type: 'room_joined';   payload: { roomId: string; players: Player[] } }
  | { type: 'player_joined'; payload: { player: Player } }
  | { type: 'player_left';   payload: { playerId: string } }
  | { type: 'rooms_list';    payload: { rooms: RoomSummary[] } }
  | { type: 'game_started';  payload: { board: CellVisible[]; config: DifficultyConfig; mode: GameMode; players: Player[] } }
  | { type: 'board_update';  payload: { cells: CellVisible[] } }
  | { type: 'player_update'; payload: { playerId: string; flagsPlaced: number; cellsRevealed: number; alive: boolean; finished: boolean; finishTime: number | null } }
  | { type: 'game_over';     payload: { winnerId?: string; players: { playerId: string; alive: boolean; finished: boolean; finishTime: number | null; startTime: number }[]; reason: string } }
  | { type: 'error';         payload: { message: string } }
  | { type: 'state';         payload: { roomId: string; mode: GameMode; difficulty: Difficulty; phase: GamePhase; players: Player[]; creatorId: string } }
