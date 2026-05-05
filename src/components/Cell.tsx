import React, { useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { wsClient } from '../services/wsClient'

const Cell = React.memo(function Cell({ x, y }: { x: number; y: number }) {
  const cell = useGameStore((s) => s.board?.[y]?.[x])
  const phase = useGameStore((s) => s.phase)
  const alive = useGameStore((s) => s.alive)
  const roomId = useGameStore((s) => s.roomId)

  const handleClick = useCallback(() => {
    if (phase !== 'playing' || !alive) return
    if (!cell || cell.revealed || cell.flagged) return
    wsClient.send({ type: 'reveal_cell', payload: { roomId, x, y } })
  }, [phase, alive, cell, roomId, x, y])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (phase !== 'playing' || !alive) return
    if (!cell || cell.revealed) return
    wsClient.send({ type: 'flag_cell', payload: { roomId, x, y } })
  }, [phase, alive, cell, roomId, x, y])

  const handleDoubleClick = useCallback(() => {
    if (phase !== 'playing' || !alive) return
    if (!cell || !cell.revealed || cell.mine || cell.adjacentMines === 0) return
    wsClient.send({ type: 'chord_cell', payload: { roomId, x, y } })
  }, [phase, alive, cell, roomId, x, y])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && cell && !cell.revealed && !cell.flagged && phase === 'playing') {
      // face will show 😮 — handled by header subscription
    }
  }, [cell, phase])

  if (!cell) return <div className="w-[38px] h-[38px]" />

  const isRevealed = cell.revealed
  const isMine = cell.mine
  const isFlagged = cell.flagged
  const num = cell.adjacentMines

  let content: React.ReactNode = null
  let extraClasses = ''

  if (isRevealed) {
    if (isMine) {
      content = '💣'
      extraClasses = 'cell-mine-exploded bg-red-50 border-red-500'
    } else if (num > 0) {
      content = num
      extraClasses = `cell-n${num} cell-reveal-anim`
    }
    // empty cell → no content
  } else if (isFlagged) {
    content = '🚩'
    extraClasses = 'bg-amber-50 border-amber-300'
  }

  const baseClasses = [
    'w-[38px]', 'h-[38px]', 'rounded-md', 'border', 'font-bold', 'text-[17px]',
    'flex', 'items-center', 'justify-center', 'transition-all', 'duration-[80ms]',
    'leading-none',
  ]

  if (isRevealed) {
    baseClasses.push('bg-[#faf7f2]', 'border-[#e8ddcc]', 'cursor-default',
      'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]')
  } else {
    baseClasses.push('bg-white', 'border-[#e8ddcc]', 'cursor-pointer',
      'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
      'hover:bg-amber-50', 'hover:border-amber-300', 'hover:-translate-y-px',
      'active:scale-[0.93]')
  }

  return (
    <button
      className={[...baseClasses, extraClasses].join(' ')}
      style={{
        width: 'var(--cell-size, 38px)',
        height: 'var(--cell-size, 38px)',
      }}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
    >
      {content}
    </button>
  )
})

export default Cell
