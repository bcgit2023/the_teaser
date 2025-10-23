import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Define the directory for storing recordings
const RECORDINGS_DIR = path.join(process.cwd(), 'public', 'recordings')

export async function POST(request: NextRequest) {
  try {
    // Ensure the recordings directory exists
    if (!existsSync(RECORDINGS_DIR)) {
      await mkdir(RECORDINGS_DIR, { recursive: true })
    }

    // Get form data from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate a unique filename with timestamp, preserving original extension
    const originalName = file.name || 'recording.webm'
    const extension = path.extname(originalName) || '.webm'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileId = uuidv4().substring(0, 8)
    const filename = `recording-${timestamp}-${fileId}${extension}`
    const filePath = path.join(RECORDINGS_DIR, filename)
    
    // Convert the file to an ArrayBuffer
    const buffer = await file.arrayBuffer()
    
    // Write the file to disk
    await writeFile(filePath, new Uint8Array(buffer))
    
    // Return success response with the file path
    const publicPath = `/recordings/${filename}`
    
    return NextResponse.json({
      success: true,
      filename,
      path: publicPath
    })
  } catch (error) {
    console.error('Error handling recording upload:', error)
    return NextResponse.json(
      { error: 'Failed to save recording' },
      { status: 500 }
    )
  }
}
