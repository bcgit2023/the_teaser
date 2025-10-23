'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import LoaderOne from '@/components/LoaderOne'

interface FaceRecognitionProps {
  onSuccess: () => void;
  onCancel: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setFaceMessage: (message: string) => void;
  setFaceSuccess: (success: boolean) => void;
}

export default function FaceRecognition({
  onSuccess,
  onCancel,
  isLoading,
  setIsLoading,
  setFaceMessage,
  setFaceSuccess
}: FaceRecognitionProps) {
  const [mounted, setMounted] = useState(false)
  const [WebcamComponent, setWebcamComponent] = useState<any>(null)

  useEffect(() => {
    // Only import the webcam component on the client side
    async function loadWebcam() {
      try {
        // Dynamic import of the webcam component
        const webcamModule = await import('react-webcam')
        setWebcamComponent(() => webcamModule.default)
        setMounted(true)
      } catch (error) {
        console.error('Failed to load webcam component:', error)
      }
    }
    
    loadWebcam()
  }, [])

  // Handle face detection with Google ML Kit (simulated for demo)
  const detectFaceWithMLKit = async () => {
    setIsLoading(true)
    setFaceMessage('Detecting your face...')
    
    try {
      // For demo purposes, we'll simulate the face detection process
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setFaceMessage('Analyzing facial features...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Improved success rate for better development experience (95% success rate)
      const randomValue = Math.random()
      const success = randomValue > 0.05 // 95% success rate for demo
      
      // Add debugging information
      console.log('Face detection attempt:', { randomValue, success, threshold: 0.05 })
      
      if (success) {
        setFaceSuccess(true)
        setFaceMessage('Hi there! Taking you to your learning space...')
        
        // Call the success callback after a short delay
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        throw new Error('Face not recognized - please ensure good lighting and face the camera directly')
      }
    } catch (error) {
      console.error('Face detection error:', error)
      setFaceMessage('Face not recognized. Please ensure good lighting and try again.')
      setFaceSuccess(false)
      
      // Reset after a delay
      setTimeout(() => {
        setFaceMessage('')
      }, 4000)
    } finally {
      setIsLoading(false)
    }
  }

  // Skip face recognition for development purposes
  const skipFaceRecognition = () => {
    setFaceMessage('Skipping face recognition...')
    setFaceSuccess(true)
    setTimeout(() => {
      onSuccess()
    }, 500)
  }

  if (!mounted || !WebcamComponent) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Camera loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
        <WebcamComponent
          audio={false}
          mirrored={true}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
          className="w-full h-full object-cover"
          onUserMedia={() => console.log('Webcam ready')}
        />

      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={detectFaceWithMLKit} disabled={isLoading}>
            {isLoading ? <LoaderOne /> : 'Verify Face'}
          </Button>
        </div>
        
        {/* Development skip option */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-xs text-gray-500 hover:text-gray-700" 
          onClick={skipFaceRecognition}
          disabled={isLoading}
        >
          Skip Face Recognition (Dev Mode)
        </Button>
      </div>
    </div>
  )
}
