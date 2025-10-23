'use client'

import { useEffect, useState } from 'react'

interface AudioCaptionProps {
  isPlaying: boolean
}

const captions = [
  {
    text: "Hello and welcome to FutureLearner.ai!",
    startTime: 0,
    duration: 3300
  },
  {
    text: "It's great to have you here.",
    startTime: 3350,
    duration: 1800
  },
  {
    text: "Ready to continue your learning journey?",
    startTime: 4950,
    duration: 2500
  },
  {
    text: "Simply log in to pick up where you left off.",
    startTime: 7250,
    duration: 2900
  },
  {
    text: "Let's keep making progress, one step at a time.",
    startTime: 10150,
    duration: 2750
  },
  {
    text: "Happy learning!",
    startTime: 13000,
    duration: 1500
  }
]

export function AudioCaption({ isPlaying }: AudioCaptionProps) {
  const [currentCaption, setCurrentCaption] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isPlaying) {
      setCurrentCaption('')
      setIsVisible(false)
      return
    }

    let timeouts: NodeJS.Timeout[] = []

    captions.forEach(caption => {
      // Show caption
      timeouts.push(
        setTimeout(() => {
          setCurrentCaption(caption.text)
          setIsVisible(true)
        }, caption.startTime)
      )

      // Hide caption slightly before the next one
      timeouts.push(
        setTimeout(() => {
          setIsVisible(false)
        }, caption.startTime + caption.duration - 200)
      )
    })

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout))
    }
  }, [isPlaying])

  return (
    <div className="h-16 flex items-center justify-center">
      <div
        className={`
          transition-opacity duration-200
          ${isVisible ? 'opacity-100' : 'opacity-0'}
          text-white text-lg font-medium text-center
        `}
      >
        {currentCaption}
      </div>
    </div>
  )
}
