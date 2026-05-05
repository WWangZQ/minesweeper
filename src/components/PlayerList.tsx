import { useGameStore } from '../stores/gameStore'

const AVATAR_COLORS = [
  'bg-amber-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-pink-500', 'bg-teal-500', 'bg-orange-600', 'bg-indigo-500',
]

export default function PlayerList() {
  const players = useGameStore((s) => s.players)
  const myPlayerId = useGameStore((s) => s.myPlayerId)

  return (
    <div className="w-52 bg-white border border-[#e8ddcc] rounded-lg p-4
                    shadow-sm flex flex-col gap-1 flex-shrink-0">
      <h3 className="text-sm font-semibold text-[#8b8070] mb-1">
        玩家 ({players.length}/8)
      </h3>
      {players.map((p, i) => {
        const isMe = p.id === myPlayerId
        const statusColor = !p.alive
          ? 'bg-red-500'
          : p.finished
            ? 'bg-yellow-500'
            : 'bg-green-500'

        const statusLabel = !p.alive
          ? '已出局'
          : p.finished && p.finishTime != null
            ? `${p.finishTime.toFixed(1)}s`
            : '游戏中'

        return (
          <div
            key={p.id}
            className={`flex items-center gap-2 p-2 rounded-md
              ${isMe ? 'bg-[#f5f0e8]' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]}
                          flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {p.name}
                {isMe && <span className="text-[10px] text-[#b8a890] ml-1">我</span>}
              </div>
              <div className="flex items-center gap-1 text-xs text-[#8b8070]">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                {statusLabel}
              </div>
            </div>
            <div className="text-[10px] text-[#8b8070] text-right leading-tight">
              <div>🚩{p.flagsPlaced}</div>
              <div>📂{p.cellsRevealed}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
