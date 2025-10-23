'use client'

import { useEffect, useState } from 'react'

// This component provides a simplified interface for webcam functionality
// that works around TypeScript and hydration issues
export default function WebcamCapture() {
  const [isClient, setIsClient] = useState(false)
  const [WebcamComponent, setWebcamComponent] = useState<any>(null)
  
  useEffect(() => {
    // Only import the webcam component on the client side
    async function loadWebcam() {
      try {
        // Dynamic import of the webcam component
        const webcamModule = await import('react-webcam')
        setWebcamComponent(() => webcamModule.default)
        setIsClient(true)
      } catch (error) {
        console.error('Failed to load webcam component:', error)
      }
    }
    
    loadWebcam()
  }, [])

  if (!isClient || !WebcamComponent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading camera...</p>
      </div>
    )
  }

  // At this point, WebcamComponent is loaded and we're on the client side
  return (
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
      id="webcam-element"
    />
  )
}
