'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import Image from 'next/image'
import AudioVisualizer from '@/components/AudioVisualizer'
import { AudioCaption } from '@/components/AudioCaption'
import LoaderOne from '@/components/LoaderOne'
import dynamic from 'next/dynamic'

// Import FaceRecognition component with SSR disabled
const FaceRecognition = dynamic(
  () => import('@/components/FaceRecognition'),
  { ssr: false }
)

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [faceSuccess, setFaceSuccess] = useState(false)
  const [faceMessage, setFaceMessage] = useState('')
  const [activeTab, setActiveTab] = useState('credentials')
  const [isMounted, setIsMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()
  
  // Handle client-side only rendering
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const audio = new Audio('/voice/welcome.mp3')
    audioRef.current = audio
    audio.currentTime = 0

    // Auto-play welcome audio on first user interaction
    const handleFirstInteraction = () => {
      playWelcomeAudio()
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }

    // Add event listeners for user interaction
    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeEventListener('ended', () => setIsPlaying(false))
      }
      // Clean up event listeners
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [])

  const playWelcomeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true)
          audioRef.current?.addEventListener('ended', () => setIsPlaying(false))
        })
        .catch(error => {
          console.error('Audio playback failed:', error)
          setIsPlaying(false)
        })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Client-side validation
    if (!username || !password) {
      setError('Please fill in all required fields')
      setIsLoading(false)
      return
    }

    try {
      const loginData = {
        username,
        password
      };

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(loginData),
      })

      const data = await response.json()

      if (response.ok) {
        // Clear any previous errors
        setError('')
        
        // Show success message
        toast({
          title: "Login Successful",
          description: `Welcome back, ${data.user?.full_name || data.user?.username || 'Student'}!`,
        })
        
        // Redirect based on user role from the response
        const userRole = data.user?.role;
        if (userRole === 'teacher' || userRole === 'admin') {
          router.push('/admin-dashboard')
        } else if (userRole === 'parent') {
          router.push('/parent-dashboard')
        } else {
          router.push('/tutorial')
        }
      } else {
        // Enhanced error handling for different status codes
        if (response.status === 423) {
          setError('Account is temporarily locked due to multiple failed login attempts. Please try again later.')
          toast({
            title: "Account Locked",
            description: "Your account has been temporarily locked for security reasons.",
            variant: "destructive"
          })
        } else if (response.status === 429) {
          setError('Too many login attempts. Please wait a few minutes before trying again.')
          toast({
            title: "Rate Limited",
            description: "Please wait before attempting to login again.",
            variant: "destructive"
          })
        } else if (response.status === 401) {
          setError('Invalid username or password. Please check your credentials and try again.')
        } else {
          setError(data.error || 'Login failed. Please try again.')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Network error. Please check your connection and try again.')
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your internet connection.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Handle successful face recognition
  const handleFaceSuccess = () => {
    toast({
      title: "Success",
      description: "Face recognized! Logging you in...",
    })
    
    // Redirect to tutorial page
    router.push('/tutorial')
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-8 px-4">
      <div className="max-w-[1800px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 h-[90vh]">
        {/* Left section with visualizer */}
        <div className="h-full">
          <div className="bg-blue-600 rounded-3xl p-8 lg:p-12 h-full flex flex-col">
            {/* Logo */}
            <div className="mb-12">
              <Image
                src="/logo/FL Logo Transparent.png"
                alt="FutureLearner.ai"
                width={240}
                height={80}
                className="h-16 w-auto"
                priority
              />
              <p className="mt-2 text-lg text-white/90">AI Tutor for Every Student</p>
            </div>

            {/* Visualizer container */}
            <div className="flex-1 flex items-center justify-center flex-col">
              <div className="w-full max-w-[600px] aspect-[5/2] relative">
                <AudioVisualizer isPlaying={isPlaying} audioElement={audioRef.current} />
              </div>
              <AudioCaption isPlaying={isPlaying} />
            </div>

            <p className="text-sm text-white/80 mt-12">Made with ❤️ in Singapore</p>
          </div>
        </div>

        {/* Right section with login form */}
        <div className="h-full flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome to FutureLearner</h2>
              <p className="mt-2 text-sm text-gray-600">Let's start your learning adventure!</p>
            </div>

            {isMounted ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="face">Face Login</TabsTrigger>
                  <TabsTrigger value="credentials">Username</TabsTrigger>
                </TabsList>

                <TabsContent value="face">
                  <Card className="p-6">
                    {showCamera ? (
                      <FaceRecognition 
                        onSuccess={handleFaceSuccess}
                        onCancel={() => setShowCamera(false)}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        setFaceMessage={setFaceMessage}
                        setFaceSuccess={setFaceSuccess}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-10 w-10 text-blue-600"
                          >
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold">Face Recognition Login</h3>
                          <p className="text-sm text-gray-500 mt-1">Quick and easy way to log in without typing!</p>
                        </div>

                        {faceMessage && (
                          <div className={`text-sm ${faceSuccess ? "text-green-600" : "text-blue-600"}`}>{faceMessage}</div>
                        )}

                        <Button className="w-full" onClick={() => { setShowCamera(true); playWelcomeAudio(); }} disabled={isLoading}>
                          {isLoading ? <LoaderOne /> : 'Start Face Login'}
                        </Button>
                      </div>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="credentials">
                  <Card className="p-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                      {/* Username input */}
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="Enter your username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          disabled={isLoading}
                          className={error && !username ? 'border-red-300' : ''}
                        />
                      </div>

                      {/* Password input */}
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            placeholder="Enter your password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            className={error && !password ? 'border-red-300 pr-10' : 'pr-10'}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Error messages */}
                      {error && (
                        <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md border border-red-100 flex items-center">
                          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {error}
                        </div>
                      )}
                      
                      <Button 
                        className="w-full" 
                        type="submit"
                        disabled={isLoading}
                      >
                        {isLoading ? <LoaderOne /> : 'Login'}
                      </Button>

                      {/* Additional help text */}
                      <div className="text-xs text-gray-500 text-center mt-4">
                        <p>Forgot your password? Ask your teacher or parent for help.</p>
                      </div>
                    </form>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              // Fallback content while client-side rendering is loading
              <Card className="p-6">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-10 h-10 border-t-2 border-blue-500 border-solid rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-500">Loading login options...</p>
                </div>
              </Card>
            )}

            <div className="text-xs text-gray-500 text-center">
              Need help? Ask your teacher or parent to help you log in.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}