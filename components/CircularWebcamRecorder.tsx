'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Record, StopCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// Import Webcam with dynamic import to avoid SSR issues
import dynamic from 'next/dynamic'
const Webcam = dynamic(() => import('react-webcam').then(mod => mod.default), { ssr: false })

interface CircularWebcamRecorderProps {
  width?: number
  height?: number
  className?: string
  onRecordingStart?: () => void
  onRecordingStop?: (recordingUrl: string) => void
}

export default function CircularWebcamRecorder({
  width = 200,
  height = 200,
  className = '',
  onRecordingStart,
  onRecordingStop
}: CircularWebcamRecorderProps) {
  const { toast } = useToast()
  const webcamRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [webcamLoaded, setWebcamLoaded] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Set webcam as loaded after component mounts
  useEffect(() => {
    setWebcamLoaded(true)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Handle camera ready state
  const handleUserMedia = useCallback(() => {
    setIsCameraReady(true)
  }, [])

  // Start recording function
  const handleStartRecording = useCallback(() => {
    if (!webcamRef.current?.stream) {
      toast({
        title: "Camera Error",
        description: "Cannot access webcam stream. Please check permissions.",
        variant: "destructive"
      })
      return
    }

    // Reset recording state
    setRecordedChunks([])
    setRecordingDuration(0)
    
    // Get media stream from webcam
    const stream = webcamRef.current.stream
    
    // Create MediaRecorder instance
    const options = { mimeType: 'video/webm;codecs=vp9,opus' }
    try {
      const recorder = new MediaRecorder(stream, options)
      
      // Set up event handlers
      recorder.ondataavailable = handleDataAvailable
      recorder.onstop = handleStopRecording
      
      // Start recording
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
      
      // Notify parent component
      if (onRecordingStart) onRecordingStart()
      
      toast({
        title: "Recording Started",
        description: "Your webcam is now recording.",
      })
    } catch (err) {
      console.error('Error starting recording:', err)
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive"
      })
    }
  }, [onRecordingStart, toast])

  // Handle data chunks from recorder
  const handleDataAvailable = useCallback(({ data }: BlobEvent) => {
    if (data.size > 0) {
      setRecordedChunks(prev => [...prev, data])
    }
  }, [])

  // Stop recording function
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
      setIsRecording(false)
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  // Save recording when chunks are available
  useEffect(() => {
    if (recordedChunks.length > 0 && !isRecording) {
      saveRecording()
    }
  }, [recordedChunks, isRecording])

  // Save recording to server
  const saveRecording = async () => {
    if (recordedChunks.length === 0) return
    
    try {
      // Create a blob from the recorded chunks
      const blob = new Blob(recordedChunks, {
        type: 'video/webm'
      })
      
      // Create a temporary URL for preview
      const recordingUrl = URL.createObjectURL(blob)
      
      // Notify parent component
      if (onRecordingStop) onRecordingStop(recordingUrl)
      
      // Create form data for upload
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `recording-${timestamp}.webm`
      formData.append('file', blob, filename)
      
      // Upload to server
      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Recording Saved",
          description: `Recording saved as ${data.filename}`,
        })
      } else {
        throw new Error('Failed to upload recording')
      }
    } catch (err) {
      console.error('Error saving recording:', err)
      toast({
        title: "Save Error",
        description: "Failed to save recording. Please try again.",
        variant: "destructive"
      })
    } finally {
      // Reset recorded chunks
      setRecordedChunks([])
    }
  }

  // Format seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className={`relative rounded-full overflow-hidden bg-gray-100 ${className}`}
        style={{ width, height }}
      >
        {/* Webcam component */}
        {webcamLoaded && Webcam && (
          <Webcam
            audio={false}
            ref={webcamRef}
            videoConstraints={{
              width,
              height,
              facingMode: "user"
            }}
            onUserMedia={handleUserMedia}
            className="absolute top-0 left-0 w-full h-full object-cover"
            screenshotFormat="image/jpeg"
          />
        )}
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{formatDuration(recordingDuration)}</span>
          </div>
        )}
        
        {/* Camera not ready overlay */}
        {!isCameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
            Loading camera...
          </div>
        )}
      </div>
      
      {/* Recording controls */}
      <div className="flex gap-2">
        {isRecording ? (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleStopRecording}
            disabled={!isCameraReady}
          >
            <StopCircle className="w-4 h-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleStartRecording}
            disabled={!isCameraReady}
          >
            <Record className="w-4 h-4 mr-1" />
            Record
          </Button>
        )}
      </div>
    </div>
  )
}
