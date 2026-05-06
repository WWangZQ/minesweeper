import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { wsClient } from '../services/wsClient'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import type { Player } from '../types'

const AVATAR_COLORS = [
  'bg-amber-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-pink-500', 'bg-teal-500', 'bg-orange-600', 'bg-indigo-500',
]

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const playerId = useLobbyStore((s) => s.playerId)

  const [players, setPlayers] = useState<Player[]>([])
  const [mode, setMode] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [creatorId, setCreatorId] = useState('')

  const setMyPlayerId = useGameStore((s) => s.setMyPlayerId)
  const setRoomId = useGameStore((s) => s.setRoomId)
  const initBoard = useGameStore((s) => s.initBoard)
  const setConfig = useGameStore((s) => s.setConfig)
  const setGameMode = useGameStore((s) => s.setMode)
  const setGamePlayers = useGameStore((s) => s.setPlayers)
  const startTimer = useGameStore((s) => s.startTimer)
  const setPhase = useGameStore((s) => s.setPhase)
  const myPlayerId = useGameStore((s) => s.myPlayerId)

  useEffect(() => {
    setRoomId(roomId || '')

    function handleRoomJoined(payload: any) {
      if (payload.roomId === roomId) {
        setPlayers(payload.players)
        setGamePlayers(payload.players)
      }
    }

    function handlePlayerJoined(payload: any) {
      setPlayers((prev) => [...prev.filter(p => p.id !== payload.player.id), payload.player])
      setGamePlayers([...players, payload.player])
    }

    function handlePlayerLeft(payload: any) {
      setPlayers((prev) => prev.filter(p => p.id !== payload.playerId))
      setGamePlayers(players.filter(p => p.id !== payload.playerId))
    }

    function handleGameStarted(payload: any) {
      initBoard(payload.board, payload.config)
      setConfig(payload.config)
      setGameMode(payload.mode)
      setGamePlayers(payload.players)
      setPhase('playing')
      startTimer()
      navigate(`/game/${roomId}`)
    }

    function handleState(payload: any) {
      if (payload.roomId === roomId) {
        setPlayers(payload.players)
        setMode(payload.mode)
        setDifficulty(payload.difficulty)
        setCreatorId(payload.creatorId)
        setPhase(payload.phase)
      }
    }

    function handleError(payload: any) {
      toast.error(payload.message)
    }

    wsClient.on('room_joined', handleRoomJoined)
    wsClient.on('player_joined', handlePlayerJoined)
    wsClient.on('player_left', handlePlayerLeft)
    wsClient.on('game_started', handleGameStarted)
    wsClient.on('state', handleState)
    wsClient.on('error', handleError)

    // Set my player ID from lobby store
    setMyPlayerId(playerId)

    return () => {
      wsClient.off('room_joined', handleRoomJoined)
      wsClient.off('player_joined', handlePlayerJoined)
      wsClient.off('player_left', handlePlayerLeft)
      wsClient.off('game_started', handleGameStarted)
      wsClient.off('state', handleState)
      wsClient.off('error', handleError)
    }
  }, [roomId, playerId])

  function handleStartGame() {
    wsClient.send({ type: 'start_game', payload: { roomId: roomId! } })
  }

  function handleLeaveRoom() {
    wsClient.send({ type: 'leave_room', payload: { roomId: roomId! } })
    navigate('/')
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomId || '').then(() => {
      toast.success('房间码已复制')
    })
  }

  const modeLabels: Record<string, string> = { battle: '实时对战', race: '竞速比拼', coop: '合作模式' }
  const diffLabels: Record<string, string> = { easy: '初级', medium: '中级', hard: '高级' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-warm-surface border border-warm-border rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col gap-5">
        <h1 className="text-xl font-bold text-center text-warm-text">等待开始</h1>

        {/* Room code */}
        <div className="text-center">
          <button
            onClick={handleCopyCode}
            className="text-4xl font-mono font-bold text-warm-accent hover:text-warm-accent-hover transition-colors tracking-widest"
          >
            {roomId}
          </button>
          <p className="text-xs text-warm-text-muted mt-1">点击复制房间码</p>
        </div>

        {/* Mode & difficulty badges */}
        <div className="flex justify-center gap-2">
          {mode && (
            <span className="px-3 py-1 text-xs font-semibold bg-warm-accent-soft text-warm-accent rounded-full border border-warm-accent-glow">
              {modeLabels[mode] || mode}
            </span>
          )}
          {difficulty && (
            <span className="px-3 py-1 text-xs font-semibold bg-warm-surface2 text-warm-text-dim rounded-full border border-warm-border">
              {diffLabels[difficulty] || difficulty}
            </span>
          )}
        </div>

        {/* Players */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-warm-text-dim">玩家 ({players.length}/{mode === 'coop' ? 4 : 2})</h3>
          {players.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-lg
                ${p.id === playerId ? 'bg-warm-accent-soft' : 'bg-warm-surface2'}`}
            >
              <div className={`w-9 h-9 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]}
                              flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-sm">
                {p.name}
                {p.id === creatorId && <span className="text-[10px] text-warm-accent ml-1">房主</span>}
              </span>
              {p.id === playerId && <span className="text-[10px] text-warm-text-muted ml-auto">我</span>}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleLeaveRoom}
            className="flex-1 py-2.5 border border-warm-border rounded-xl font-semibold text-sm
                       text-warm-text-dim hover:bg-warm-surface2 transition-colors"
          >
            离开房间
          </button>
          {playerId === creatorId && (
            <button
              onClick={handleStartGame}
              className="flex-1 py-2.5 bg-warm-accent hover:bg-warm-accent-hover text-white
                         rounded-xl font-semibold text-sm transition-all shadow-md
                         active:scale-[0.98]"
            >
              开始游戏
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
