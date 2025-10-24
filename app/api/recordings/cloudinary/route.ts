import { NextRequest, NextResponse } from 'next/server';
import { 
  uploadVideoToCloudinary, 
  uploadScreenRecordingToCloudinary, 
  uploadWebcamRecordingToCloudinary
} from '@/lib/cloudinary-utils';
import type { CloudinaryUploadResult } from '@/lib/cloudinary-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('🎥 Cloudinary upload request received');

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const recordingType = formData.get('type') as string || 'webcam';
    const userId = formData.get('userId') as string;
    const sessionId = formData.get('sessionId') as string;

    if (!file) {
      console.error('❌ No video file provided');
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    console.log(`📹 Processing ${recordingType} recording:`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId,
      sessionId
    });

    // Validate file size (50MB limit for Cloudinary free tier)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      console.error('❌ File too large:', file.size);
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 413 }
      );
    }

    // Validate file type
    const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only video files are allowed.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📤 Uploading to Cloudinary...');

    // Generate unique public ID
    const timestamp = Date.now();
    const publicId = `${recordingType}_${userId || 'anonymous'}_${timestamp}`;

    let uploadResult: CloudinaryUploadResult;

    // Upload based on recording type with specific optimizations
    switch (recordingType) {
      case 'screen':
        uploadResult = await uploadScreenRecordingToCloudinary(buffer, {
          public_id: publicId,
          tags: ['screen-recording', 'futurelearner', userId || 'anonymous'].filter(Boolean),
        });
        break;
      case 'webcam':
      case 'circular':
        uploadResult = await uploadWebcamRecordingToCloudinary(buffer, {
          public_id: publicId,
          tags: ['webcam-recording', 'futurelearner', userId || 'anonymous'].filter(Boolean),
        });
        break;
      default:
        uploadResult = await uploadVideoToCloudinary(buffer, {
          public_id: publicId,
          tags: ['recording', 'futurelearner', userId || 'anonymous'].filter(Boolean),
        });
    }

    console.log('✅ Upload successful:', {
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      duration: uploadResult.duration,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    });

    // Prepare response with optimized URLs
    const response = {
      success: true,
      data: {
        publicId: uploadResult.public_id,
        url: uploadResult.secure_url,
        originalUrl: uploadResult.url,
        format: uploadResult.format,
        duration: uploadResult.duration,
        bytes: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height,
        createdAt: uploadResult.created_at,
        resourceType: uploadResult.resource_type,
        // Provide multiple quality options
        urls: {
          original: uploadResult.secure_url,
          high: uploadResult.secure_url.replace('/upload/', '/upload/q_auto:good/'),
          medium: uploadResult.secure_url.replace('/upload/', '/upload/q_auto:low/'),
          low: uploadResult.secure_url.replace('/upload/', '/upload/q_auto:eco/')
        },
        // Video metadata
        video: uploadResult.video,
        audio: uploadResult.audio,
        tags: uploadResult.tags
      },
      message: `${recordingType} recording uploaded successfully to Cloudinary`
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    
    // Handle specific Cloudinary errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid image file')) {
        return NextResponse.json(
          { error: 'Invalid video file format' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('File size too large')) {
        return NextResponse.json(
          { error: 'File size exceeds Cloudinary limits' },
          { status: 413 }
        );
      }

      if (error.message.includes('Invalid API key')) {
        return NextResponse.json(
          { error: 'Cloudinary configuration error' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to upload video to Cloudinary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}