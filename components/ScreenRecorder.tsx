'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MonitorPlay, StopCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import ParentalConsentModal from './ParentalConsentModal'

interface ScreenRecorderProps {
  onRecordingStart?: () => void
  onRecordingStop?: (recordingUrl: string) => void
}

export default function ScreenRecorder({
  onRecordingStart,
  onRecordingStop,
}: ScreenRecorderProps) {
  const { toast } = useToast()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [recordingDuration, setRecordingDuration] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [hasParentalConsent, setHasParentalConsent] = useState(false)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Start actual recording function (called after consent is granted)
  const startActualRecording = useCallback(async () => {
    console.log('Starting screen recording...');
    try {
      // Get screen stream with audio
      console.log('Requesting screen media...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true,
        audio: true
      })
      console.log('Screen media obtained:', screenStream.getTracks().map(t => t.kind));
      
      // Check if we have audio in the screen capture
      const hasScreenAudio = screenStream.getAudioTracks().length > 0;
      console.log('Screen capture has audio tracks:', hasScreenAudio);
      
      // Try to get microphone audio for better quality
      let audioStream: MediaStream | null = null;
      try {
        console.log('Requesting microphone access for better audio quality...');
        audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('Microphone access granted');
      } catch (audioError) {
        console.log('Microphone access denied or failed, using screen audio only:', audioError);
      }

      // Combine streams if we have both
      let finalStream = screenStream;
      if (audioStream && hasScreenAudio) {
        // Create a new stream with video from screen and audio from microphone
        const videoTrack = screenStream.getVideoTracks()[0];
        const audioTrack = audioStream.getAudioTracks()[0];
        finalStream = new MediaStream([videoTrack, audioTrack]);
        console.log('Combined screen video with microphone audio');
      } else if (audioStream && !hasScreenAudio) {
        // Add microphone audio to screen stream
        const audioTrack = audioStream.getAudioTracks()[0];
        finalStream.addTrack(audioTrack);
        console.log('Added microphone audio to screen stream');
      }

      streamRef.current = finalStream
      console.log('Final stream tracks:', finalStream.getTracks().map(t => `${t.kind}: ${t.label}`));

      // Set up MediaRecorder with fallback MIME types
      let mediaRecorder: MediaRecorder;
      const mimeTypes = [
        'video/mp4;codecs=h264,aac',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('Selected MIME type:', mimeType);
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported MIME type found for MediaRecorder');
      }

      mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps
      });

      mediaRecorderRef.current = mediaRecorder
      setRecordedChunks([])

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Data chunk received:', event.data.size, 'bytes');
          setRecordedChunks(prev => [...prev, event.data])
        }
      }

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        setIsRecording(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          title: "Recording Error",
          description: "An error occurred during recording. Please try again.",
          variant: "destructive"
        })
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingDuration(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

      // Call onRecordingStart callback
      onRecordingStart?.()
      
      console.log('Recording started successfully');
      toast({
        title: "Recording Started",
        description: "Screen recording has begun. Click stop when finished.",
      })

      // Handle stream end (user stops sharing)
      finalStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing ended by user');
        if (mediaRecorderRef.current && isRecording) {
          handleStopRecording()
        }
      }

    } catch (error) {
      console.error('Error starting recording:', error)
      toast({
        title: "Recording Failed",
        description: error instanceof Error ? error.message : "Failed to start screen recording. Please check permissions.",
        variant: "destructive"
      })
    }
  }, [onRecordingStart, toast])

  // Handle consent modal response
  const handleConsentResponse = useCallback((granted: boolean) => {
    console.log('Consent response received:', granted)
    setHasParentalConsent(granted)
    setShowConsentModal(false)
    
    if (granted) {
      console.log('Consent granted, starting recording...')
      // Proceed with recording
      startActualRecording()
    } else {
      console.log('Consent denied')
      toast({
        title: "Recording Cancelled",
        description: "Parental consent is required to record screen activities.",
        variant: "destructive"
      })
    }
  }, [toast, startActualRecording])

  // Handle stop recording
  const handleStopRecording = useCallback(() => {
    console.log('Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log(`Stopped ${track.kind} track:`, track.label);
        })
        streamRef.current = null
      }
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      console.log('Recording stopped');
    }
  }, [isRecording])

  // Handle record button click
  const handleRecordClick = useCallback(() => {
    console.log('Record button clicked, isRecording:', isRecording, 'hasParentalConsent:', hasParentalConsent)
    if (isRecording) {
      handleStopRecording()
    } else {
      // Check if we already have consent
      if (hasParentalConsent) {
        console.log('Already have consent, starting recording directly')
        startActualRecording()
      } else {
        console.log('No consent yet, showing modal')
        // Show consent modal first
        setShowConsentModal(true)
      }
    }
  }, [isRecording, hasParentalConsent, handleStopRecording, startActualRecording])

  // Save recording when chunks are updated
  useEffect(() => {
    if (recordedChunks.length > 0 && !isRecording) {
      console.log('Saving recording with', recordedChunks.length, 'chunks');
      saveRecording()
    }
  }, [recordedChunks, isRecording])

  // Save recording function
  const saveRecording = async () => {
    try {
      console.log('Creating blob from', recordedChunks.length, 'chunks');
      const blob = new Blob(recordedChunks, { 
        type: recordedChunks[0]?.type || 'video/webm' 
      })
      console.log('Blob created:', blob.size, 'bytes, type:', blob.type);
      
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `screen-recording-${timestamp}.webm`
      formData.append('video', blob, filename)
      formData.append('duration', recordingDuration.toString())
      formData.append('type', 'screen')

      console.log('Uploading recording...');
      const response = await fetch('/api/recordings/screen', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      console.log('Upload successful:', result);
      
      // Create object URL for immediate playback
      const recordingUrl = URL.createObjectURL(blob)
      
      // Call onRecordingStop callback
      onRecordingStop?.(recordingUrl)
      
      toast({
        title: "Recording Saved",
        description: `Screen recording saved successfully (${Math.round(blob.size / 1024 / 1024 * 100) / 100} MB)`,
      })

      // Reset chunks
      setRecordedChunks([])
      setRecordingDuration(0)
      
    } catch (error) {
      console.error('Error saving recording:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save recording",
        variant: "destructive"
      })
    }
  }

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRecordClick}
        disabled={false}
        className="flex items-center gap-1 !bg-white !border-gray-200 !text-gray-700 hover:!bg-gray-50 hover:!text-gray-900"
      >
        {isRecording ? (
          <>
            <StopCircle className="w-3 h-3" />
            <span className="text-xs">Stop ({formatDuration(recordingDuration)})</span>
          </>
        ) : (
          <>
            <MonitorPlay className="w-3 h-3" />
            <span className="text-xs">Record Screen</span>
          </>
        )}
      </Button>

      {/* Parental Consent Modal */}
      <ParentalConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConsent={handleConsentResponse}
      />
    </>
  )
}
