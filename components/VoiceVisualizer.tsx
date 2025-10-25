'use client'

import { useEffect, useRef } from 'react'
import { useSharedAudioAnalyser, cleanupSharedAudioAnalyser } from '@/lib/shared-audio-context'

interface VoiceVisualizerProps {
  isActive: boolean
  isPlaying: boolean
  audioRef?: React.RefObject<HTMLAudioElement>
  audioElement?: HTMLAudioElement | null
}

export default function VoiceVisualizer({ 
  isActive, 
  isPlaying, 
  audioRef, 
  audioElement 
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number>(0)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const subscriberIdRef = useRef<string>(`visualizer-${Math.random().toString(36).substr(2, 9)}`)

  const isVisualizerActive = isActive && isPlaying

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize the canvas to match its container dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Visualization options
    const opts = {
      smoothing: 0.6,
      fft: 8,
      minDecibels: -70,
      scale: 0.15,
      glow: 8,
      color1: [203, 36, 128],
      color2: [41, 200, 192],
      color3: [24, 137, 218],
      fillOpacity: 0.6,
      lineWidth: 1,
      blend: 'screen',
      shift: 35,
      width: 40,
      amp: 0.8
    }

    // Main visualization loop
    const visualize = () => {
      if (!dataArrayRef.current) return

      const WIDTH = canvas.width
      const HEIGHT = canvas.height

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 0)
      drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 1)
      drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 2)

      if (isVisualizerActive) {
        animationFrameRef.current = requestAnimationFrame(visualize)
      }
    }

    // Draw a wave path for a given channel (0, 1, 2)
    const drawPath = (
      ctx: CanvasRenderingContext2D,
      opts: any,
      data: Uint8Array,
      WIDTH: number,
      HEIGHT: number,
      channel: number
    ) => {
      const color = opts[`color${channel + 1}`].map(Math.floor)
      ctx.fillStyle = `rgba(${color}, ${opts.fillOpacity})`
      ctx.strokeStyle = ctx.shadowColor = `rgb(${color})`
      ctx.lineWidth = opts.lineWidth
      ctx.shadowBlur = opts.glow
      ctx.globalCompositeOperation = opts.blend

      const m = HEIGHT / 2
      const offset = (WIDTH - 15 * opts.width) / 2
      const x = Array.from({ length: 15 }, (_, i) => offset + channel * opts.shift + i * opts.width)
      const y = Array.from({ length: 5 }, (_, i) =>
        Math.max(0, m - scale(i, opts) * getFrequency(data, channel, i))
      )
      const h = 2 * m

      ctx.beginPath()
      ctx.moveTo(0, m)
      ctx.lineTo(x[0], m + 1)
      ctx.bezierCurveTo(x[1], m + 1, x[2], y[0], x[3], y[0])
      ctx.bezierCurveTo(x[4], y[0], x[4], y[1], x[5], y[1])
      ctx.bezierCurveTo(x[6], y[1], x[6], y[2], x[7], y[2])
      ctx.bezierCurveTo(x[8], y[2], x[8], y[3], x[9], y[3])
      ctx.bezierCurveTo(x[10], y[3], x[10], y[4], x[11], y[4])
      ctx.bezierCurveTo(x[12], y[4], x[12], m, x[13], m)
      ctx.lineTo(WIDTH, m + 1)
      ctx.lineTo(x[13], m - 1)
      ctx.bezierCurveTo(x[12], m, x[12], h - y[4], x[11], h - y[4])
      ctx.bezierCurveTo(x[10], h - y[4], x[10], h - y[3], x[9], h - y[3])
      ctx.bezierCurveTo(x[8], h - y[3], x[8], h - y[2], x[7], h - y[2])
      ctx.bezierCurveTo(x[6], h - y[2], x[6], h - y[1], x[5], h - y[1])
      ctx.bezierCurveTo(x[4], h - y[1], x[4], h - y[0], x[3], h - y[0])
      ctx.bezierCurveTo(x[2], h - y[0], x[1], m, x[0], m)
      ctx.lineTo(0, m)
      ctx.fill()
      ctx.stroke()
    }

    // Helper to get frequency data for a channel and index
    const getFrequency = (data: Uint8Array, channel: number, i: number) => {
      const band = 2 * channel + [1, 3, 0, 4, 2][i] * 6
      return data[band] || 0
    }

    // Helper to scale the frequency value
    const scale = (i: number, opts: any) => {
      const x = Math.abs(2 - i)
      const s = 3 - x
      return (s / 3) * opts.amp
    }

    let analyser: AnalyserNode | null = null

    if (isVisualizerActive) {
      // Handle audio source from either audioRef or audioElement
      const audioSource = audioRef?.current || audioElement
      
      if (audioSource) {
        // Use shared audio context manager
        analyser = useSharedAudioAnalyser(
          audioSource,
          subscriberIdRef.current,
          {
            fftSize: Math.pow(2, opts.fft),
            smoothingTimeConstant: opts.smoothing,
            minDecibels: opts.minDecibels,
            maxDecibels: 0
          }
        )

        if (analyser) {
          dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
          console.log('[VoiceVisualizer] Connected to shared audio analyser')
        }
      } else {
        // Microphone input: use getUserMedia
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            analyser = useSharedAudioAnalyser(
              stream,
              subscriberIdRef.current,
              {
                fftSize: Math.pow(2, opts.fft),
                smoothingTimeConstant: opts.smoothing,
                minDecibels: opts.minDecibels,
                maxDecibels: 0
              }
            )

            if (analyser) {
              dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
              console.log('[VoiceVisualizer] Connected to microphone via shared audio analyser')
            }
          })
          .catch((err) => {
            console.error('Error accessing microphone:', err)
          })
      }

      // Start visualization loop
      const visualizeWithAnalyser = () => {
        if (!analyser || !dataArrayRef.current) return

        analyser.getByteFrequencyData(dataArrayRef.current)
        const WIDTH = canvas.width
        const HEIGHT = canvas.height

        ctx.clearRect(0, 0, WIDTH, HEIGHT)
        drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 0)
        drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 1)
        drawPath(ctx, opts, dataArrayRef.current, WIDTH, HEIGHT, 2)

        if (isVisualizerActive) {
          animationFrameRef.current = requestAnimationFrame(visualizeWithAnalyser)
        }
      }

      if (analyser) {
        requestAnimationFrame(visualizeWithAnalyser)
      }
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      // Clean up shared audio analyser
      const audioSource = audioRef?.current || audioElement
      if (audioSource) {
        cleanupSharedAudioAnalyser(audioSource, subscriberIdRef.current)
      }
    }
  }, [isActive, isPlaying, audioRef, audioElement])

  return (
    <div className="relative w-full h-12">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        aria-label="Voice visualizer"
        role="img"
      />
    </div>
  )
}
