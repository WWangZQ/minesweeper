import { useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { wsClient } from '../services/wsClient'

export default function Overlay() {
  const phase = useGameStore((s) => s.phase)
  const gameOverPayload = useGameStore((s) => s.gameOverPayload)
  const alive = useGameStore((s) => s.alive)
  const finished = useGameStore((s) => s.finished)
  const finishTime = useGameStore((s) => s.finishTime)
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const mode = useGameStore((s) => s.mode)
  const roomId = useGameStore((s) => s.roomId)
  const myPlayerId = useGameStore((s) => s.myPlayerId)
  const rematchVoted = useGameStore((s) => s.rematchVoted)
  const rematchVotes = useGameStore((s) => s.rematchVotes)
  const rematchTotal = useGameStore((s) => s.rematchTotal)
  const setGameOverPayload = useGameStore((s) => s.setGameOverPayload)

  const show = phase === 'finished'

  // Spawn confetti on win
  useEffect(() => {
    if (phase === 'finished') {
      const isTie = gameOverPayload?.reason === 'tie'
      const isWinner = gameOverPayload?.winnerId === myPlayerId
      const battleWin = mode === 'battle' && alive && gameOverPayload?.reason !== 'win_clear'
      const coopWin = mode === 'coop' && alive && finished
      const raceWin = mode === 'race' && alive && finished
      if (isWinner || battleWin || coopWin || raceWin) {
        const emojis = ['🎉', '✨', '🌟', '💫', '🎊', '🏆', '👏', '🔥', '💯', '⭐']
        const fragments: HTMLSpanElement[] = []
        for (let i = 0; i < 30; i++) {
          const el = document.createElement('span')
          el.className = 'confetti'
          el.textContent = emojis[Math.floor(Math.random() * emojis.length)]
          el.style.left = Math.random() * 100 + '%'
          el.style.top = -(Math.random() * 20 + 10) + 'px'
          el.style.animationDuration = (Math.random() * 2 + 2) + 's'
          el.style.animationDelay = Math.random() * 0.6 + 's'
          document.body.appendChild(el)
          fragments.push(el)
        }
        setTimeout(() => fragments.forEach(el => el.remove()), 3500)
      }
    }
  }, [phase, alive, finished, gameOverPayload, mode, myPlayerId])

  function handleRematch() {
    wsClient.send({ type: 'rematch', payload: { roomId } })
  }

  if (!show) return null

  // Determine win/loss/tie
  const isTie = gameOverPayload?.reason === 'tie'
  const isWinner = gameOverPayload?.winnerId === myPlayerId
  const battleElimWin = mode === 'battle' && alive && gameOverPayload?.reason !== 'win_clear'
  const won = isWinner || battleElimWin || (mode === 'coop' && alive && finished)

  let icon = '💣'
  let title = '踩到雷了'
  let subtitle = '别灰心，再来一局吧'
  let titleColor = '#dc2626'

  if (isTie) {
    icon = '🤝'
    title = '平局！'
    subtitle = '双方不分胜负，再来一局'
    titleColor = '#d97706'
  } else if (won) {
    if (mode === 'coop') {
      icon = '🤝'
      title = '合作胜利！'
      subtitle = `团队用时 ${finishTime?.toFixed(1) ?? elapsedSeconds}s`
    } else {
      icon = '🏆'
      title = '恭喜胜利！'
      subtitle = `用时 ${finishTime?.toFixed(1) ?? elapsedSeconds}s`
    }
    titleColor = '#16a34a'
  } else if (mode === 'coop' && !alive) {
    title = '协作失败'
    subtitle = '队员踩雷，再接再厉！'
  } else if (mode === 'battle' && !alive) {
    icon = '💥'
    title = '踩到雷了'
    subtitle = '对方获胜，再来一局吧'
    titleColor = '#dc2626'
  } else if (mode === 'race' && !alive) {
    icon = '💥'
    title = '踩到雷了'
    subtitle = '对方获胜，再来一局吧'
    titleColor = '#dc2626'
  } else if (mode === 'battle' && gameOverPayload?.reason === 'win_clear') {
    icon = '📉'
    title = '棋差一着'
    subtitle = '翻开格子数不敌对方，再来一局'
    titleColor = '#dc2626'
  } else if (mode === 'race') {
    icon = '⏱️'
    title = '慢了一步'
    subtitle = '对方更快完成，再来一局'
    titleColor = '#dc2626'
  }

  // Show cellsRevealed comparison for battle mode when board is cleared
  const battleStats = mode === 'battle' && gameOverPayload?.reason === 'win_clear'
    ? gameOverPayload.players.map((p: any) => ({
        ...p,
        cellsRevealed: useGameStore.getState().players.find(pl => pl.id === p.playerId)?.cellsRevealed ?? 0,
        name: useGameStore.getState().players.find(pl => pl.id === p.playerId)?.name ?? '?',
      })).sort((a: any, b: any) => b.cellsRevealed - a.cellsRevealed)
    : null

  return (
    <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50
      transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-white border border-[#e8ddcc] rounded-2xl p-10 text-center
                      shadow-2xl animate-[revealPop_0.4s_ease]">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: titleColor }}>{title}</h2>
        <p className="text-[#8b8070] text-sm mb-6">{subtitle}</p>

        {/* Race results */}
        {mode === 'race' && gameOverPayload && (
          <div className="mb-6 text-left">
            <p className="text-xs font-semibold text-[#8b8070] mb-2">排名</p>
            {gameOverPayload.players
              .filter((p: any) => p.alive)
              .sort((a: any, b: any) => (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity))
              .map((p: any, i: number) => {
                const playerName = useGameStore.getState().players.find(pl => pl.id === p.playerId)?.name || '?'
                return (
                  <div key={p.playerId} className={`flex justify-between text-sm py-1 px-2 rounded
                    ${p.playerId === myPlayerId ? 'bg-amber-50 font-semibold' : ''}`}>
                    <span>{i + 1}. {playerName}</span>
                    <span className="text-[#d97706]">{p.finishTime?.toFixed(1)}s</span>
                  </div>
                )
              })}
          </div>
        )}

        {/* Battle stats when board cleared */}
        {battleStats && (
          <div className="mb-6 text-left">
            <p className="text-xs font-semibold text-[#8b8070] mb-2">翻开格子数</p>
            {battleStats.map((p: any) => (
              <div key={p.playerId} className={`flex justify-between text-sm py-1 px-2 rounded
                ${p.playerId === myPlayerId ? 'bg-amber-50 font-semibold' : ''}`}>
                <span>{p.name}{p.playerId === gameOverPayload?.winnerId ? ' 👑' : ''}</span>
                <span className="text-[#d97706]">{p.cellsRevealed} 格</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleRematch}
          disabled={rematchVoted}
          className="px-8 py-2.5 text-white rounded-xl font-semibold transition-all shadow-md
                     disabled:opacity-60 disabled:cursor-not-allowed
                     bg-[#d97706] hover:bg-[#b65f00] active:scale-[0.97] disabled:active:scale-100"
        >
          {rematchVoted
            ? `等待中 (${rematchVotes}/${rematchTotal})`
            : '再来一局'}
        </button>
      </div>
    </div>
  )
}
