import { useEffect, useRef, useState } from 'react';

type WebcamStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: WebcamStatus;
  error: string | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
  requestAccess: () => Promise<void>;
  stopAllTracks: () => void;
  stream: MediaStream | null;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const requestAccess = async () => {
    setStatus('requesting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus('active');
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setStatus('denied');
        setError('Camera and microphone access was denied. Please allow access and try again.');
      } else if (e.name === 'NotFoundError') {
        setStatus('error');
        setError('No camera or microphone found on this device.');
      } else {
        setStatus('error');
        setError(`Could not access media devices: ${e.message}`);
      }
    }
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    const next = !isCameraOn;
    videoTracks.forEach(t => { t.enabled = next; });
    setIsCameraOn(next);
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    const next = !isMicOn;
    audioTracks.forEach(t => { t.enabled = next; });
    setIsMicOn(next);
  };

  // Attach stream to video element once both are ready
  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  const stopAllTracks = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // Cleanup on unmount — stops camera/mic indicator light on other pages
  useEffect(() => {
    return () => { stopAllTracks(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    status,
    error,
    isCameraOn,
    isMicOn,
    toggleCamera,
    toggleMic,
    requestAccess,
    stopAllTracks,
    get stream() { return streamRef.current; },
  };
}
