// Cloudinary TypeScript definitions for FutureLearner.ai

export interface CloudinaryUploadResponse {
  success: boolean;
  data?: CloudinaryVideoData;
  error?: string;
  details?: string;
  message?: string;
  // Additional properties for component compatibility
  blob?: Blob;
  url?: string;
  optimizedUrl?: string;
  cloudinaryData?: CloudinaryVideoData;
  localData?: any;
  duration?: number;
  type?: string;
}

export interface CloudinaryVideoData {
  publicId: string;
  url: string;
  originalUrl: string;
  format: string;
  duration?: number;
  bytes: number;
  width: number;
  height: number;
  createdAt: string;
  resourceType: string;
  urls: {
    original: string;
    high: string;
    medium: string;
    low: string;
  };
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
  tags: string[];
}

export interface CloudinaryUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface RecordingUploadOptions {
  type: 'webcam' | 'screen' | 'circular';
  userId?: string;
  sessionId?: string;
  onProgress?: (progress: CloudinaryUploadProgress) => void;
  onSuccess?: (response: CloudinaryUploadResponse) => void;
  onError?: (error: string) => void;
}

export interface RecordingState {
  isRecording: boolean;
  isUploading: boolean;
  uploadProgress: number;
  recordedBlob: Blob | null;
  uploadResponse: CloudinaryUploadResponse | null;
  error: string | null;
  duration: number;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;
}

// Component props interfaces
export interface WebcamRecorderProps {
  onRecordingComplete?: (response: CloudinaryUploadResponse) => void;
  onError?: (error: string) => void;
  userId?: string;
  sessionId?: string;
  maxDuration?: number;
  autoUpload?: boolean;
  uploadToCloudinary?: boolean;
}

export interface ScreenRecorderProps {
  onRecordingComplete?: (response: CloudinaryUploadResponse) => void;
  onError?: (error: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (url: string) => void;
  userId?: string;
  sessionId?: string;
  maxDuration?: number;
  autoUpload?: boolean;
  uploadToCloudinary?: boolean;
  className?: string;
}

export interface CircularWebcamRecorderProps {
  onRecordingComplete?: (response: CloudinaryUploadResponse) => void;
  onError?: (error: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (url: string) => void;
  userId?: string;
  sessionId?: string;
  maxDuration?: number;
  autoUpload?: boolean;
  uploadToCloudinary?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

// Utility function types
export type UploadFunction = (
  blob: Blob,
  options: RecordingUploadOptions
) => Promise<CloudinaryUploadResponse>;

export type ProgressCallback = (progress: CloudinaryUploadProgress) => void;

export type SuccessCallback = (response: CloudinaryUploadResponse) => void;

export type ErrorCallback = (error: string) => void;

// Recording hook return type
export interface UseRecordingReturn {
  isRecording: boolean;
  isUploading: boolean;
  uploadProgress: number;
  recordedBlob: Blob | null;
  uploadResponse: CloudinaryUploadResponse | null;
  error: string | null;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  uploadToCloudinary: (options?: Partial<RecordingUploadOptions>) => Promise<void>;
  clearRecording: () => void;
  clearError: () => void;
}

// API endpoint types
export interface CloudinaryApiRequest {
  video: File;
  type: 'webcam' | 'screen' | 'circular';
  userId?: string;
  sessionId?: string;
}

export interface CloudinaryApiResponse {
  success: boolean;
  data?: CloudinaryVideoData;
  error?: string;
  details?: string;
  message?: string;
}

// Error types
export class CloudinaryUploadError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: string
  ) {
    super(message);
    this.name = 'CloudinaryUploadError';
  }
}

export class RecordingError extends Error {
  constructor(
    message: string,
    public type: 'permission' | 'device' | 'upload' | 'unknown' = 'unknown'
  ) {
    super(message);
    this.name = 'RecordingError';
  }
}

// Constants
export const CLOUDINARY_CONSTANTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  // Updated to be more permissive with webm formats - Cloudinary accepts webm without specific codecs
  ALLOWED_FORMATS: ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm;codecs=vp8', 'video/webm;codecs=h264'],
  DEFAULT_QUALITY: 'auto:good',
  UPLOAD_TIMEOUT: 300000, // 5 minutes
} as const;

export const RECORDING_TYPES = {
  WEBCAM: 'webcam',
  SCREEN: 'screen',
  CIRCULAR: 'circular',
} as const;

export type RecordingType = typeof RECORDING_TYPES[keyof typeof RECORDING_TYPES];