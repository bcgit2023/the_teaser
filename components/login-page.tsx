'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import AudioVisualizer from './audio-visualizer'

export default function LoginPage() {
  const [userType, setUserType] = useState<'teacher' | 'student' | 'parent' | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: userType }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.role === 'teacher') {
          router.push('/admin-dashboard')
        } else if (data.role === 'parent') {
          router.push('/parent-dashboard')
        } else {
          router.push('/tutorial')
        }
      } else {
        setError(data.error || 'An error occurred')
      }
    } catch (error) {
      setError('An error occurred')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-8 px-4">
      <div className="max-w-[1800px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 h-[90vh]">
        {/* Left section with visualizer */}
        <div className="h-full">
          <div className="bg-blue-600 rounded-3xl p-8 lg:p-12 h-full flex flex-col">
            {/* Logo */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold text-white">FutureLearner.ai</h1>
              <p className="mt-2 text-lg text-white/90">AI Math Tutor for Every Student</p>
            </div>

            {/* Visualizer container */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-[600px] aspect-[5/2] relative">
                <AudioVisualizer isPlaying={isPlaying} />
              </div>
            </div>

            <p className="text-sm text-white/80 mt-12">Made with ❤️ in Singapore</p>
          </div>
        </div>

        {/* Right section with login form */}
        <div className="h-full flex items-center justify-center">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-2 text-sm text-gray-600">Please sign in to your account</p>
            </div>

            {!userType ? (
              <div className="space-y-4">
                <Button
                  onClick={() => setUserType('teacher')}
                  variant="outline"
                  className="w-full"
                >
                  I am a Teacher
                </Button>
                <Button
                  onClick={() => setUserType('student')}
                  className="w-full"
                >
                  I am a Student
                </Button>
                <Button
                  onClick={() => setUserType('parent')}
                  variant="secondary"
                  className="w-full"
                >
                  I am a Parent
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-500">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setUserType(null)}
                    className="text-sm"
                  >
                    ← Choose different role
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}