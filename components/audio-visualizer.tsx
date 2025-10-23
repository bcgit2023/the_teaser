'use client'

import React, { useRef, useEffect } from 'react'

interface AudioVisualizerProps {
  isPlaying: boolean
}

export default function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    const barCount = 30
    const bars: number[] = Array(barCount).fill(0)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width / barCount
      const maxBarHeight = canvas.height * 0.8

      if (isPlaying) {
        // Active visualization when playing
        for (let i = 0; i < barCount; i++) {
          const targetHeight = Math.random() * maxBarHeight
          bars[i] += (targetHeight - bars[i]) * 0.2

          const x = i * barWidth
          const y = canvas.height - bars[i]

          const gradient = ctx.createLinearGradient(x, y, x, canvas.height)
          gradient.addColorStop(0, '#ffffff')
          gradient.addColorStop(1, '#f0f0f0')

          ctx.fillStyle = gradient
          ctx.fillRect(x, y, barWidth - 2, bars[i])
        }
      } else {
        // Idle animation when not playing
        const time = Date.now() * 0.002
        const amplitude = Math.sin(time) * 10 + 20

        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)

        for (let i = 0; i < canvas.width; i++) {
          const y = canvas.height / 2 + Math.sin(i * 0.02 + time) * amplitude
          ctx.lineTo(i, y)
        }

        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    // Set canvas size
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resize()
    window.addEventListener('resize', resize)

    // Start animation
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isPlaying])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl bg-blue-500/50"
    />
  )
}
