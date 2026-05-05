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
  const setGameOverPayload = useGameStore((s) => s.setGameOverPayload)

  const show = phase === 'finished'

  // Spawn confetti on win
  useEffect(() => {
    if (phase === 'finished' && alive && finished) {
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
  }, [phase, alive, finished])

  function handleRematch() {
    wsClient.send({ type: 'rematch', payload: { roomId } })
    setGameOverPayload(null)
  }

  if (!show) return null

  const won = alive && finished
  let icon = '💣'
  let title = '踩到雷了'
  let subtitle = '别灰心，再来一局吧'
  let titleColor = '#dc2626'

  if (won) {
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
  }

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

        <button
          onClick={handleRematch}
          className="px-8 py-2.5 bg-[#d97706] hover:bg-[#b65f00] text-white
                     rounded-xl font-semibold transition-all shadow-md active:scale-[0.97]"
        >
          再来一局
        </button>
      </div>
    </div>
  )
}
