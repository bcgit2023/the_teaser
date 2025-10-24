'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import SimpleWebcamRecorder from '@/components/SimpleWebcamRecorder'
import CircularWebcamRecorder from '@/components/CircularWebcamRecorder'
import ScreenRecorder from '@/components/ScreenRecorder'

interface TestResult {
  component: string
  status: 'idle' | 'recording' | 'uploading' | 'success' | 'error'
  message: string
  uploadUrl?: string
  uploadType?: 'cloudinary' | 'local'
}

export default function TestRecordingPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { component: 'SimpleWebcamRecorder', status: 'idle', message: 'Ready to test' },
    { component: 'CircularWebcamRecorder', status: 'idle', message: 'Ready to test' },
    { component: 'ScreenRecorder', status: 'idle', message: 'Ready to test' }
  ])

  const updateTestResult = (component: string, updates: Partial<TestResult>) => {
    setTestResults(prev => prev.map(result => 
      result.component === component 
        ? { ...result, ...updates }
        : result
    ))
  }

  const handleRecordingStart = (component: string) => {
    updateTestResult(component, { 
      status: 'recording', 
      message: 'Recording in progress...' 
    })
  }

  const handleRecordingStop = (component: string) => {
    updateTestResult(component, { 
      status: 'uploading', 
      message: 'Processing recording...' 
    })
  }

  const handleUploadSuccess = (component: string, url: string, isCloudinary: boolean) => {
    updateTestResult(component, { 
      status: 'success', 
      message: `Upload successful via ${isCloudinary ? 'Cloudinary' : 'Local'}`,
      uploadUrl: url,
      uploadType: isCloudinary ? 'cloudinary' : 'local'
    })
  }

  const handleUploadError = (component: string, error: string) => {
    updateTestResult(component, { 
      status: 'error', 
      message: `Upload failed: ${error}` 
    })
  }

  const resetTest = (component: string) => {
    updateTestResult(component, { 
      status: 'idle', 
      message: 'Ready to test',
      uploadUrl: undefined,
      uploadType: undefined
    })
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'recording':
      case 'uploading':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusBadge = (result: TestResult) => {
    const variants = {
      idle: 'secondary',
      recording: 'default',
      uploading: 'default',
      success: 'default',
      error: 'destructive'
    } as const

    return (
      <Badge variant={variants[result.status]} className="ml-2">
        {result.status === 'success' && result.uploadType && (
          <span className="mr-1">
            {result.uploadType === 'cloudinary' ? '☁️' : '💾'}
          </span>
        )}
        {result.status.toUpperCase()}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎥 Recording Components Test Suite
          </h1>
          <p className="text-gray-600">
            Test all recording components to verify Cloudinary upload fixes and local fallback functionality
          </p>
        </div>

        {/* Test Results Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 Test Results Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testResults.map((result) => (
                <div key={result.component} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.component}</span>
                  </div>
                  <div className="flex items-center">
                    {getStatusBadge(result)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetTest(result.component)}
                      className="ml-2"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recording Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SimpleWebcamRecorder Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                📹 Simple Webcam Recorder
                {getStatusBadge(testResults[0])}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                <p><strong>Status:</strong> {testResults[0].message}</p>
                {testResults[0].uploadUrl && (
                  <p><strong>Upload URL:</strong> 
                    <a href={testResults[0].uploadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                      View Recording
                    </a>
                  </p>
                )}
              </div>
              
              <SimpleWebcamRecorder
                onRecordingStart={() => handleRecordingStart('SimpleWebcamRecorder')}
                onRecordingStop={() => handleRecordingStop('SimpleWebcamRecorder')}
                onUploadSuccess={(url, isCloudinary) => handleUploadSuccess('SimpleWebcamRecorder', url, isCloudinary)}
                onUploadError={(error) => handleUploadError('SimpleWebcamRecorder', error)}
                maxDuration={30}
                width={300}
                height={200}
              />
            </CardContent>
          </Card>

          {/* CircularWebcamRecorder Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                ⭕ Circular Webcam Recorder
                {getStatusBadge(testResults[1])}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                <p><strong>Status:</strong> {testResults[1].message}</p>
                {testResults[1].uploadUrl && (
                  <p><strong>Upload URL:</strong> 
                    <a href={testResults[1].uploadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                      View Recording
                    </a>
                  </p>
                )}
              </div>
              
              <div className="flex justify-center">
                <CircularWebcamRecorder
                  onRecordingStart={() => handleRecordingStart('CircularWebcamRecorder')}
                  onRecordingStop={() => handleRecordingStop('CircularWebcamRecorder')}
                  onUploadSuccess={(url, isCloudinary) => handleUploadSuccess('CircularWebcamRecorder', url, isCloudinary)}
                  onUploadError={(error) => handleUploadError('CircularWebcamRecorder', error)}
                  maxDuration={30}
                  width={200}
                  height={200}
                />
              </div>
            </CardContent>
          </Card>

          {/* ScreenRecorder Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                🖥️ Screen Recorder
                {getStatusBadge(testResults[2])}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                <p><strong>Status:</strong> {testResults[2].message}</p>
                {testResults[2].uploadUrl && (
                  <p><strong>Upload URL:</strong> 
                    <a href={testResults[2].uploadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                      View Recording
                    </a>
                  </p>
                )}
              </div>
              
              <ScreenRecorder
                onRecordingStart={() => handleRecordingStart('ScreenRecorder')}
                onRecordingStop={() => handleRecordingStop('ScreenRecorder')}
                onUploadSuccess={(url, isCloudinary) => handleUploadSuccess('ScreenRecorder', url, isCloudinary)}
                onUploadError={(error) => handleUploadError('ScreenRecorder', error)}
                maxDuration={30}
              />
            </CardContent>
          </Card>
        </div>

        {/* Test Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>🧪 Test Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">What to Test:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  <li>Start recording with each component</li>
                  <li>Record for a few seconds (max 30s)</li>
                  <li>Stop recording and observe upload process</li>
                  <li>Verify upload success/failure status</li>
                  <li>Check if Cloudinary or local upload was used</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Expected Behavior:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  <li>✅ MediaRecorder uses compatible formats (MP4/WebM)</li>
                  <li>☁️ Cloudinary upload attempts first</li>
                  <li>💾 Local upload fallback if Cloudinary fails</li>
                  <li>🔗 Working playback URLs for successful uploads</li>
                  <li>❌ Clear error messages for failures</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Format Compatibility Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🎯 MediaRecorder Format Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              <p className="mb-2">Our components now prioritize formats in this order:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li><code>video/mp4</code> - Best Cloudinary compatibility</li>
                <li><code>video/webm</code> - Generic WebM, widely supported</li>
                <li><code>video/webm;codecs=vp8</code> - VP8 codec fallback</li>
                <li>Browser default - Final fallback</li>
              </ol>
              <p className="mt-2 text-xs text-gray-500">
                Previous problematic format <code>video/webm;codecs=vp9,opus</code> has been removed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}