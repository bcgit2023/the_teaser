import { useState, useCallback } from 'react';
import { 
  CloudinaryUploadResponse, 
  CloudinaryUploadProgress, 
  RecordingUploadOptions,
  CloudinaryUploadError,
  CLOUDINARY_CONSTANTS 
} from '@/types/cloudinary';

export function useCloudinaryUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResponse, setUploadResponse] = useState<CloudinaryUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadToCloudinary = useCallback(async (
    blob: Blob,
    options: RecordingUploadOptions
  ): Promise<CloudinaryUploadResponse> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResponse(null);

    try {
      // Validate file size
      if (blob.size > CLOUDINARY_CONSTANTS.MAX_FILE_SIZE) {
        throw new CloudinaryUploadError(
          `File size (${Math.round(blob.size / 1024 / 1024)}MB) exceeds the maximum limit of 50MB`,
          413
        );
      }

      // Validate file type
      if (!CLOUDINARY_CONSTANTS.ALLOWED_FORMATS.includes(blob.type as any)) {
        throw new CloudinaryUploadError(
          `File type ${blob.type} is not supported. Allowed formats: ${CLOUDINARY_CONSTANTS.ALLOWED_FORMATS.join(', ')}`,
          400
        );
      }

      // Create form data
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `${options.type}-recording-${timestamp}.webm`;
      
      formData.append('video', blob, filename);
      formData.append('type', options.type);
      
      if (options.userId) {
        formData.append('userId', options.userId);
      }
      
      if (options.sessionId) {
        formData.append('sessionId', options.sessionId);
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
          
          const progressData: CloudinaryUploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: progress
          };
          
          options.onProgress?.(progressData);
        }
      });

      // Create promise for XMLHttpRequest
      const uploadPromise = new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (parseError) {
              reject(new CloudinaryUploadError('Invalid response format', xhr.status));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new CloudinaryUploadError(
                errorResponse.error || 'Upload failed',
                xhr.status,
                errorResponse.details
              ));
            } catch {
              reject(new CloudinaryUploadError(
                `Upload failed with status ${xhr.status}`,
                xhr.status
              ));
            }
          }
        };

        xhr.onerror = () => {
          reject(new CloudinaryUploadError('Network error during upload'));
        };

        xhr.ontimeout = () => {
          reject(new CloudinaryUploadError('Upload timeout'));
        };
      });

      // Configure and send request
      xhr.open('POST', '/api/recordings/cloudinary');
      xhr.timeout = CLOUDINARY_CONSTANTS.UPLOAD_TIMEOUT;
      xhr.send(formData);

      // Wait for upload to complete
      const response = await uploadPromise;
      
      setUploadResponse(response);
      setUploadProgress(100);
      
      // Call success callback
      options.onSuccess?.(response);
      
      return response;

    } catch (error) {
      const errorMessage = error instanceof CloudinaryUploadError 
        ? error.message 
        : error instanceof Error 
        ? error.message 
        : 'Unknown upload error';
      
      setError(errorMessage);
      options.onError?.(errorMessage);
      
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearUpload = useCallback(() => {
    setUploadResponse(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    uploadResponse,
    error,
    uploadToCloudinary,
    clearUpload,
    clearError
  };
}