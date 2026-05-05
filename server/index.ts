import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { GameRoom } from './GameRoom.js'
import type { ClientMessage, ServerMessage } from './types.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const IS_PROD = existsSync(join(process.cwd(), 'dist'))

// MIME types for static file serving
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function serveStatic(reqUrl: string): { body: Buffer | string; mime: string; status: number } | null {
  // Only handle GET/HEAD
  let pathname = reqUrl.split('?')[0]
  if (pathname === '/') pathname = '/index.html'

  const filePath = join(process.cwd(), 'dist', pathname)

  // Security: prevent directory traversal
  if (!filePath.startsWith(join(process.cwd(), 'dist'))) return null

  if (!existsSync(filePath)) {
    // SPA fallback: return index.html for unknown routes
    const fallback = join(process.cwd(), 'dist', 'index.html')
    if (existsSync(fallback)) {
      return { body: readFileSync(fallback), mime: 'text/html; charset=utf-8', status: 200 }
    }
    return null
  }

  const ext = extname(filePath).toLowerCase()
  return {
    body: readFileSync(filePath),
    mime: MIME[ext] || 'application/octet-stream',
    status: 200,
  }
}

const server = createServer((req, res) => {
  // WebSocket upgrade is handled by ws library, skip here
  if (req.headers.upgrade?.toLowerCase() === 'websocket') return

  if (IS_PROD) {
    const result = serveStatic(req.url || '/')
    if (result) {
      res.writeHead(result.status, { 'Content-Type': result.mime })
      res.end(result.body)
      return
    }
  }

  // Health / fallback
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(IS_PROD ? 'OK' : 'Minesweeper dev mode — use "npm run dev" for the Vite frontend')
})

const wss = new WebSocketServer({ server })
const rooms = new Map<string, GameRoom>()

interface ConnMeta {
  connId: string
  playerId: string
  roomId: string | null
}

const connections = new Map<WebSocket, ConnMeta>()

function generateRoomCode(): string {
  for (let i = 0; i < 10; i++) {
    const code = uuidv4().slice(0, 4).toUpperCase()
    if (!rooms.has(code)) return code
  }
  return uuidv4().slice(0, 4).toUpperCase()
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  const conn = connections.get(ws)
  if (!conn) return

  switch (msg.type) {
    case 'create_room': {
      const roomId = generateRoomCode()
      const room = new GameRoom(roomId, msg.payload.mode, msg.payload.difficulty)
      const player = room.addPlayer(ws, msg.payload.playerName)
      rooms.set(roomId, room)
      conn.playerId = player.id
      conn.roomId = roomId

      send(ws, { type: 'room_created', payload: { roomId } })
      send(ws, { type: 'room_joined', payload: { roomId, players: room.players } })
      break
    }

    case 'join_room': {
      const room = rooms.get(msg.payload.roomId)
      if (!room) { send(ws, { type: 'error', payload: { message: '房间不存在' } }); return }
      if (room.players.length >= 8) { send(ws, { type: 'error', payload: { message: '房间已满' } }); return }
      if (room.phase === 'playing') { send(ws, { type: 'error', payload: { message: '游戏已开始' } }); return }

      const player = room.addPlayer(ws, msg.payload.playerName)
      conn.playerId = player.id
      conn.roomId = msg.payload.roomId

      send(ws, { type: 'room_joined', payload: { roomId: room.id, players: room.players } })
      room.broadcast({ type: 'player_joined', payload: { player } })
      break
    }

    case 'leave_room': {
      const room = rooms.get(msg.payload.roomId)
      if (room && conn.playerId) {
        room.removePlayer(conn.playerId)
        room.broadcast({ type: 'player_left', payload: { playerId: conn.playerId } })
        if (room.players.length === 0) {
          const rid = msg.payload.roomId
          setTimeout(() => { const r = rooms.get(rid); if (r && r.players.length === 0) rooms.delete(rid) }, 300000)
        }
      }
      conn.roomId = null
      conn.playerId = ''
      break
    }

    case 'start_game': {
      const room = rooms.get(msg.payload.roomId)
      if (!room) { send(ws, { type: 'error', payload: { message: '房间不存在' } }); return }
      if (conn.playerId !== room.creatorId) { send(ws, { type: 'error', payload: { message: '只有房主可以开始游戏' } }); return }
      if (room.phase === 'playing') { send(ws, { type: 'error', payload: { message: '游戏已经开始' } }); return }
      room.startGame()
      break
    }

    case 'reveal_cell': {
      const room = rooms.get(msg.payload.roomId)
      if (!room) { send(ws, { type: 'error', payload: { message: '房间不存在' } }); return }
      room.handleReveal(conn.playerId, msg.payload.x, msg.payload.y)
      break
    }

    case 'flag_cell': {
      const room = rooms.get(msg.payload.roomId)
      if (!room) { send(ws, { type: 'error', payload: { message: '房间不存在' } }); return }
      room.handleFlag(conn.playerId, msg.payload.x, msg.payload.y)
      break
    }

    case 'rematch': {
      const room = rooms.get(msg.payload.roomId)
      if (!room) { send(ws, { type: 'error', payload: { message: '房间不存在' } }); return }
      room.resetForRematch()
      break
    }

    case 'get_rooms': {
      const roomSummaries = Array.from(rooms.values()).map(r => r.getSummary())
      send(ws, { type: 'rooms_list', payload: { rooms: roomSummaries } })
      break
    }
  }
}

wss.on('connection', (ws) => {
  const connId = uuidv4()
  connections.set(ws, { connId, playerId: '', roomId: null })

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString())
      handleMessage(ws, msg)
    } catch {
      send(ws, { type: 'error', payload: { message: '无效消息格式' } })
    }
  })

  ws.on('close', () => {
    const conn = connections.get(ws)
    if (conn?.roomId && conn.playerId) {
      const room = rooms.get(conn.roomId)
      if (room) {
        room.removePlayer(conn.playerId)
        room.broadcast({ type: 'player_left', payload: { playerId: conn.playerId } })
        const rid = conn.roomId
        setTimeout(() => { const r = rooms.get(rid); if (r && r.players.length === 0) rooms.delete(rid) }, 300000)
      }
    }
    connections.delete(ws)
  })
})

server.listen(PORT, () => {
  console.log(`Minesweeper server on port ${PORT}${IS_PROD ? ' (production mode)' : ' (dev mode)'}`)
})
