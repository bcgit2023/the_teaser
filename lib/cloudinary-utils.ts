import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  access_mode: string;
  original_filename: string;
  duration?: number;
  bit_rate?: number;
  frame_rate?: number;
  video?: {
    pix_format: string;
    codec: string;
    level: number;
    profile: string;
  };
  audio?: {
    codec: string;
    bit_rate: string;
    frequency: number;
    channels: number;
    channel_layout: string;
  };
}

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'auto' | 'image' | 'video' | 'raw';
  format?: string;
  quality?: string | number;
  transformation?: any[];
  eager?: any[];
  tags?: string[];
}

/**
 * Upload a video file to Cloudinary with automatic optimization
 * @param fileBuffer - The video file buffer
 * @param options - Upload options
 * @returns Promise<CloudinaryUploadResult>
 */
export async function uploadVideoToCloudinary(
  fileBuffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const defaultOptions: CloudinaryUploadOptions = {
    resource_type: 'video',
    folder: 'recordings',
    quality: 'auto',
    format: 'mp4',
    eager: [
      {
        quality: 'auto:good',
        format: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
      },
      {
        quality: 'auto:low',
        format: 'webm',
        video_codec: 'vp9',
        audio_codec: 'vorbis',
      }
    ],
    tags: ['recording', 'futurelearner'],
    ...options,
  };

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      defaultOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else if (result) {
          resolve(result as CloudinaryUploadResult);
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Upload a screen recording to Cloudinary with specific optimizations
 * @param fileBuffer - The screen recording file buffer
 * @param options - Upload options
 * @returns Promise<CloudinaryUploadResult>
 */
export async function uploadScreenRecordingToCloudinary(
  fileBuffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const screenRecordingOptions: CloudinaryUploadOptions = {
    ...options,
    folder: 'recordings/screen',
    quality: 'auto:good',
    format: 'mp4',
    eager: [
      {
        quality: 'auto:good',
        format: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        bit_rate: '1000k',
      }
    ],
    tags: ['screen-recording', 'futurelearner'],
  };

  return uploadVideoToCloudinary(fileBuffer, screenRecordingOptions);
}

/**
 * Upload a webcam recording to Cloudinary with specific optimizations
 * @param fileBuffer - The webcam recording file buffer
 * @param options - Upload options
 * @returns Promise<CloudinaryUploadResult>
 */
export async function uploadWebcamRecordingToCloudinary(
  fileBuffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const webcamRecordingOptions: CloudinaryUploadOptions = {
    ...options,
    folder: 'recordings/webcam',
    quality: 'auto:good',
    format: 'mp4',
    eager: [
      {
        quality: 'auto:good',
        format: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        width: 640,
        height: 480,
        crop: 'limit',
      }
    ],
    tags: ['webcam-recording', 'futurelearner'],
  };

  return uploadVideoToCloudinary(fileBuffer, webcamRecordingOptions);
}

/**
 * Generate a signed upload URL for direct client-side uploads
 * @param options - Upload options
 * @returns Signed upload parameters
 */
export function generateSignedUploadParams(options: CloudinaryUploadOptions = {}) {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const params = {
    timestamp,
    folder: options.folder || 'recordings',
    resource_type: options.resource_type || 'video',
    quality: options.quality || 'auto',
    format: options.format || 'mp4',
    tags: options.tags?.join(',') || 'recording,futurelearner',
  };

  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);

  return {
    ...params,
    signature,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

/**
 * Delete a video from Cloudinary
 * @param publicId - The public ID of the video to delete
 * @returns Promise<any>
 */
export async function deleteVideoFromCloudinary(publicId: string): Promise<any> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
    return result;
  } catch (error) {
    console.error('Error deleting video from Cloudinary:', error);
    throw error;
  }
}

/**
 * Get video information from Cloudinary
 * @param publicId - The public ID of the video
 * @returns Promise<any>
 */
export async function getVideoInfo(publicId: string): Promise<any> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'video',
    });
    return result;
  } catch (error) {
    console.error('Error getting video info from Cloudinary:', error);
    throw error;
  }
}

/**
 * Generate optimized video URLs for different quality levels
 * @param publicId - The public ID of the video
 * @returns Object with different quality URLs
 */
export function generateOptimizedVideoUrls(publicId: string) {
  const baseUrl = cloudinary.url(publicId, {
    resource_type: 'video',
    secure: true,
  });

  return {
    original: baseUrl,
    high: cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      quality: 'auto:good',
      format: 'mp4',
    }),
    medium: cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      quality: 'auto:low',
      format: 'mp4',
    }),
    low: cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      quality: 'auto:eco',
      format: 'webm',
    }),
  };
}

export default cloudinary;