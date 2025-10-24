'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CirclePlay, StopCircle, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'
import { WebcamRecorderProps } from '@/types/cloudinary'
import dynamic from 'next/dynamic'

// Dynamically import Webcam to avoid SSR issues
const Webcam = dynamic(
  // @ts-expect-error - Dynamic import type issue with react-webcam
  () => import('react-webcam'),
  { 
    ssr: false,
    loading: () => <div>Loading camera...</div>
  }
) as any

interface CircularWebcamRecorderProps extends WebcamRecorderProps {
  width?: number
  height?: number
  className?: string
  onRecordingStart?: () => void
  onRecordingStop?: (url: string) => void
}

export default function CircularWebcamRecorder({
  width = 200,
  height = 200,
  className = '',
  onRecordingStart,
  onRecordingStop,
  onRecordingComplete,
  onError,
  userId,
  sessionId,
  maxDuration = 300, // 5 minutes default
  autoUpload = true,
  uploadToCloudinary = true,
}: CircularWebcamRecorderProps) {
  const { toast } = useToast()
  const webcamRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cloudinary upload hook
  const {
    isUploading,
    uploadProgress,
    uploadResponse,
    error: uploadError,
    uploadToCloudinary: uploadToCloudinaryFn,
    clearError
  } = useCloudinaryUpload()
  
  // Set webcam as loaded after component mounts
  useEffect(() => {
    // Component mounted, webcam will be ready when onUserMedia is called
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
    
    // Create MediaRecorder instance with Cloudinary-compatible formats
    // Priority order: mp4 (best compatibility) -> webm (without specific codecs) -> fallback
    let options = { mimeType: 'video/mp4' }
    
    // Try different MIME types in order of Cloudinary compatibility
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      // Try webm without specific codecs (Cloudinary supports this)
      options = { mimeType: 'video/webm' }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Try webm with vp8 (more compatible than vp9)
        options = { mimeType: 'video/webm;codecs=vp8' }
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          // Last resort - use browser default
          options = {}
        }
      }
    }
    
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
        setRecordingDuration(prev => {
          const newDuration = prev + 1
          // Auto-stop recording if max duration reached
          if (newDuration >= maxDuration) {
            handleStopRecording()
          }
          return newDuration
        })
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

  // Process recording when chunks are available
  useEffect(() => {
    if (recordedChunks.length > 0 && !isRecording) {
      processRecording()
      // Clear chunks after processing to prevent duplicate uploads
      setRecordedChunks([])
    }
  }, [recordedChunks, isRecording])

  const processRecording = async () => {
    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      setRecordedBlob(blob)
      
      if (uploadToCloudinary && autoUpload) {
        await handleCloudinaryUpload(blob)
      } else {
        // Fallback to local upload
        await handleLocalUpload(blob)
      }
    } catch (error) {
      console.error('Error processing recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      toast({
        title: 'Error',
        description: `Failed to process recording: ${errorMessage}`,
        variant: 'destructive',
      })
      
      onError?.(errorMessage)
    }
  }

  const handleCloudinaryUpload = async (blob: Blob) => {
    try {
      clearError()
      
      const result = await uploadToCloudinaryFn(blob, {
        type: 'circular',
        userId,
        sessionId
      })
      
      if (result) {
        toast({
          title: 'Recording uploaded successfully!',
          description: 'Your video has been saved to the cloud.',
        })
        
        onRecordingComplete?.({
          ...result,
          blob,
          url: result.data?.url || result.data?.originalUrl || '',
          cloudinaryData: result.data,
          duration: recordingDuration,
          type: 'circular'
        })

        // Also call legacy callback for backward compatibility
        onRecordingStop?.(result.data?.url || result.data?.originalUrl || '')
      }
    } catch (error) {
      console.error('Cloudinary upload failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      toast({
        title: 'Upload Failed',
        description: `Failed to upload to cloud: ${errorMessage}`,
        variant: 'destructive',
      })
      
      // Fallback to local upload
      if (autoUpload) {
        await handleLocalUpload(blob)
      }
    }
  }

  const handleLocalUpload = async (blob: Blob) => {
    try {
      // Create a temporary URL for preview
      const tempUrl = URL.createObjectURL(blob)
      
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `circular-webcam-recording-${timestamp}.webm`
      
      // Use 'file' to match the API route expectation
      formData.append('file', blob, filename)
      
      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Recording saved successfully!',
          description: `File: ${result.filename}`,
        })
        
        onRecordingComplete?.({
          success: true,
          blob,
          url: tempUrl,
          localData: result,
          duration: recordingDuration,
          type: 'circular'
        })

        // Also call legacy callback for backward compatibility
        onRecordingStop?.(tempUrl)
      } else {
        throw new Error('Failed to save recording')
      }
    } catch (error) {
      console.error('Error saving recording locally:', error)
      throw error
    }
  }

  const handleManualUpload = async () => {
    if (recordedBlob) {
      await handleCloudinaryUpload(recordedBlob)
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
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{formatDuration(recordingDuration)}</span>
          </div>
        )}

        {/* Upload progress indicator */}
        {isUploading && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Upload className="w-3 h-3 animate-spin" />
            {uploadProgress}%
          </div>
        )}

        {/* Upload success indicator */}
        {uploadResponse && !isUploading && (
          <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
            ✓ Uploaded
          </div>
        )}

        {/* Upload error indicator */}
        {uploadError && !isUploading && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
            ✗ Failed
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
            disabled={!isCameraReady || isUploading}
          >
            <StopCircle className="w-4 h-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleStartRecording}
            disabled={!isCameraReady || isUploading}
          >
            <CirclePlay className="w-4 h-4 mr-1" />
            Record
          </Button>
        )}

        {/* Manual upload button */}
        {recordedBlob && !autoUpload && uploadToCloudinary && (
          <Button
            onClick={handleManualUpload}
            disabled={isUploading}
            size="sm"
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-1" />
            Upload
          </Button>
        )}
      </div>
    </div>
  )
}
