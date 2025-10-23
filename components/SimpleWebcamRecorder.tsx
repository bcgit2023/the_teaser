'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CirclePlay, StopCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface SimpleWebcamRecorderProps {
  width?: number
  height?: number
  className?: string
}

export default function SimpleWebcamRecorder({
  width = 200,
  height = 200,
  className = '',
}: SimpleWebcamRecorderProps) {
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [recordingMimeType, setRecordingMimeType] = useState<string>('')
  const [fileExtension, setFileExtension] = useState<string>('webm')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize camera on component mount
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: true
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        
        streamRef.current = stream
        setIsCameraReady(true)
      } catch (err) {
        console.error('Error accessing camera:', err)
        toast({
          title: "Camera Error",
          description: "Cannot access webcam. Please check permissions.",
          variant: "destructive"
        })
      }
    }
    
    initCamera()
    
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [toast])

  // Start recording function
  const handleStartRecording = useCallback(() => {
    if (!streamRef.current) {
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
    
    // Create MediaRecorder instance with proper codec support
    let options = { mimeType: 'video/webm;codecs=vp9,opus' }
    let fileExtension = 'webm'
    
    // Try different MIME types in order of preference
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' }
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' }
        fileExtension = 'mp4'
      }
    }
    try {
      const recorder = new MediaRecorder(streamRef.current, options)
      
      // Store the selected format for later use
      setRecordingMimeType(options.mimeType)
      setFileExtension(fileExtension)
      
      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data])
        }
      }
      
      // Start recording
      recorder.start(1000) // Collect data every second
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
      
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
  }, [toast])

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
      // Clear chunks after saving to prevent duplicate uploads
      setRecordedChunks([])
    }
  }, [recordedChunks, isRecording])

  // Save recording to server
  const saveRecording = async () => {
    if (recordedChunks.length === 0) return
    
    try {
      // Create a blob from the recorded chunks with correct MIME type
      const blob = new Blob(recordedChunks, {
        type: recordingMimeType || 'video/webm'
      })
      
      // Create form data for upload with correct file extension
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `recording-${timestamp}.${fileExtension}`
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
        {/* Video element for webcam */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        
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
            <CirclePlay className="w-4 h-4 mr-1" />
            Record
          </Button>
        )}
      </div>
    </div>
  )
}
