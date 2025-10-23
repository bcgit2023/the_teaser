import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Define the directory for storing screen recordings
const SCREEN_RECORDINGS_DIR = path.join(process.cwd(), 'public', 'recordings', 'screen')

export async function POST(request: NextRequest) {
  console.log('Screen recording API endpoint called');
  try {
    // Ensure the screen recordings directory exists
    console.log('Checking if directory exists:', SCREEN_RECORDINGS_DIR);
    if (!existsSync(SCREEN_RECORDINGS_DIR)) {
      console.log('Creating directory:', SCREEN_RECORDINGS_DIR);
      await mkdir(SCREEN_RECORDINGS_DIR, { recursive: true })
    } else {
      console.log('Directory already exists');
    }

    // Get form data from the request
    console.log('Parsing form data from request');
    const formData = await request.formData()
    const file = formData.get('file') as File
    console.log('File received:', file ? `${file.name}, size: ${file.size} bytes` : 'No file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate a unique filename with timestamp
    console.log('Generating filename');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileId = uuidv4().substring(0, 8)
    const filename = `screen-recording-${timestamp}-${fileId}.mp4`
    const filePath = path.join(SCREEN_RECORDINGS_DIR, filename)
    console.log('Generated filepath:', filePath);
    
    // Convert the file to an ArrayBuffer
    console.log('Converting file to ArrayBuffer');
    const buffer = await file.arrayBuffer()
    console.log('Buffer size:', buffer.byteLength, 'bytes');
    
    // Write the file to disk
    console.log('Writing file to disk');
    await writeFile(filePath, new Uint8Array(buffer))
    console.log('File written successfully');
    
    // Return success response with the file path
    const publicPath = `/recordings/screen/${filename}`
    console.log('Returning success response with path:', publicPath);
    
    return NextResponse.json({
      success: true,
      filename,
      path: publicPath
    })
  } catch (error) {
    console.error('Error handling screen recording upload:', error)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: 'Failed to save screen recording', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
