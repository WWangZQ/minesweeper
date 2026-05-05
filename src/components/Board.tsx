import { useGameStore } from '../stores/gameStore'
import Cell from './Cell'

export default function Board() {
  const board = useGameStore((s) => s.board)
  const config = useGameStore((s) => s.config)

  if (!board || !config) return null

  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      cells.push({ x, y })
    }
  }

  return (
    <div className="bg-[#f5f0e8] border border-[#e8ddcc] rounded-lg p-2
                    shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${config.width}, var(--cell-size, 38px))`,
          gap: 'var(--gap, 3px)',
        }}
      >
        {cells.map(({ x, y }) => (
          <Cell key={`${x}-${y}`} x={x} y={y} />
        ))}
      </div>
    </div>
  )
}
