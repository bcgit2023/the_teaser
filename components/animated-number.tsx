"use client"

import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

export function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, className = '' }: AnimatedNumberProps) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  useEffect(() => {
    if (inView) {
      const duration = 2000 // Animation duration in milliseconds
      const steps = 60 // Number of steps in the animation
      const stepValue = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += stepValue
        if (current >= value) {
          setCount(value)
          clearInterval(timer)
        } else {
          setCount(current)
        }
      }, duration / steps)

      return () => clearInterval(timer)
    }
  }, [inView, value])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  )
}
