'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { CirclePlay, StopCircle, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload'
import { WebcamRecorderProps } from '@/types/cloudinary'

interface SimpleWebcamRecorderProps extends WebcamRecorderProps {
  width?: number
  height?: number
  className?: string
}

export default function SimpleWebcamRecorder({
  width = 200,
  height = 200,
  className = '',
  onRecordingComplete,
  onError,
  userId,
  sessionId,
  maxDuration = 300, // 5 minutes default
  autoUpload = true,
  uploadToCloudinary = true,
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
    
    // Create MediaRecorder instance with Cloudinary-compatible formats
    // Priority order: mp4 (best compatibility) -> webm (without specific codecs) -> fallback
    let options: MediaRecorderOptions = { mimeType: 'video/mp4' }
    let fileExtension = 'mp4'
    
    // Try different MIME types in order of Cloudinary compatibility
    if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
      // Try webm without specific codecs (Cloudinary supports this)
      options = { mimeType: 'video/webm' }
      fileExtension = 'webm'
      
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        // Try webm with vp8 (more compatible than vp9)
        options = { mimeType: 'video/webm;codecs=vp8' }
        fileExtension = 'webm'
        
        if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
          // Last resort - use browser default
          options = {}
          fileExtension = 'webm'
        }
      }
    }
    try {
      const recorder = new MediaRecorder(streamRef.current, options)
      
      // Store the selected format for later use
      setRecordingMimeType(options.mimeType || 'video/webm')
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
        setRecordingDuration(prev => {
          const newDuration = prev + 1
          // Auto-stop recording if max duration reached
          if (newDuration >= maxDuration) {
            handleStopRecording()
          }
          return newDuration
        })
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
      const blob = new Blob(recordedChunks, { type: recordingMimeType })
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
        type: 'webcam',
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
          type: 'webcam'
        })
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
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `webcam-recording-${timestamp}.${fileExtension}`
      
      // Use 'file' to match the API route expectation
      formData.append('file', blob, filename)
      
      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const result = await response.json()
        const objectUrl = URL.createObjectURL(blob)
        
        toast({
          title: 'Recording saved successfully!',
          description: `File: ${result.filename}`,
        })
        
        onRecordingComplete?.({
          success: true,
          blob,
          url: objectUrl,
          localData: result,
          duration: recordingDuration,
          type: 'webcam'
        })
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
