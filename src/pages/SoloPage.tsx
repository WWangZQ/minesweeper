import { useCallback } from 'react'
import { useSoloStore, type SoloCell } from '../stores/soloStore'
import type { Difficulty } from '../types'

const DIFF_OPTIONS: { key: Difficulty; label: string; desc: string }[] = [
  { key: 'easy', label: '初级', desc: '9×9 · 10雷' },
  { key: 'medium', label: '中级', desc: '16×16 · 40雷' },
  { key: 'hard', label: '高级', desc: '30×16 · 99雷' },
]

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-600',
  2: 'text-green-600',
  3: 'text-red-500',
  4: 'text-indigo-700',
  5: 'text-red-700',
  6: 'text-cyan-600',
  7: 'text-gray-900',
  8: 'text-gray-500',
}

function SoloCellView({ cell }: { cell: SoloCell }) {
  const phase = useSoloStore((s) => s.phase)
  const revealCell = useSoloStore((s) => s.revealCell)
  const toggleFlag = useSoloStore((s) => s.toggleFlag)
  const chordReveal = useSoloStore((s) => s.chordReveal)
  const setMouseDown = useSoloStore((s) => s.setMouseDown)

  const handleClick = useCallback(() => {
    if (phase !== 'playing') return
    revealCell(cell.x, cell.y)
  }, [phase, cell.x, cell.y, revealCell])

  const handleDoubleClick = useCallback(() => {
    if (phase !== 'playing') return
    chordReveal(cell.x, cell.y)
  }, [phase, cell.x, cell.y, chordReveal])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (phase !== 'playing') return
      toggleFlag(cell.x, cell.y)
    },
    [phase, cell.x, cell.y, toggleFlag],
  )

  let content: React.ReactNode = null
  let extraClasses = ''

  if (cell.revealed) {
    if (cell.mine) {
      content = '💣'
      extraClasses = 'bg-red-50 border-red-500'
    } else if (cell.adjacentMines > 0) {
      content = cell.adjacentMines
      extraClasses = NUMBER_COLORS[cell.adjacentMines] || ''
    }
  } else if (cell.flagged) {
    content = '🚩'
    extraClasses = 'bg-amber-50 border-amber-300'
  }

  const baseClasses = [
    'w-[38px]', 'h-[38px]', 'rounded-md', 'border', 'font-bold', 'text-[17px]',
    'flex', 'items-center', 'justify-center', 'transition-all', 'duration-[80ms]',
    'leading-none',
  ]

  if (cell.revealed) {
    baseClasses.push('bg-[#faf7f2]', 'border-[#e8ddcc]', 'cursor-default',
      'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]')
  } else {
    baseClasses.push('bg-white', 'border-[#d4c4a8]', 'cursor-pointer',
      'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
      'hover:bg-amber-50', 'hover:border-amber-400', 'hover:-translate-y-px',
      'active:scale-[0.93]')
  }

  return (
    <button
      className={[...baseClasses, extraClasses].join(' ')}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={() => setMouseDown(true)}
      onMouseUp={() => setMouseDown(false)}
      onMouseLeave={() => setMouseDown(false)}
    >
      {content}
    </button>
  )
}

export default function SoloPage() {
  const config = useSoloStore((s) => s.config)
  const board = useSoloStore((s) => s.board)
  const phase = useSoloStore((s) => s.phase)
  const flagsPlaced = useSoloStore((s) => s.flagsPlaced)
  const elapsed = useSoloStore((s) => s.elapsedSeconds)
  const startGame = useSoloStore((s) => s.startGame)
  const reset = useSoloStore((s) => s.reset)

  const remaining = config ? config.mines - flagsPlaced : 0
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  let faceEmoji = '🙂'
  if (phase === 'lost') faceEmoji = '😵'
  else if (phase === 'won') faceEmoji = '😎'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-warm-surface border border-warm-border rounded-2xl shadow-lg p-6 max-w-full flex flex-col gap-5">
        {/* Mode label and face */}
        {phase === 'idle' ? (
          <>
            <h1 className="text-2xl font-bold text-center text-warm-text">💣 经典扫雷</h1>
            <p className="text-center text-sm text-warm-text-dim">选择难度开始游戏</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {DIFF_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => startGame(d.key)}
                  className="px-6 py-3 bg-warm-accent hover:bg-warm-accent-hover text-white font-semibold
                             rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <div>{d.label}</div>
                  <div className="text-[11px] opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between w-full gap-4 flex-wrap px-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => reset()}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-warm-border
                             bg-warm-surface2 text-warm-text-dim hover:text-warm-text hover:bg-warm-surface
                             transition-all"
                >
                  ↻ 新游戏
                </button>
                <span className="text-[#8b8070] text-sm font-semibold">
                  经典模式 · {config ? `${config.width}×${config.height} ${config.mines}雷` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Mine counter */}
                <div className="flex items-center gap-2 bg-[#f5f0e8] border border-[#e8ddcc] rounded-lg px-3 py-2 font-mono">
                  <span className="text-base">💣</span>
                  <span className="text-xl font-bold text-[#d97706] min-w-[28px] text-center tabular-nums">
                    {remaining}
                  </span>
                </div>
                {/* Face */}
                <button
                  onClick={() => reset()}
                  className="w-[46px] h-[46px] rounded-lg border border-[#e8ddcc] bg-[#f5f0e8] text-[26px]
                             flex items-center justify-center leading-none hover:bg-[#e8ddcc] active:scale-95 transition-all"
                >
                  {faceEmoji}
                </button>
                {/* Timer */}
                <div className="flex items-center gap-2 bg-[#f5f0e8] border border-[#e8ddcc] rounded-lg px-3 py-2 font-mono">
                  <span className="text-base">⏱</span>
                  <span className="text-xl font-bold text-[#d97706] min-w-[50px] text-center tabular-nums">
                    {timeStr}
                  </span>
                </div>
              </div>
            </div>

            {/* Board */}
            {board && config && (
              <div className="bg-[#f5f0e8] border border-[#e8ddcc] rounded-lg p-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${config.width}, 38px)`,
                    gap: '3px',
                  }}
                >
                  {board.flatMap((row) =>
                    row.map((cell) => <SoloCellView key={`${cell.x}-${cell.y}`} cell={cell} />),
                  )}
                </div>
              </div>
            )}

            {/* Game over overlay */}
            {(phase === 'won' || phase === 'lost') && (
              <div className="text-center">
                <p className="text-lg font-bold mb-2 text-warm-text">
                  {phase === 'won' ? '🎉 恭喜通关！' : '💥 踩到雷了！'}
                </p>
                {phase === 'won' && (
                  <p className="text-sm text-warm-text-dim">
                    用时 {timeStr}
                  </p>
                )}
                <button
                  onClick={() => reset()}
                  className="mt-3 px-5 py-2 bg-warm-accent hover:bg-warm-accent-hover text-white font-semibold
                             rounded-xl transition-all shadow-md"
                >
                  再来一局
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Back to lobby */}
      <a
        href="#/"
        className="mt-6 text-sm text-warm-text-muted hover:text-warm-accent transition-colors underline"
      >
        返回联机大厅
      </a>
    </div>
  )
}
