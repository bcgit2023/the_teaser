'use client'

import { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  isPlaying: boolean
  audioElement: HTMLAudioElement | null
}

export default function AudioVisualizer({ isPlaying, audioElement }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number>(0)
  const freqsRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const WIDTH = canvas.width = window.innerWidth / 2
    const HEIGHT = canvas.height = window.innerHeight

    const opts = {
      smoothing: 0.6,
      fft: 8,
      minDecibels: -70,
      scale: 0.2,
      glow: 10,
      color1: [203, 36, 128],
      color2: [41, 200, 192],
      color3: [24, 137, 218],
      fillOpacity: 0.6,
      lineWidth: 1,
      blend: 'screen',
      shift: 50,
      width: 60,
      amp: 1
    }

    const visualize = () => {
      if (!analyserRef.current || !ctx || !freqsRef.current) return

      analyserRef.current.getByteFrequencyData(freqsRef.current)

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      path(0)
      path(1)
      path(2)

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(visualize)
      }
    }

    const path = (channel: number) => {
      if (!ctx) return

      // Type-safe way to access color arrays
      const colorKey = `color${channel + 1}` as 'color1' | 'color2' | 'color3'
      const color = opts[colorKey].map(Math.floor)
      ctx.fillStyle = `rgba(${color}, ${opts.fillOpacity})`
      ctx.strokeStyle = ctx.shadowColor = `rgb(${color})`
      ctx.lineWidth = opts.lineWidth
      ctx.shadowBlur = opts.glow
      ctx.globalCompositeOperation = opts.blend as GlobalCompositeOperation

      const m = HEIGHT / 2
      const offset = (WIDTH - 15 * opts.width) / 2
      const x = Array.from({length: 15}, (_, i) => offset + channel * opts.shift + i * opts.width)
      const y = Array.from({length: 5}, (_, i) => Math.max(0, m - scale(i) * freq(channel, i)))
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

    const freq = (channel: number, i: number) => {
      if (!freqsRef.current) return 0
      const band = 2 * channel + [1, 3, 0, 4, 2][i] * 6
      return freqsRef.current[band] || 0
    }

    const scale = (i: number) => {
      const x = Math.abs(2 - i)
      const s = 3 - x
      return s / 3 * opts.amp
    }

    // Global audio context check to prevent duplicate initialization
    if (isPlaying && audioElement) {
      try {
        // Check if we already have a global audio context in the window object
        const globalAudioContext = (window as any).__GLOBAL_AUDIO_CONTEXT__;
        
        if (globalAudioContext && !globalAudioContext.closed) {
          // Reuse existing audio context
          console.log('Reusing existing audio context');
          audioContextRef.current = globalAudioContext;
        } else {
          // Create new audio context and store it globally
          console.log('Creating new audio context');
          audioContextRef.current = new AudioContext();
          (window as any).__GLOBAL_AUDIO_CONTEXT__ = audioContextRef.current;
        }
        
        // Ensure audioContextRef.current is not null for TypeScript
        if (!audioContextRef.current) {
          throw new Error('Failed to initialize audio context');
        }
        
        // Check if this audio element already has a source node
        if (!(audioElement as any).__SOURCE_NODE__) {
          // Create analyzer and source only if they don't exist
          analyserRef.current = audioContextRef.current.createAnalyser();
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
          
          // Store the source node on the audio element to prevent duplicate creation
          (audioElement as any).__SOURCE_NODE__ = sourceRef.current;
          
          analyserRef.current.smoothingTimeConstant = opts.smoothing;
          analyserRef.current.fftSize = Math.pow(2, opts.fft);
          analyserRef.current.minDecibels = opts.minDecibels;
          analyserRef.current.maxDecibels = 0;
          
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        } else {
          // Reuse existing source node
          console.log('Reusing existing source node');
          sourceRef.current = (audioElement as any).__SOURCE_NODE__;
          if (!sourceRef.current) {
            throw new Error('Failed to get source node');
          }
          analyserRef.current = audioContextRef.current.createAnalyser();
          
          analyserRef.current.smoothingTimeConstant = opts.smoothing;
          analyserRef.current.fftSize = Math.pow(2, opts.fft);
          analyserRef.current.minDecibels = opts.minDecibels;
          analyserRef.current.maxDecibels = 0;
          
          // Connect the existing source to our new analyzer
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
        
        freqsRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        requestAnimationFrame(visualize);
      } catch (error) {
        console.error('Failed to initialize audio analyzer:', error);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current && analyserRef.current) {
        // Only disconnect from our analyzer, not completely
        // This prevents breaking other components that might be using the same source
        try {
          sourceRef.current.disconnect(analyserRef.current);
        } catch (e) {
          console.warn('Could not disconnect source:', e);
        }
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          console.warn('Could not disconnect analyzer:', e);
        }
      }
      // Don't close the audio context since it might be used elsewhere
      // Just clear our reference to it
      audioContextRef.current = null;
    }
  }, [isPlaying, audioElement])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
