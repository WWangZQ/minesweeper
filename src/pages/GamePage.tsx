import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsClient } from '../services/wsClient'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import Board from '../components/Board'
import Header from '../components/Header'
import PlayerList from '../components/PlayerList'
import Overlay from '../components/Overlay'

export default function GamePage() {
  useWebSocket()
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const patchCells = useGameStore((s) => s.patchCells)
  const updatePlayer = useGameStore((s) => s.updatePlayer)
  const setPhase = useGameStore((s) => s.setPhase)
  const stopTimer = useGameStore((s) => s.stopTimer)
  const startTimer = useGameStore((s) => s.startTimer)
  const reset = useGameStore((s) => s.reset)
  const setGameOverPayload = useGameStore((s) => s.setGameOverPayload)
  const setRoomId = useGameStore((s) => s.setRoomId)
  const setPlayers = useGameStore((s) => s.setPlayers)
  const setMyPlayerId = useGameStore((s) => s.setMyPlayerId)
  const setCreatorId = useGameStore((s) => s.setCreatorId)
  const setMode = useGameStore((s) => s.setMode)
  const playerId = useLobbyStore((s) => s.playerId)

  useEffect(() => {
    setRoomId(roomId || '')
    setMyPlayerId(playerId)

    function handleBoardUpdate(payload: any) {
      patchCells(payload.cells)
    }

    function handlePlayerUpdate(payload: any) {
      updatePlayer(payload.playerId, {
        flagsPlaced: payload.flagsPlaced,
        cellsRevealed: payload.cellsRevealed,
        alive: payload.alive,
        finished: payload.finished,
        finishTime: payload.finishTime,
      })
    }

    function handleGameOver(payload: any) {
      setPhase('finished')
      stopTimer()
      setGameOverPayload(payload)
    }

    function handleRematchVote(payload: any) {
      useGameStore.getState().setRematchVote(
        payload.playerId === playerId,
        payload.votes,
        payload.total,
      )
    }

    function handleGameStarted(payload: any) {
      // Already initialized in RoomPage, but handle re-entry
    }

    function handleState(payload: any) {
      if (payload.phase === 'waiting') {
        reset()
        navigate(`/room/${roomId}`, {
          state: {
            players: payload.players,
            mode: payload.mode,
            difficulty: payload.difficulty,
            creatorId: payload.creatorId,
          },
        })
      }
    }

    function handlePlayerLeft(payload: any) {
      if (payload.playerId !== playerId) {
        useGameStore.getState().setOpponentLeft()
      }
    }

    wsClient.on('board_update', handleBoardUpdate)
    wsClient.on('player_update', handlePlayerUpdate)
    wsClient.on('game_over', handleGameOver)
    wsClient.on('game_started', handleGameStarted)
    wsClient.on('state', handleState)
    wsClient.on('rematch_vote', handleRematchVote)
    wsClient.on('player_left', handlePlayerLeft)

    // Start timer if phase is playing
    const currentPhase = useGameStore.getState().phase
    if (currentPhase === 'playing') {
      startTimer()
    }

    return () => {
      wsClient.off('board_update', handleBoardUpdate)
      wsClient.off('player_update', handlePlayerUpdate)
      wsClient.off('game_over', handleGameOver)
      wsClient.off('game_started', handleGameStarted)
      wsClient.off('state', handleState)
      wsClient.off('rematch_vote', handleRematchVote)
      wsClient.off('player_left', handlePlayerLeft)
      stopTimer()
    }
  }, [roomId, playerId])

  return (
    <div className="min-h-screen flex flex-col justify-center p-4 overflow-x-auto">
      <div className="bg-white border border-[#e8ddcc] rounded-2xl shadow-lg p-6 flex flex-col gap-5
                      mx-auto">
        <Header />
        <div className="flex gap-4 items-start max-md:flex-col max-md:items-center">
          <Board />
          <PlayerList />
        </div>
      </div>
      <Overlay />
    </div>
  )
}
