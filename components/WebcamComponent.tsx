'use client'

import React from 'react'
import Webcam from 'react-webcam'

interface WebcamComponentProps {
  width: number
  height: number
  onUserMedia: () => void
  className?: string
  webcamRef: any
}

export default function WebcamComponent({
  width,
  height,
  onUserMedia,
  className = '',
  webcamRef
}: WebcamComponentProps) {
  return (
    <Webcam
      audio={false}
      ref={webcamRef}
      videoConstraints={{
        width,
        height,
        facingMode: "user"
      }}
      onUserMedia={onUserMedia}
      className={className}
      screenshotFormat="image/jpeg"
    />
  )
}
