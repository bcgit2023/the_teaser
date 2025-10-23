"use client"

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import Link from 'next/link'

export function ParallaxHero() {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (parallaxRef.current) {
        const scrollPosition = window.pageYOffset
        parallaxRef.current.style.transform = `translateY(${scrollPosition * 0.5}px)`
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className="relative h-[90vh] overflow-hidden">
      <div 
        ref={parallaxRef}
        className="absolute inset-0"
      >
        <div className="relative w-full h-full">
          <Image
            src="/images/hero-background.jpg"
            alt="AI-powered learning"
            width={5824}
            height={3264}
            className="object-cover w-full h-full"
            style={{ 
              objectPosition: 'right center',
              transform: 'translateX(15%)'
            }}
            priority
          />
        </div>
      </div>
      <div className="absolute inset-0 bg-blue-900/70 z-10" />
      
      {/* Login Button - Preserved from original design */}
      <div className="absolute top-8 right-8 z-20">
        <Link href="/login">
          <Button className="bg-white text-blue-600 hover:bg-blue-50">
            Login
          </Button>
        </Link>
      </div>

      <div className="relative z-20 h-full flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
              Empower your students with AI-powered learning
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              Unlock the potential of every student with personalized, adaptive learning experiences powered by cutting-edge AI technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/for-students">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                  For Students
                </Button>
              </Link>
              <Link href="/for-parents">
                <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                  For Parents
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
