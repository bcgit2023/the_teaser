'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Search,
  Filter,
  Plus,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  LogOut,
  BookOpen,
  PieChart,
  Activity,
  GraduationCap,
  Award,
  Sun,
  Moon,
  HelpCircle,
  Eye,
  CheckCircle,
  XCircle,
  Volume2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { TTSConfigManager } from '@/lib/tts-config'
import { testBrowserTTS } from '@/lib/browser-tts'

// Types
interface User {
  id: number
  username: string
  role: 'student' | 'admin'
  email?: string
  full_name?: string
  created_at: string
}

interface NewUser {
  username: string
  password: string
  role: 'student' | 'admin'
  email: string
  full_name: string
}

interface QuizQuestion {
  id: number
  quiz_id?: number
  question_text: string
  correct_word: string
  user_answer?: string
  options: string
  option_1?: string
  option_2?: string
  option_3?: string
  option_4?: string
  correct_option?: number
  type?: string
  difficulty_level?: number
}

interface AdminStats {
  totalUsers: number
  activeCourses: number
  averageProgress: number
  completionRate: number
  recentActivity: number
}

interface StudentProgress {
  id: number
  name: string
  email: string
  progress: number
  totalQuizzes: number
  averageScore: number
  lastActivity: string | null
  status: string
}

interface RecentActivity {
  id: string
  type: string
  user: string
  description: string
  timestamp: string
  score?: number
}

interface QuizAnswer {
  id: number
  quiz_result_id: number
  question_text: string
  selected_answer: string
  correct_answer: string
  is_correct: boolean
}

interface QuizResult {
  id: number
  score: number
  correct_answers: number
  total_questions: number
  completed_at: string
  answers: QuizAnswer[]
}

interface QuizDetailsData {
  user: {
    id: number
    username: string
    full_name?: string
  }
  quizResults: QuizResult[]
}

