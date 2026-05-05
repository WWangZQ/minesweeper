import { useGameStore } from '../stores/gameStore'

export default function Header() {
  const config = useGameStore((s) => s.config)
  const mode = useGameStore((s) => s.mode)
  const alive = useGameStore((s) => s.alive)
  const phase = useGameStore((s) => s.phase)
  const flagsPlaced = useGameStore((s) => s.flagsPlaced)
  const elapsed = useGameStore((s) => s.elapsedSeconds)
  const finished = useGameStore((s) => s.finished)

  const remaining = config ? config.mines - flagsPlaced : 0

  let faceEmoji = '🙂'
  if (phase === 'finished') {
    faceEmoji = (alive && finished) ? '😎' : '😵'
  }

  const modeLabel = mode === 'battle' ? '实时对战' : mode === 'race' ? '竞速比拼' : '合作模式'
  const diffLabel = config ? `${config.width}×${config.height} ${config.mines}雷` : ''

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="flex items-center justify-between w-full gap-4 flex-wrap px-2">
      <span className="text-[#8b8070] text-sm font-semibold">
        {modeLabel} · {diffLabel}
      </span>
      <div className="flex items-center gap-3">
        {/* Mine counter */}
        <div className="flex items-center gap-2 bg-[#f5f0e8] border border-[#e8ddcc]
                        rounded-lg px-3 py-2 font-mono">
          <span className="text-base">💣</span>
          <span className="text-xl font-bold text-[#d97706] min-w-[28px] text-center tabular-nums">
            {remaining}
          </span>
        </div>

        {/* Face */}
        <button
          className="w-[46px] h-[46px] rounded-lg border border-[#e8ddcc]
                     bg-[#f5f0e8] text-[26px] flex items-center justify-center leading-none
                     hover:bg-[#e8ddcc] active:scale-95 transition-all"
        >
          {faceEmoji}
        </button>

        {/* Timer */}
        <div className="flex items-center gap-2 bg-[#f5f0e8] border border-[#e8ddcc]
                        rounded-lg px-3 py-2 font-mono">
          <span className="text-base">⏱</span>
          <span className="text-xl font-bold text-[#d97706] min-w-[50px] text-center tabular-nums">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  )
}
