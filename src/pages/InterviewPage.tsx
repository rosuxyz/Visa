import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebcam } from '../hooks/useWebcam';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useInterviewFlow } from '../hooks/useInterviewFlow';
import { useInterviewStore } from '../store/interviewStore';
import { VideoFeed } from '../components/VideoFeed';
import { CaptionBar } from '../components/CaptionBar';
import { TopBar } from '../components/TopBar';
import { QuestionPanel } from '../components/QuestionPanel';

export function InterviewPage() {
  const navigate = useNavigate();
  const { selectedType } = useInterviewStore();

  const webcam = useWebcam();
  const speech = useSpeechRecognition();
  const flow = useInterviewFlow();

  const transcriptRef = useRef('');
  transcriptRef.current = speech.fullTranscript;

  // Restart mic after TTS finishes — with a delay so speaker audio fully stops
  const interviewStartedRef = useRef(false);
  useEffect(() => {
    if (!interviewStartedRef.current) return;
    if (flow.isSpeaking) {
      // Belt-and-suspenders: stop mic if somehow still running
      speech.stop();
      speech.resetTranscript();
    } else {
      // Wait 400ms after TTS ends before opening mic — prevents tail-echo capture
      const id = setTimeout(() => {
        if (interviewStartedRef.current) speech.start();
      }, 400);
      return () => clearTimeout(id);
    }
  }, [flow.isSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: must have custom questions before interviewing
  const { customQuestions } = useInterviewStore();
  useEffect(() => {
    // Small delay lets Zustand rehydrate from localStorage before we check
    const id = setTimeout(() => {
      if (customQuestions.length === 0) navigate('/prepare', { replace: true });
    }, 100);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start interview once camera is active
  const startedRef = useRef(false);
  useEffect(() => {
    if (webcam.status === 'active' && !startedRef.current) {
      startedRef.current = true;
      interviewStartedRef.current = true;
      flow.startInterview(selectedType);
      // Mic will auto-start once isSpeaking goes false after first question TTS
    }
  }, [webcam.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    webcam.requestAccess();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    const transcript = transcriptRef.current;
    // Stop mic immediately — before TTS starts for the next question
    speech.stop();
    speech.resetTranscript();
    flow.nextQuestion(transcript);
  };

  const handleEnd = () => {
    const transcript = transcriptRef.current;
    speech.stop();
    webcam.stopAllTracks();
    flow.endInterview(transcript);
  };

  useEffect(() => {
    if (flow.isEnded) {
      navigate('/summary');
    }
  }, [flow.isEnded]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLastQuestion = flow.currentIndex === flow.questions.length - 1;

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      <TopBar
        elapsed={flow.elapsed}
        isMicOn={webcam.isMicOn}
        isCameraOn={webcam.isCameraOn}
        onToggleMic={webcam.toggleMic}
        onToggleCamera={webcam.toggleCamera}
        onEndInterview={handleEnd}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: video + captions */}
        <div className="flex-[65] flex flex-col gap-0 p-4 min-w-0">
          <div className="w-full" style={{ aspectRatio: '16/9' }}>
            <VideoFeed
              videoRef={webcam.videoRef}
              status={webcam.status}
              error={webcam.error}
              isCameraOn={webcam.isCameraOn}
              isSpeaking={flow.isSpeaking}
              requestAccess={webcam.requestAccess}
            />
          </div>
          <div className="flex-1 mt-2 min-h-0">
            <CaptionBar
              finalText={speech.finalText}
              interimText={speech.interimText}
              isListening={speech.isListening}
              isSpeaking={flow.isSpeaking}
            />
          </div>

          {!speech.isSupported && (
            <div className="mt-3 px-4 py-2.5 bg-yellow-900/40 border border-yellow-700/40 rounded-xl text-yellow-400 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Live captions require Chrome or Edge.
            </div>
          )}
        </div>

        {/* Right: question panel */}
        <div className="flex-[35] flex flex-col p-4 pl-0 border-l border-gray-800 min-w-0 overflow-y-auto dark-scroll">
          {flow.isStarted && flow.currentQuestion ? (
            <>
              <QuestionPanel
                question={flow.currentQuestion}
                currentIndex={flow.currentIndex}
                total={flow.questions.length}
                questions={flow.questions}
                onRepeat={() => { speech.stop(); speech.resetTranscript(); flow.speakQuestion(flow.currentQuestion!.question); }}
                onNext={handleNext}
                isLastQuestion={isLastQuestion}
                onEnd={handleEnd}
                isSpeaking={flow.isSpeaking}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm">Setting up interview…</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