export default function AdminDashboard() {
  const router = useRouter()
  
  // State
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isDarkMode, setIsDarkMode] = useState(true) // Default to dark mode
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // Form states
  const [newUser, setNewUser] = useState<NewUser>({
    username: '',
    password: '',
    role: 'student',
    email: '',
    full_name: ''
  })
  const [newPassword, setNewPassword] = useState('')

  // Questions state
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionSearchTerm, setQuestionSearchTerm] = useState('')
  const [questionTypeFilter, setQuestionTypeFilter] = useState('all')
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)
  const [isEditQuestionDialogOpen, setIsEditQuestionDialogOpen] = useState(false)

  // Dashboard data state
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: 0,
    activeCourses: 0,
    averageProgress: 0,
    completionRate: 0,
    recentActivity: 0
  })
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)

  // Quiz details modal state
  const [isQuizDetailsOpen, setIsQuizDetailsOpen] = useState(false)
  const [quizDetailsData, setQuizDetailsData] = useState<QuizDetailsData | null>(null)
  const [quizDetailsLoading, setQuizDetailsLoading] = useState(false)

  // TTS configuration state
  const [ttsConfig, setTtsConfig] = useState({
    provider: 'browser',
    fallbackProvider: 'openai',
    browserSettings: {
      voice: 'default',
      rate: 1,
      pitch: 1
    }
  })
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsStatus, setTtsStatus] = useState({
    browser: 'available',
    openai: 'warning',
    elevenlabs: 'unknown'
  })

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      // Handle the nested users structure from the API
      if (data.success && data.users && Array.isArray(data.users.users)) {
        setUsers(data.users.users)
      } else if (data.success && Array.isArray(data.users)) {
        // Fallback for direct array format
        setUsers(data.users)
      } else {
        console.error('Invalid users data received:', data)
        setUsers([]) // Ensure users is always an array
        toast.error(data.error || 'Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([]) // Ensure users is always an array
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  // Fetch questions
  const fetchQuestions = async () => {
    setQuestionsLoading(true)
    try {
      const response = await fetch('/api/admin/questions?limit=1000')
      const data = await response.json()
      
      if (response.ok) {
        setQuestions(data.questions || [])
      } else {
        toast.error(data.error || 'Failed to fetch questions')
      }
    } catch (error) {
      console.error('Error fetching questions:', error)
      toast.error('Failed to fetch questions')
    } finally {
      setQuestionsLoading(false)
    }
  }

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      
      if (response.ok) {
        setAdminStats(data)
      } else {
        console.error('Failed to fetch admin stats:', data.error)
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    }
  }

  // Fetch student progress
  const fetchStudentProgress = async () => {
    try {
      const response = await fetch('/api/admin/student-progress')
      const data = await response.json()
      
      if (response.ok && Array.isArray(data)) {
        setStudentProgress(data)
      } else {
        console.error('Failed to fetch student progress:', data.error)
        setStudentProgress([]) // Ensure studentProgress is always an array
        toast.error('Failed to fetch student progress')
      }
    } catch (error) {
      console.error('Error fetching student progress:', error)
      setStudentProgress([]) // Ensure studentProgress is always an array
      toast.error('Failed to fetch student progress')
    }
  }

  // Fetch recent activities
  const fetchRecentActivities = async () => {
    try {
      const response = await fetch('/api/admin/recent-activities')
      const data = await response.json()
      
      if (response.ok && Array.isArray(data)) {
        setRecentActivities(data)
      } else {
        console.error('Failed to fetch recent activities:', data.error)
        setRecentActivities([]) // Ensure recentActivities is always an array
        toast.error('Failed to fetch recent activities')
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      setRecentActivities([]) // Ensure recentActivities is always an array
      toast.error('Failed to fetch recent activities')
    }
  }

  // Fetch quiz details for a specific student
  const fetchQuizDetails = async (studentId: number) => {
    setQuizDetailsLoading(true)
    try {
      // Debug: Check cookies
      console.log('Document cookies:', document.cookie)
      
      const response = await fetch(`/api/admin/quiz-details/${studentId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      const data = await response.json()
      
      if (response.ok) {
        setQuizDetailsData(data)
      } else {
        console.error('Quiz details API error:', data)
        toast.error(data.error || 'Failed to fetch quiz details')
      }
    } catch (error) {
      console.error('Error fetching quiz details:', error)
      toast.error('Failed to fetch quiz details')
    } finally {
      setQuizDetailsLoading(false)
    }
  }

  // Handle opening quiz details modal
  const handleViewQuizDetails = async (studentId: number) => {
    setIsQuizDetailsOpen(true)
    await fetchQuizDetails(studentId)
  }

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    setDashboardLoading(true)
    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchStudentProgress(),
        fetchRecentActivities()
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setDashboardLoading(false)
    }
  }

  // Create user
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User created successfully')
        setUsers([data.user, ...users])
        setNewUser({
          username: '',
          password: '',
          role: 'student',
          email: '',
          full_name: ''
        })
        setIsCreateDialogOpen(false)
      } else {
        toast.error(data.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
    }
  }

  // Update user
  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      const updateData: any = { ...editingUser }
      if (newPassword.trim()) {
        updateData.password = newPassword
      }

      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User updated successfully')
        setUsers(users.map(user => 
          user.id === editingUser.id ? data.user : user
        ))
        setIsEditDialogOpen(false)
        setEditingUser(null)
        setNewPassword('')
      } else {
        toast.error(data.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    }
  }

  // Delete user
  const handleDeleteUser = async (userId: number) => {
    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('User deleted successfully')
        setUsers(users.filter(user => user.id !== userId))
      } else {
        toast.error(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  // Theme toggle
  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    
    // Apply theme to document and localStorage (client-side only)
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin-theme', newTheme ? 'dark' : 'light')
      
      if (newTheme) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  // Logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/login')
      } else {
        toast.error('Failed to logout')
      }
    } catch (error) {
      console.error('Error logging out:', error)
      toast.error('Failed to logout')
    }
  }

  // TTS Configuration Functions
  const loadTTSConfig = async () => {
    try {
      const config = TTSConfigManager.getConfig()
      setTtsConfig({
        provider: config.primaryProvider || 'browser',
        fallbackProvider: config.fallbackProvider || 'openai',
        browserSettings: {
          voice: config.browserTTS.voice || 'default',
          rate: config.browserTTS.rate || 1,
          pitch: config.browserTTS.pitch || 1
        }
      })
    } catch (error) {
      console.error('Error loading TTS config:', error)
    }
  }

  const saveTTSConfig = async (newConfig: any) => {
    try {
      TTSConfigManager.updateConfig({
        primaryProvider: newConfig.provider,
        fallbackProvider: newConfig.fallbackProvider,
        browserTTS: {
          voice: newConfig.browserSettings.voice,
          rate: newConfig.browserSettings.rate,
          pitch: newConfig.browserSettings.pitch,
          volume: 1.0
        }
      })
      setTtsConfig(newConfig)
      toast.success('TTS settings saved successfully')
    } catch (error) {
      console.error('Error saving TTS config:', error)
      toast.error('Failed to save TTS settings')
    }
  }

  const loadAvailableVoices = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = speechSynthesis.getVoices()
      setAvailableVoices(voices)
      
      // If voices aren't loaded yet, wait for the event
      if (voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
          setAvailableVoices(speechSynthesis.getVoices())
        })
      }
    }
  }

  const testTTSProvider = async (provider: string) => {
    try {
      if (provider === 'browser') {
        testBrowserTTS() // This function returns void, just call it
        setTtsStatus(prev => ({ ...prev, browser: 'available' }))
        toast.success('Browser TTS test successful')
      } else {
        toast.info(`Testing ${provider} TTS...`)
        // For now, just show a placeholder status
        setTtsStatus(prev => ({ ...prev, [provider]: 'testing' }))
      }
    } catch (error) {
      console.error(`Error testing ${provider} TTS:`, error)
      setTtsStatus(prev => ({ ...prev, [provider]: 'error' }))
      toast.error(`Failed to test ${provider} TTS`)
    }
  }

  const testVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('This is a test of the selected voice settings.')
      
      // Apply current settings
      if (ttsConfig.browserSettings.voice !== 'default') {
        const selectedVoice = availableVoices.find(voice => voice.name === ttsConfig.browserSettings.voice)
        if (selectedVoice) {
          utterance.voice = selectedVoice
        }
      }
      
      utterance.rate = ttsConfig.browserSettings.rate
      utterance.pitch = ttsConfig.browserSettings.pitch
      
      speechSynthesis.speak(utterance)
      toast.success('Playing voice test')
    } else {
      toast.error('Speech synthesis not supported in this browser')
    }
  }

  // Filter users with safety checks
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) {
      return []
    }
    return users.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      
      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, roleFilter])

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'teacher':
        return isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-800'
      case 'student':
        return isDarkMode ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-green-100 text-green-800'
      case 'parent':
        return isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-800'
      case 'admin':
        return isDarkMode ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-green-100 text-green-800'
      default:
        return isDarkMode ? 'bg-gray-800/50 text-gray-300 border border-gray-500/30' : 'bg-gray-100 text-gray-800'
    }
  }

  // Get activity icon
  const getActivityIcon = (type: string, colorClass: string = 'text-gray-500') => {
    switch (type) {
      case 'user_created':
      case 'user_registered':
        return <UserPlus className={`h-4 w-4 ${colorClass}`} />
      case 'course_completed':
        return <GraduationCap className={`h-4 w-4 ${colorClass}`} />
      case 'quiz_submitted':
      case 'quiz_completed':
        return <Award className={`h-4 w-4 ${colorClass}`} />
      default:
        return <Activity className={`h-4 w-4 ${colorClass}`} />
    }
  }

  // Calculate stats with safety checks
  const { totalUsers, studentCount, adminCount } = useMemo(() => {
    if (!Array.isArray(users)) {
      return { totalUsers: 0, studentCount: 0, adminCount: 0 }
    }
    return {
      totalUsers: users.length,
      studentCount: users.filter(u => u.role === 'student').length,
      adminCount: users.filter(u => u.role === 'admin').length
    }
  }, [users])

  useEffect(() => {
    fetchUsers()
    fetchQuestions()
    fetchDashboardData()
    
    // Initialize TTS configuration
    loadTTSConfig()
    loadAvailableVoices()
    
    // Initialize theme from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('admin-theme')
      if (savedTheme) {
        const isDark = savedTheme === 'dark'
        setIsDarkMode(isDark)
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      } else {
        // Default to dark mode
        document.documentElement.classList.add('dark')
      }
    }
  }, [])

  if (loading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Tabs defaultValue="overview" className="flex h-screen">
        {/* Sidebar */}
        <div className={`w-64 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col`}>
          <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>FutureLearner</h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Admin Dashboard</p>
          </div>
          
          <nav className="flex-1">
            <TabsList className="grid w-full grid-cols-1 h-auto bg-transparent p-0">
              <TabsTrigger 
                value="overview" 
                className={`w-full justify-start px-6 py-3 text-left ${isDarkMode ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-r-2 data-[state=active]:border-blue-400`}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className={`w-full justify-start px-6 py-3 text-left ${isDarkMode ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-r-2 data-[state=active]:border-blue-400`}
              >
                <Users className="h-4 w-4 mr-3" />
                Users
              </TabsTrigger>
              <TabsTrigger 
                value="questions" 
                className={`w-full justify-start px-6 py-3 text-left ${isDarkMode ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-r-2 data-[state=active]:border-blue-400`}
              >
                <HelpCircle className="h-4 w-4 mr-3" />
                Questions
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className={`w-full justify-start px-6 py-3 text-left ${isDarkMode ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-r-2 data-[state=active]:border-blue-400`}
              >
                <PieChart className="h-4 w-4 mr-3" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="tts-settings" 
                className={`w-full justify-start px-6 py-3 text-left ${isDarkMode ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'} data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-r-2 data-[state=active]:border-blue-400`}
              >
                <Volume2 className="h-4 w-4 mr-3" />
                TTS Settings
              </TabsTrigger>
            </TabsList>
          </nav>
          
          <div className="mt-auto p-6">
            <Separator className={`mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className={`w-full justify-start mb-2 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100' : 'border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                onClick={toggleTheme}
              >
                {isDarkMode ? <Sun className="h-4 w-4 mr-3" /> : <Moon className="h-4 w-4 mr-3" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>
              <Button 
                variant="outline" 
                className={`w-full justify-start ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100' : 'border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 overflow-auto relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className={`absolute inset-0 ${isDarkMode ? 'bg-blue-900/10' : 'bg-blue-100/20'}`}></div>
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, ${isDarkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)'} 0%, transparent 50%), radial-gradient(circle at 75% 75%, ${isDarkMode ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.03)'} 0%, transparent 50%)`,
              backgroundSize: '400px 400px'
            }}></div>
          </div>
          <div className="p-8 relative z-10">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} shadow-lg`}>
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          Dashboard Overview
                        </h2>
                        <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex items-center gap-2`}>
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'} animate-pulse`}></div>
                          Welcome to the FutureLearner admin dashboard
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Users Card - Blue */}
                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-blue-800 border-blue-600' : 'bg-blue-100 border-blue-300'} shadow-lg hover:shadow-xl transition-all duration-300`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>Total Users</CardTitle>
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-700/50' : 'bg-blue-200/70'}`}>
                          <Users className={`h-5 w-5 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>{totalUsers}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-blue-200' : 'text-blue-700'} flex items-center mt-1`}>
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}></div>
                          {studentCount} students, {adminCount} admins
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quiz Attempts Card - Green */}
                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-green-800 border-green-600' : 'bg-green-100 border-green-300'} shadow-lg hover:shadow-xl transition-all duration-300`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-green-100' : 'text-green-800'}`}>Quiz Attempts</CardTitle>
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-green-700/50' : 'bg-green-200/70'}`}>
                          <BookOpen className={`h-5 w-5 ${isDarkMode ? 'text-green-300' : 'text-green-600'}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-green-900'}`}>{adminStats.activeCourses}</div>
                        <p className={`text-xs ${isDarkMode ? 'text-green-200' : 'text-green-700'} flex items-center mt-1`}>
                          <Activity className="h-3 w-3 mr-1 text-green-400" />
                          Total quiz attempts
                        </p>
                      </CardContent>
                    </Card>

                    {/* Average Score Card - Blue */}
                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-blue-700 border-blue-500' : 'bg-blue-50 border-blue-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>Average Score</CardTitle>
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-600/50' : 'bg-blue-200/70'}`}>
                          <TrendingUp className={`h-5 w-5 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>{adminStats.averageProgress}%</div>
                        <p className={`text-xs ${isDarkMode ? 'text-blue-200' : 'text-blue-700'} flex items-center mt-1`}>
                          <BarChart3 className="h-3 w-3 mr-1 text-blue-400" />
                          Across all quizzes
                        </p>
                      </CardContent>
                    </Card>

                    {/* Completion Rate Card - Green */}
                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-green-700 border-green-500' : 'bg-green-50 border-green-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-green-100' : 'text-green-800'}`}>Completion Rate</CardTitle>
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-green-600/50' : 'bg-green-200/70'}`}>
                          <Award className={`h-5 w-5 ${isDarkMode ? 'text-green-300' : 'text-green-600'}`} />
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-green-900'}`}>{adminStats.completionRate}%</div>
                        <p className={`text-xs ${isDarkMode ? 'text-green-200' : 'text-green-700'} flex items-center mt-1`}>
                          <Users className="h-3 w-3 mr-1 text-green-400" />
                          Students with quiz attempts
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recent Activities */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'} shadow-lg`}>
                      <CardHeader className="relative z-10">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                            <GraduationCap className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                          </div>
                          <div>
                            <CardTitle className={`${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Student Progress</CardTitle>
                            <CardDescription className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Recent student achievements</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 relative z-10">
                        {studentProgress.length > 0 ? studentProgress.map((student) => {
                          // Determine progress color based on score
                          const getProgressColor = (progress: number) => {
                            if (progress >= 80) return 'bg-green-500'
                            if (progress >= 60) return 'bg-blue-500'
                            if (progress >= 40) return 'bg-blue-400'
                            return 'bg-blue-300'
                          }
                          
                          const getProgressBg = (progress: number) => {
                            if (progress >= 80) return isDarkMode ? 'bg-green-900/30' : 'bg-green-50'
                            if (progress >= 60) return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'
                            if (progress >= 40) return isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'
                            return isDarkMode ? 'bg-red-900/30' : 'bg-red-50'
                          }

                          return (
                            <div key={student.id} className={`p-4 rounded-lg border ${getProgressBg(student.progress)} ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} hover:shadow-md transition-all duration-200`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="ring-2 ring-blue-500/20">
                                    <AvatarFallback className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'} font-semibold`}>
                                      {student.name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{student.name}</div>
                                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex items-center gap-2`}>
                                      <BookOpen className="h-3 w-3" />
                                      {student.totalQuizzes} quizzes • Avg: {student.averageScore}%
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="relative w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div 
                                          className={`absolute inset-y-0 left-0 ${getProgressColor(student.progress)} rounded-full transition-all duration-500`}
                                          style={{ width: `${student.progress}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} min-w-[3rem]`}>
                                        {student.progress}%
                                      </span>
                                    </div>
                                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {student.progress >= 80 ? 'Excellent' : 
                                       student.progress >= 60 ? 'Good' : 
                                       student.progress >= 40 ? 'Fair' : 'Needs Improvement'}
                                    </div>
                                  </div>
                                  {student.totalQuizzes > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewQuizDetails(student.id)}
                                      className={`${isDarkMode ? 'text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white' : 'text-blue-600 border-blue-300 hover:bg-blue-600 hover:text-white'} transition-all duration-200`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View Details
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }) : (
                          <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} py-8`}>
                            <GraduationCap className={`h-12 w-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                            <p>No student progress data available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'} shadow-lg`}>
                      <CardHeader className="relative z-10">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-600/20' : 'bg-green-100'}`}>
                            <Activity className={`h-5 w-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                          </div>
                          <div>
                            <CardTitle className={`${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Recent Activities</CardTitle>
                            <CardDescription className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Latest system activities</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 relative z-10">
                        {recentActivities.map((activity) => {
                          // Determine activity colors based on type
                          const getActivityStyle = (type: string, score?: number) => {
                            switch (type) {
                              case 'quiz_completed':
                                if (score && score >= 80) return {
                                  bg: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
                                  border: 'border-green-500/30',
                                  icon: 'text-green-500',
                                  iconBg: isDarkMode ? 'bg-green-600/20' : 'bg-green-100'
                                }
                                if (score && score >= 60) return {
                                  bg: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
                                  border: 'border-blue-500/30',
                                  icon: 'text-blue-500',
                                  iconBg: isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'
                                }
                                return {
                                  bg: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
                                  border: 'border-blue-500/30',
                                  icon: 'text-blue-500',
                                  iconBg: isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'
                                }
                              case 'user_registered':
                                return {
                                  bg: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
                                  border: 'border-green-500/30',
                                  icon: 'text-green-500',
                                  iconBg: isDarkMode ? 'bg-green-600/20' : 'bg-green-100'
                                }
                              default:
                                return {
                                  bg: isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50',
                                  border: 'border-gray-500/30',
                                  icon: 'text-gray-500',
                                  iconBg: isDarkMode ? 'bg-gray-600/20' : 'bg-gray-100'
                                }
                            }
                          }

                          const style = getActivityStyle(activity.type, activity.score)
                          
                          return (
                            <div key={activity.id} className={`p-3 rounded-lg border ${style.bg} ${style.border} hover:shadow-md transition-all duration-200`}>
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${style.iconBg} flex-shrink-0`}>
                                  {getActivityIcon(activity.type, style.icon)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                    {activity.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex items-center gap-1">
                                      <div className={`w-2 h-2 rounded-full ${style.icon.replace('text-', 'bg-')}`}></div>
                                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {activity.user}
                                      </span>
                                    </div>
                                    <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
                                    <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {activity.timestamp}
                                    </span>
                                    {activity.score !== undefined && (
                                      <>
                                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
                                        <span className={`text-xs font-semibold ${style.icon}`}>
                                          {activity.score}%
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Users Tab */}
                <TabsContent value="users" className="space-y-6">
                  <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'} shadow-lg`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>User Management</CardTitle>
                          <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Manage platform users and their permissions</CardDescription>
                        </div>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className={`${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add User
                            </Button>
                          </DialogTrigger>
                          <DialogContent className={`${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                            <DialogHeader>
                              <DialogTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Create New User</DialogTitle>
                              <DialogDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Add a new user to the platform
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="username" className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Username</Label>
                                  <Input
                                    id="username"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                    placeholder="Enter username"
                                    className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="password" className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Password</Label>
                                  <Input
                                    id="password"
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                    placeholder="Enter password"
                                    className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="email" className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Email</Label>
                                  <Input
                                    id="email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                    placeholder="Enter email"
                                    className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="role" className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Role</Label>
                                  <Select value={newUser.role} onValueChange={(value: any) => setNewUser({...newUser, role: value})}>
                                    <SelectTrigger className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                      <SelectItem value="student" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Student</SelectItem>
                                      <SelectItem value="admin" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="fullName" className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Full Name</Label>
                                <Input
                                  id="fullName"
                                  value={newUser.full_name}
                                  onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                                  placeholder="Enter full name"
                                  className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleCreateUser} className={`${isDarkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}>Create User</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} h-4 w-4`} />
                            <Input
                              placeholder="Search users..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className={`pl-10 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                            />
                          </div>
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                          <SelectTrigger className={`w-40 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                            <SelectValue placeholder="Filter by role" />
                          </SelectTrigger>
                          <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                            <SelectItem value="all" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>All Roles</SelectItem>
                            <SelectItem value="student" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Students</SelectItem>
                            <SelectItem value="admin" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Admins</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>User</TableHead>
                            <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Role</TableHead>
                            <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Email</TableHead>
                            <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Joined</TableHead>
                            <TableHead className={`text-right ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id} className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarFallback className={`${isDarkMode ? 'bg-slate-600 text-slate-100' : 'bg-slate-200 text-slate-700'}`}>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className={`font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{user.full_name || user.username}</div>
                                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>@{user.username}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getRoleBadgeColor(user.role)}>
                                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{user.email || 'N/A'}</TableCell>
                              <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingUser(user)
                                      setIsEditDialogOpen(true)
                                    }}
                                    className="border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will permanently delete the user account.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Edit User Dialog */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className={isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}>
                      <DialogHeader>
                        <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>Edit User</DialogTitle>
                        <DialogDescription className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                          Update user information
                        </DialogDescription>
                      </DialogHeader>
                      {editingUser && (
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-username" className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Username</Label>
                            <Input
                              id="edit-username"
                              value={editingUser.username}
                              onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                              className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-role" className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Role</Label>
                            <Select value={editingUser.role} onValueChange={(value: any) => setEditingUser({...editingUser, role: value})}>
                              <SelectTrigger className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className={isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}>
                                <SelectItem value="student" className={isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-900 hover:bg-gray-100'}>Student</SelectItem>
                                <SelectItem value="admin" className={isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-900 hover:bg-gray-100'}>Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-email" className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Email</Label>
                            <Input
                              id="edit-email"
                              type="email"
                              value={editingUser.email || ''}
                              onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                              className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-fullName" className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Full Name</Label>
                            <Input
                              id="edit-fullName"
                              value={editingUser.full_name || ''}
                              onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                              className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-password" className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>New Password (optional)</Label>
                            <Input
                              id="edit-password"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Leave empty to keep current password"
                              className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}
                            />
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button onClick={handleUpdateUser} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">Update User</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                {/* Questions Tab */}
                <TabsContent value="questions" className="space-y-6">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-green-600' : 'bg-green-500'} shadow-lg`}>
                        <HelpCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          Quiz Questions
                        </h2>
                        <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex items-center gap-2`}>
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-green-400' : 'bg-green-500'} animate-pulse`}></div>
                          Manage quiz questions from the database
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Questions Management */}
                  <Card className={`relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-green-600/20' : 'bg-green-200/70'}`}>
                          <BookOpen className={`h-5 w-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <div>
                          <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Questions Database</CardTitle>
                          <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            View and manage quiz questions from quiz.db
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                            <Input
                              placeholder="Search questions..."
                              value={questionSearchTerm}
                              onChange={(e) => setQuestionSearchTerm(e.target.value)}
                              className={`pl-10 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                            />
                          </div>
                        </div>
                        <Select value={questionTypeFilter} onValueChange={setQuestionTypeFilter}>
                          <SelectTrigger className={`w-48 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                            <Filter className={`h-4 w-4 mr-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                            <SelectValue placeholder="Filter by type" />
                          </SelectTrigger>
                          <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                            <SelectItem value="all" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>All Types</SelectItem>
                            <SelectItem value="multiple_choice" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Multiple Choice</SelectItem>
                            <SelectItem value="true_false" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>True/False</SelectItem>
                            <SelectItem value="fill_blank" className={`${isDarkMode ? 'text-slate-100 hover:bg-slate-600' : 'text-slate-900 hover:bg-slate-100'}`}>Fill in the Blank</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {questionsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkMode ? 'border-green-400' : 'border-green-600'}`}></div>
                          <span className={`ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading questions...</span>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100/50'}`}>
                              <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>ID</TableHead>
                              <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Question</TableHead>
                              <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Type</TableHead>
                              <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Correct Answer</TableHead>
                              <TableHead className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Difficulty</TableHead>
                              <TableHead className={`text-right ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {questions
                              .filter(question => {
                                const matchesSearch = question.question_text.toLowerCase().includes(questionSearchTerm.toLowerCase())
                                const matchesType = questionTypeFilter === 'all' || question.type === questionTypeFilter
                                return matchesSearch && matchesType
                              })
                              .map((question) => (
                                <TableRow key={question.id} className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100/50'}`}>
                                  <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{question.id}</TableCell>
                                  <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'} max-w-md`}>
                                    <div className="truncate" title={question.question_text}>
                                      {question.question_text}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-800'}>
                                      {question.type || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {question.correct_word || `Option ${question.correct_option}` || 'N/A'}
                                  </TableCell>
                                  <TableCell className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {question.difficulty_level || 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingQuestion(question)
                                          setIsEditQuestionDialogOpen(true)
                                        }}
                                        className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      )}

                      {questions.length === 0 && !questionsLoading && (
                        <div className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          No questions found in the database.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Edit Question Dialog */}
                  <Dialog open={isEditQuestionDialogOpen} onOpenChange={setIsEditQuestionDialogOpen}>
                    <DialogContent className={`${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                      <DialogHeader>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isDarkMode ? 'bg-green-600/20' : 'bg-green-200/70'}`}>
                            <Eye className={`h-5 w-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                          </div>
                          <div>
                            <DialogTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>View Question Details</DialogTitle>
                            <DialogDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              Question information from the database
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>
                      {editingQuestion && (
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Question Text</Label>
                            <div className={`p-3 rounded-md ${isDarkMode ? 'bg-slate-700 border border-slate-600 text-slate-100' : 'bg-slate-100 border border-slate-300 text-slate-900'}`}>
                              {editingQuestion.question_text}
                            </div>
                          </div>
                          {editingQuestion.options && (
                            <div className="space-y-2">
                              <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Options</Label>
                              <div className={`p-3 rounded-md ${isDarkMode ? 'bg-slate-700 border border-slate-600 text-slate-100' : 'bg-slate-100 border border-slate-300 text-slate-900'}`}>
                                {editingQuestion.options}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Correct Answer</Label>
                              <div className={`p-3 rounded-md ${isDarkMode ? 'bg-green-900/20 border border-green-500/30 text-green-300' : 'bg-green-100 border border-green-300 text-green-800'}`}>
                                {editingQuestion.correct_word || `Option ${editingQuestion.correct_option}` || 'N/A'}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Type</Label>
                              <div className={`p-3 rounded-md ${isDarkMode ? 'bg-blue-900/20 border border-blue-500/30 text-blue-300' : 'bg-blue-100 border border-blue-300 text-blue-800'}`}>
                                {editingQuestion.type || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Difficulty Level</Label>
                            <div className={`p-3 rounded-md ${isDarkMode ? 'bg-slate-700 border border-slate-600 text-slate-100' : 'bg-slate-100 border border-slate-300 text-slate-900'}`}>
                              {editingQuestion.difficulty_level || 'N/A'}
                            </div>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button 
                          onClick={() => setIsEditQuestionDialogOpen(false)}
                          className={`${isDarkMode ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                  <div>
                    <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Analytics</h2>
                    <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Comprehensive insights and reports</p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Daily Active Users</CardTitle>
                        <Users className={`h-4 w-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{Math.floor(totalUsers * 0.7)}</div>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} flex items-center`}>
                          <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                          +12% from last week
                        </p>
                      </CardContent>
                    </Card>

                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Course Completion</CardTitle>
                        <BookOpen className={`h-4 w-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>87%</div>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} flex items-center`}>
                          <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                          +3% from last week
                        </p>
                      </CardContent>
                    </Card>

                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Avg. Session Time</CardTitle>
                        <Clock className={`h-4 w-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>45m</div>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} flex items-center`}>
                          <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                          -5% from last week
                        </p>
                      </CardContent>
                    </Card>

                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>User Growth</CardTitle>
                        <TrendingUp className={`h-4 w-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>+{Math.floor(totalUsers * 0.1)}</div>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} flex items-center`}>
                          <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                          +8% from last month
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* User Distribution */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader>
                        <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>User Distribution</CardTitle>
                        <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Users by role</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Students</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{studentCount}</span>
                              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>({Math.round((studentCount / totalUsers) * 100)}%)</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Admins</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{adminCount}</span>
                              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>({Math.round((adminCount / totalUsers) * 100)}%)</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader>
                        <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Recent Registrations</CardTitle>
                        <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>New users this week</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {users.slice(0, 5).map((user) => (
                            <div key={user.id} className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className={`${isDarkMode ? 'bg-slate-600 text-slate-100' : 'bg-slate-200 text-slate-700'}`}>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className={`font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{user.full_name || user.username}</div>
                                <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{user.role}</div>
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                {new Date(user.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Export Section */}
                  <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Reports & Export</CardTitle>
                          <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Download comprehensive reports</CardDescription>
                        </div>
                        <Button variant="outline" className={`${isDarkMode ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                          <Download className="h-4 w-4 mr-2" />
                          Export Report
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                          <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>4.8</div>
                          <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Avg. Rating</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Platform satisfaction</div>
                        </div>
                        <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                          <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>92%</div>
                          <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Retention Rate</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>User retention</div>
                        </div>
                        <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                          <div className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{totalUsers}</div>
                          <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Total Users</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>All time</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TTS Settings Tab */}
                <TabsContent value="tts-settings" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* TTS Provider Selection */}
                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader>
                        <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>TTS Provider</CardTitle>
                        <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Select the text-to-speech service to use
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Primary TTS Provider</Label>
                          <Select 
                            value={ttsConfig.provider} 
                            onValueChange={(value) => {
                              const newConfig = { ...ttsConfig, provider: value }
                              saveTTSConfig(newConfig)
                            }}
                          >
                            <SelectTrigger className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                              <SelectValue placeholder="Select TTS provider" />
                            </SelectTrigger>
                            <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}>
                              <SelectItem value="browser" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                Browser TTS (Recommended for Vercel)
                              </SelectItem>
                              <SelectItem value="openai" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                OpenAI TTS
                              </SelectItem>
                              <SelectItem value="elevenlabs" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                ElevenLabs TTS
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-3">
                          <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Fallback Provider</Label>
                          <Select 
                            value={ttsConfig.fallbackProvider} 
                            onValueChange={(value) => {
                              const newConfig = { ...ttsConfig, fallbackProvider: value }
                              saveTTSConfig(newConfig)
                            }}
                          >
                            <SelectTrigger className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                              <SelectValue placeholder="Select fallback provider" />
                            </SelectTrigger>
                            <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}>
                              <SelectItem value="openai" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                OpenAI TTS
                              </SelectItem>
                              <SelectItem value="elevenlabs" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                ElevenLabs TTS
                              </SelectItem>
                              <SelectItem value="none" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                No Fallback
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-blue-900/20 border border-blue-600' : 'bg-blue-50 border border-blue-200'}`}>
                          <div className="flex items-start gap-3">
                            <HelpCircle className={`h-5 w-5 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            <div>
                              <div className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Browser TTS Recommended</div>
                              <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                Browser TTS is recommended for Vercel deployments to avoid serverless function timeout issues.
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Browser TTS Settings */}
                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <CardHeader>
                        <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Browser TTS Settings</CardTitle>
                        <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Configure browser text-to-speech options
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Voice</Label>
                          <Select 
                            value={ttsConfig.browserSettings.voice} 
                            onValueChange={(value) => {
                              const newConfig = { 
                                ...ttsConfig, 
                                browserSettings: { ...ttsConfig.browserSettings, voice: value }
                              }
                              saveTTSConfig(newConfig)
                            }}
                          >
                            <SelectTrigger className={`${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                              <SelectValue placeholder="Select voice" />
                            </SelectTrigger>
                            <SelectContent className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'}`}>
                              <SelectItem value="default" className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}>
                                Default System Voice
                              </SelectItem>
                              {availableVoices.map((voice) => (
                                <SelectItem 
                                  key={voice.name} 
                                  value={voice.name}
                                  className={`${isDarkMode ? 'text-slate-100 focus:bg-slate-600' : 'text-slate-900 focus:bg-slate-100'}`}
                                >
                                  {voice.name} ({voice.lang})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Speech Rate</Label>
                          <div className="flex items-center gap-4">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Slow</span>
                            <input
                              type="range"
                              min="0.5"
                              max="2"
                              step="0.1"
                              value={ttsConfig.browserSettings.rate}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...ttsConfig, 
                                  browserSettings: { ...ttsConfig.browserSettings, rate: parseFloat(e.target.value) }
                                }
                                saveTTSConfig(newConfig)
                              }}
                              className="flex-1"
                            />
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Fast</span>
                          </div>
                          <div className={`text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {ttsConfig.browserSettings.rate}x
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Pitch</Label>
                          <div className="flex items-center gap-4">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Low</span>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.1"
                              value={ttsConfig.browserSettings.pitch}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...ttsConfig, 
                                  browserSettings: { ...ttsConfig.browserSettings, pitch: parseFloat(e.target.value) }
                                }
                                saveTTSConfig(newConfig)
                              }}
                              className="flex-1"
                            />
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>High</span>
                          </div>
                          <div className={`text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {ttsConfig.browserSettings.pitch}
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          onClick={() => testVoice()}
                          className={`w-full ${isDarkMode ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                        >
                          Test Voice
                        </Button>
                      </CardContent>
                    </Card>

                    {/* TTS Status & Diagnostics */}
                    <Card className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} lg:col-span-2`}>
                      <CardHeader>
                        <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>TTS Status & Diagnostics</CardTitle>
                        <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Current status and troubleshooting information
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                            <div className={`text-3xl font-bold mb-2 ${
                              ttsStatus.browser === 'available' ? 'text-green-400' : 
                              ttsStatus.browser === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {ttsStatus.browser === 'available' ? '✓' : 
                               ttsStatus.browser === 'error' ? '✗' : '⚠'}
                            </div>
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Browser TTS</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {ttsStatus.browser === 'available' ? 'Available' : 
                               ttsStatus.browser === 'error' ? 'Not Available' : 'Testing...'}
                            </div>
                          </div>
                          <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                            <div className={`text-3xl font-bold mb-2 ${
                              ttsStatus.openai === 'available' ? 'text-green-400' : 
                              ttsStatus.openai === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {ttsStatus.openai === 'available' ? '✓' : 
                               ttsStatus.openai === 'error' ? '✗' : '⚠'}
                            </div>
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>OpenAI TTS</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {ttsStatus.openai === 'available' ? 'Available' : 
                               ttsStatus.openai === 'error' ? 'Connection Issues' : 'Testing...'}
                            </div>
                          </div>
                          <div className={`text-center p-6 border rounded-lg ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                            <div className={`text-3xl font-bold mb-2 ${
                              ttsStatus.elevenlabs === 'available' ? 'text-green-400' : 
                              ttsStatus.elevenlabs === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {ttsStatus.elevenlabs === 'available' ? '✓' : 
                               ttsStatus.elevenlabs === 'error' ? '✗' : '?'}
                            </div>
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>ElevenLabs TTS</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {ttsStatus.elevenlabs === 'available' ? 'Available' : 
                               ttsStatus.elevenlabs === 'error' ? 'Connection Issues' : 'Not tested'}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="flex gap-4">
                            <Button 
                              variant="outline" 
                              onClick={async () => {
                                await testTTSProvider('browser')
                                await testTTSProvider('openai')
                                await testTTSProvider('elevenlabs')
                              }}
                              className={`${isDarkMode ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Test All Providers
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                console.log('TTS Configuration:', ttsConfig)
                                console.log('TTS Status:', ttsStatus)
                                console.log('Available Voices:', availableVoices)
                              }}
                              className={`${isDarkMode ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                            >
                              View Logs
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                const defaultConfig = {
                                  provider: 'browser',
                                  fallbackProvider: 'openai',
                                  browserSettings: {
                                    voice: 'default',
                                    rate: 1,
                                    pitch: 1
                                  }
                                }
                                saveTTSConfig(defaultConfig)
                              }}
                              className={`${isDarkMode ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                            >
                              Reset Settings
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>

          {/* Quiz Details Modal */}
          <Dialog open={isQuizDetailsOpen} onOpenChange={setIsQuizDetailsOpen}>
            <DialogContent className={`max-w-4xl max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <DialogHeader>
                <DialogTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  Quiz Details - {quizDetailsData?.user.username || 'Loading...'}
                </DialogTitle>
                <DialogDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Detailed breakdown of quiz attempts and answers
                </DialogDescription>
              </DialogHeader>

              {quizDetailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkMode ? 'border-blue-400' : 'border-blue-600'}`}></div>
                  <span className={`ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading quiz details...</span>
                </div>
              ) : quizDetailsData ? (
                <div className="space-y-6">
                  {quizDetailsData.quizResults.length === 0 ? (
                    <div className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      No quiz attempts found for this student.
                    </div>
                  ) : (
                    quizDetailsData.quizResults.map((quiz, quizIndex) => (
                      <Card key={quiz.id} className={`${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                Quiz Attempt #{quizDetailsData.quizResults.length - quizIndex}
                              </CardTitle>
                              <CardDescription className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Completed on {new Date(quiz.completed_at).toLocaleDateString()} at {new Date(quiz.completed_at).toLocaleTimeString()}
                              </CardDescription>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                {quiz.correct_answers}/{quiz.total_questions}
                              </div>
                              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                {Math.round(quiz.score)}% Score
                              </div>
                            </div>
                          </div>
                          <Progress value={quiz.score} className="mt-2" />
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Question Breakdown:</h4>
                            {Array.from({ length: quiz.total_questions }, (_, index) => {
                              const questionNumber = index + 1;
                              const answer = quiz.answers.find((_, answerIndex) => answerIndex === index);
                              
                              return (
                                <div
                                  key={`question-${questionNumber}`}
                                  className={`p-4 rounded-lg border ${
                                    answer
                                      ? answer.is_correct
                                        ? 'bg-green-900/20 border-green-600'
                                        : 'bg-red-900/20 border-red-600'
                                      : 'bg-gray-900/20 border-gray-600'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-1">
                                      {answer ? (
                                        answer.is_correct ? (
                                          <CheckCircle className="h-5 w-5 text-green-400" />
                                        ) : (
                                          <XCircle className="h-5 w-5 text-red-400" />
                                        )
                                      ) : (
                                        <HelpCircle className="h-5 w-5 text-gray-400" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className={`font-medium mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                        Question {questionNumber}: {answer ? answer.question_text : 'Question data not available'}
                                      </div>
                                      {answer ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Student Answer:</span>
                                            <span
                                              className={`text-sm font-medium ${
                                                answer.is_correct ? 'text-green-400' : 'text-red-400'
                                              }`}
                                            >
                                              {answer.selected_answer}
                                            </span>
                                          </div>
                                          {!answer.is_correct && (
                                            <div className="flex items-center gap-2">
                                              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Correct Answer:</span>
                                              <span className="text-sm font-medium text-green-400">
                                                {answer.correct_answer}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Status:</span>
                                            <span className="text-sm font-medium text-gray-400">
                                              Answer not recorded (submission error)
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <div className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Failed to load quiz details. Please try again.
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsQuizDetailsOpen(false)}
                  className={`${isDarkMode 
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-700' 
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
  )
}