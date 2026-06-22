import { useEffect, useRef, useState } from 'react';
import { Camera, Repeat2, X, Check } from 'lucide-react';
import {
  requestCameraPermission,
  stopCameraStream,
  checkCameraPermission,
  getUserFriendlyErrorMessage,
} from '../../utils/cameraPermissions';
import {
  compressImage,
  blobToFile,
  formatFileSize,
  isValidImageType,
} from '../../utils/imageCompression';

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError?: (error: Error) => void;
  maxFileSize?: number; // in bytes
  compressionQuality?: number; // 0-1
}

interface CameraState {
  status: 'idle' | 'requesting' | 'active' | 'captured' | 'error';
  error?: string;
  isFrontCamera: boolean;
  originalFile?: File;
  compressedFile?: File;
  capturedImageUrl?: string;
}

/**
 * CameraCapture Component
 * Allows users to capture photos of receipts on mobile and desktop
 * Features:
 * - Access device camera using HTML5 API
 * - Show camera preview
 * - Capture button with visual feedback
 * - Switch between front/back camera (mobile)
 * - Image preview after capture
 * - Retake option
 * - Image compression before upload
 * - Graceful permission handling
 */
export const CameraCapture = ({
  onCapture,
  onError,
  maxFileSize = 5242880, // 5MB default
  compressionQuality = 0.8,
}: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>({
    status: 'idle',
    isFrontCamera: false,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<
    'permission_denied' | 'device_not_found' | null
  >(null);

  // Initialize camera on mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const permissionStatus = await checkCameraPermission();

        if (permissionStatus === 'denied') {
          setFallbackReason('permission_denied');

          setCameraState((prev) => ({
            ...prev,
            status: 'error',
            error:
              'Camera permission has been denied. You can continue by entering your receipt manually.',
          }));

          return;
        }

        setCameraState((prev) => ({ ...prev, status: 'requesting' }));

        const mediaStream = await requestCameraPermission({
          video: {
            facingMode: cameraState.isFrontCamera ? 'user' : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });

        setStream(mediaStream);
        setCameraState((prev) => ({ ...prev, status: 'active', error: undefined }));

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        const err = error as Error;
        const errorMessage = getUserFriendlyErrorMessage(err);
        setCameraState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
        }));
        onError?.(err);
      }
    };

    initializeCamera();

    return () => {
      if (stream) {
        stopCameraStream(stream);
      }
    };
  }, [cameraState.isFrontCamera, onError]);

  const handleRetryCamera = async () => {
  try {
    setFallbackReason(null);

    await requestCameraPermission({
      video: {
        facingMode: cameraState.isFrontCamera ? 'user' : 'environment',
      },
      audio: false,
    });

    window.location.reload();
  } catch (error) {
    const err = error as any;

    setFallbackReason(
      err.permissionError?.type === 'not-found'
        ? 'device_not_found'
        : 'permission_denied'
    );
  }
};

  // Switch camera
  const handleSwitchCamera = async () => {
    if (stream) {
      stopCameraStream(stream);
      setStream(null);
    }

    setCameraState((prev) => ({
      ...prev,
      isFrontCamera: !prev.isFrontCamera,
      status: 'requesting',
      error: undefined,
    }));
  };

  // Capture image from camera
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Failed to capture image');
        }

        try {
          const originalFile = new File([blob], 'receipt.jpg', {
            type: 'image/jpeg',
          });

          // Create preview URL
          const previewUrl = URL.createObjectURL(blob);
          setCameraState((prev) => ({
            ...prev,
            status: 'captured',
            capturedImageUrl: previewUrl,
            originalFile,
          }));
        } catch (error) {
          const err = error as Error;
          setCameraState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Failed to capture image',
          }));
          onError?.(err);
        }
      }, 'image/jpeg');
    } catch (error) {
      const err = error as any;

      if (
        err.name === 'NotAllowedError' ||
        err.permissionError?.type === 'permission-denied'
      ) {
        setFallbackReason('permission_denied');
      }

      if (
        err.name === 'NotFoundError' ||
        err.permissionError?.type === 'not-found'
      ) {
        setFallbackReason('device_not_found');
      }

      setCameraState((prev) => ({
        ...prev,
        status: 'error',
        error: getUserFriendlyErrorMessage(err),
      }));

      onError?.(err);
    }
  };

  // Compress and submit image
  const handleConfirmCapture = async () => {
    if (!cameraState.originalFile) {
      return;
    }

    setIsCompressing(true);

    try {
      let fileToSubmit = cameraState.originalFile;
      let compressedBlob = await compressImage(cameraState.originalFile, {
        quality: compressionQuality,
      });

      // Check file size
      if (compressedBlob.size > maxFileSize) {
        // Try more aggressive compression
        compressedBlob = await compressImage(cameraState.originalFile, {
          quality: Math.max(0.5, compressionQuality - 0.2),
        });
      }

      fileToSubmit = blobToFile(compressedBlob, 'receipt.jpg');

      setCameraState((prev) => ({
        ...prev,
        compressedFile: fileToSubmit,
      }));

      onCapture(fileToSubmit);
    } catch (error) {
      const err = error as Error;
      setCameraState((prev) => ({
        ...prev,
        status: 'error',
        error: err.message || 'Failed to compress image',
      }));
      onError?.(err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    if (cameraState.capturedImageUrl) {
      URL.revokeObjectURL(cameraState.capturedImageUrl);
    }

    setCameraState((prev) => ({
      ...prev,
      status: 'active',
      capturedImageUrl: undefined,
      originalFile: undefined,
      compressedFile: undefined,
      error: undefined,
    }));
  };

  // Upload from file (fallback for desktop)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageType(file)) {
      setCameraState((prev) => ({
        ...prev,
        error: 'Please select a valid image file (JPEG, PNG, or WebP)',
      }));
      return;
    }

    try {
      setIsCompressing(true);
      const compressedBlob = await compressImage(file, {
        quality: compressionQuality,
      });

      if (compressedBlob.size > maxFileSize) {
        const moreCompressed = await compressImage(file, {
          quality: Math.max(0.5, compressionQuality - 0.2),
        });
        const compressedFile = blobToFile(moreCompressed, 'receipt.jpg');
        onCapture(compressedFile);
      } else {
        const compressedFile = blobToFile(compressedBlob, 'receipt.jpg');
        onCapture(compressedFile);
      }
    } catch (error) {
      const err = error as Error;
      setCameraState((prev) => ({
        ...prev,
        error: err.message || 'Failed to process image',
      }));
      onError?.(err);
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Camera Preview or Captured Image */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-lg">
        {cameraState.status === 'active' ? (
          <>
            {/* Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />

            {/* Camera Controls Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-4">
              {/* Top - Camera Switch Button */}
              {cameraState.status === 'active' && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSwitchCamera}
                    aria-label="Switch camera"
                    className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <Repeat2 size={24} />
                  </button>
                </div>
              )}

              {/* Bottom - Capture Controls */}
              <div className="flex justify-center gap-4">
                {/* File Upload Fallback */}
                <label className="px-6 py-3 bg-gray-700/50 text-white rounded-full cursor-pointer hover:bg-gray-700 transition-colors flex items-center gap-2 focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    aria-label="Upload image file"
                  />
                  Upload
                </label>

                {/* Capture Button */}
                <button
                  onClick={handleCapture}
                  aria-label="Take photo"
                  className="p-4 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-all active:scale-95 shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  <Camera size={28} />
                </button>
              </div>
            </div>
          </>
        ) : ) : cameraState.status === 'error' ? (
  <div className="w-full p-6 bg-gray-50 rounded-xl">

    {fallbackReason && (
      <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">

        <div className="flex gap-3">

          <AlertTriangle className="text-yellow-600 mt-1" />

          <div>

            <h3 className="font-semibold">
              Camera unavailable
            </h3>

            <p className="text-sm mt-1">
              {fallbackReason === 'permission_denied'
                ? 'Camera access was denied. You can continue by entering your receipt manually.'
                : 'No camera was detected on this device. Manual receipt entry is available.'}
            </p>

            <a
              href="https://support.google.com/chrome/answer/2693767"
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 underline text-sm"
            >
              How to enable camera
            </a>

          </div>

        </div>

      </div>
    )}

    {fallbackReason && (
      <>
        <button
          onClick={handleRetryCamera}
          className="mb-6 rounded-lg bg-purple-600 px-4 py-2 text-white"
        >
          Try camera again
        </button>

        <ManualEntryFallback
          onSubmit={(data) => {
            console.log(data);
          }}
          onCancel={() => setFallbackReason(null)}
        />
      </>
    )}

    {!fallbackReason && (
      <div className="text-center">

        <X
          size={48}
          className="mx-auto text-red-500 mb-3"
        />

        <h3 className="font-semibold mb-2">
          Camera Error
        </h3>

        <p>{cameraState.error}</p>

      </div>
    )}

  </div>
) : null}
      </div>

      {/* Hidden Canvas for Image Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* File Size Info */}
      {cameraState.compressedFile && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p>
            Image compressed: {formatFileSize(cameraState.compressedFile.size)}
          </p>
        </div>
      )}

      {/* Error Message */}
      {cameraState.error && cameraState.status !== 'error' && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <X size={16} className="mt-0.5 flex-shrink-0" />
          <div>{cameraState.error}</div>
        </div>
      )}
    </div>
  );
};
