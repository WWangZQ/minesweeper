import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsClient } from '../services/wsClient'
import { useLobbyStore } from '../stores/lobbyStore'
import type { Difficulty, GameMode, RoomSummary, ServerMessage } from '../types'

const MODES: { key: GameMode; label: string; desc: string }[] = [
  { key: 'battle', label: '实时对战', desc: '同棋盘抢格子' },
  { key: 'race',   label: '竞速比拼', desc: '同雷局比速度' },
  { key: 'coop',   label: '合作模式', desc: '协力排雷通关' },
]

const DIFF_OPTIONS: { key: Difficulty; label: string }[] = [
  { key: 'easy',   label: '9×9 初级' },
  { key: 'medium', label: '16×16 中级' },
  { key: 'hard',   label: '30×16 高级' },
]

export default function LobbyPage() {
  useWebSocket()

  const navigate = useNavigate()
  const playerName = useLobbyStore((s) => s.playerName)
  const setPlayerName = useLobbyStore((s) => s.setPlayerName)
  const setPlayerId = useLobbyStore((s) => s.setPlayerId)
  const rooms = useLobbyStore((s) => s.rooms)
  const setRooms = useLobbyStore((s) => s.setRooms)
  const connectionStatus = useLobbyStore((s) => s.connectionStatus)

  const [mode, setMode] = useState<GameMode>('battle')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [joinCode, setJoinCode] = useState('')
  const [nameInput, setNameInput] = useState(playerName)

  useEffect(() => {
    function handleRoomsList(payload: any) {
      setRooms(payload.rooms)
    }
    function handleRoomCreated(payload: any) {
      setPlayerId(payload.myPlayerId)
      navigate(`/room/${payload.roomId}`, {
        state: {
          mode: payload.mode,
          difficulty: payload.difficulty,
          players: payload.players,
          creatorId: payload.creatorId,
          myPlayerId: payload.myPlayerId,
        },
      })
    }
    function handleRoomJoined(payload: any) {
      setPlayerId(payload.myPlayerId)
      navigate(`/room/${payload.roomId}`, {
        state: {
          mode: payload.mode,
          difficulty: payload.difficulty,
          players: payload.players,
          creatorId: payload.creatorId,
          myPlayerId: payload.myPlayerId,
        },
      })
    }
    function handleError(payload: any) {
      toast.error(payload.message)
    }
    function handleSendFailed() {
      toast.error('服务器未连接，请检查网络后刷新页面')
    }

    wsClient.on('rooms_list', handleRoomsList)
    wsClient.on('room_created', handleRoomCreated)
    wsClient.on('room_joined', handleRoomJoined)
    wsClient.on('error', handleError)
    wsClient.on('send_failed', handleSendFailed)

    // Request room list, refresh every 5s
    wsClient.send({ type: 'get_rooms' })
    const interval = setInterval(() => {
      wsClient.send({ type: 'get_rooms' })
    }, 5000)

    return () => {
      wsClient.off('rooms_list', handleRoomsList)
      wsClient.off('room_created', handleRoomCreated)
      wsClient.off('room_joined', handleRoomJoined)
      wsClient.off('error', handleError)
      wsClient.off('send_failed', handleSendFailed)
      clearInterval(interval)
    }
  }, [navigate])

  function handleCreateRoom() {
    const name = nameInput.trim()
    if (!name) {
      toast.error('请先输入昵称')
      return
    }
    setPlayerName(name)
    wsClient.send({
      type: 'create_room',
      payload: { mode, difficulty, playerName: name },
    })
  }

  function handleJoinRoom(roomId: string) {
    const name = nameInput.trim()
    if (!name) {
      toast.error('请先输入昵称')
      return
    }
    setPlayerName(name)
    wsClient.send({
      type: 'join_room',
      payload: { roomId: roomId.toUpperCase(), playerName: name },
    })
  }

  const modeLabels: Record<string, string> = { battle: '实时', race: '竞速', coop: '合作' }
  const diffLabels: Record<string, string> = { easy: '初级', medium: '中级', hard: '高级' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-warm-surface border border-warm-border rounded-2xl shadow-lg p-8 w-full max-w-lg flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-center text-warm-text">💣 扫雷对战</h1>

        {/* Connection status */}
        <div className="text-center text-xs">
          {connectionStatus === 'connected' ? (
            <span className="text-green-600">已连接</span>
          ) : connectionStatus === 'connecting' ? (
            <span className="text-amber-500">连接中...</span>
          ) : (
            <span className="text-red-500">连接失败，刷新页面重试</span>
          )}
        </div>

        {/* Name input */}
        <div>
          <label className="text-sm font-semibold text-warm-text-dim block mb-1">你的昵称</label>
          <input
            className="w-full px-4 py-2 rounded-lg border border-warm-border bg-warm-surface2 text-warm-text
                       focus:outline-none focus:border-warm-accent transition-colors text-sm"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="输入昵称"
            maxLength={12}
          />
        </div>

        {/* Mode selector */}
        <div>
          <label className="text-sm font-semibold text-warm-text-dim block mb-2">游戏模式</label>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all border
                  ${mode === m.key
                    ? 'bg-warm-accent border-warm-accent text-white shadow-sm'
                    : 'bg-warm-surface2 border-warm-border text-warm-text-dim hover:text-warm-text'
                  }`}
                onClick={() => setMode(m.key)}
              >
                <div>{m.label}</div>
                <div className="text-[10px] opacity-70">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty selector */}
        <div>
          <label className="text-sm font-semibold text-warm-text-dim block mb-2">难度</label>
          <div className="flex gap-2">
            {DIFF_OPTIONS.map((d) => (
              <button
                key={d.key}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border
                  ${difficulty === d.key
                    ? 'bg-warm-accent border-warm-accent text-white shadow-sm'
                    : 'bg-warm-surface2 border-warm-border text-warm-text-dim hover:text-warm-text'
                  }`}
                onClick={() => setDifficulty(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreateRoom}
          className="w-full py-3 bg-warm-accent hover:bg-warm-accent-hover text-white font-semibold
                     rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          创建房间
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-warm-border" />
          <span className="text-xs text-warm-text-muted">或加入已有房间</span>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        {/* Join input */}
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-2 rounded-lg border border-warm-border bg-warm-surface2 text-warm-text
                       focus:outline-none focus:border-warm-accent transition-colors text-sm uppercase placeholder:lowercase"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.slice(0, 4))}
            placeholder="4位房间码"
            maxLength={4}
          />
          <button
            onClick={() => joinCode.length === 4 && handleJoinRoom(joinCode)}
            disabled={joinCode.length !== 4}
            className="px-6 py-2 bg-warm-accent hover:bg-warm-accent-hover text-white font-semibold
                       rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            加入
          </button>
        </div>

        {/* Room list */}
        {rooms.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-warm-text-dim mb-3">可加入的房间</h3>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="flex items-center justify-between bg-warm-surface2 border border-warm-border
                             rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold text-warm-accent">{r.roomId}</span>
                    <span className="text-xs text-warm-text-dim">
                      {modeLabels[r.mode]} · {diffLabels[r.difficulty]} · {r.playerCount}/{r.maxPlayers}
                    </span>
                    {r.phase === 'playing' && (
                      <span className="text-[10px] text-red-500 font-semibold">游戏中</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleJoinRoom(r.roomId)}
                    disabled={r.phase === 'playing' || r.playerCount >= r.maxPlayers}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-warm-accent
                               text-warm-accent hover:bg-warm-accent-soft transition-all
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {r.phase === 'playing' ? '观战中' : '加入'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rooms.length === 0 && (
          <p className="text-center text-sm text-warm-text-muted py-2">暂无房间，创建一个吧</p>
        )}

        {/* Classic mode link */}
        <div className="text-center pt-2 border-t border-warm-border">
          <a
            href="#/solo"
            className="text-sm text-warm-text-dim hover:text-warm-accent transition-colors underline"
          >
            无需联网？试试经典单人模式
          </a>
        </div>
      </div>
    </div>
  )
}
