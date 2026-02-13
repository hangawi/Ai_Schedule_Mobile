import { useState, useEffect, useRef, useCallback } from 'react';

export const useVoiceRecognition = ({
  showToast,
  setIsVoiceEnabled,
  isChatOpen,
  setIsChatOpen,
  handleChatMessage, // for foreground voice recognition (챗봇과 직접 연동)
  isBackgroundMonitoring, // 백그라운드 모니터링 활성 여부
  processTranscript // 백그라운드 음성 텍스트 처리 함수
}) => {
  const backgroundRecognitionRef = useRef(null); // 백그라운드 인식 객체 ref

  // 포그라운드 음성 인식 시작 (버튼 클릭 시)
  const handleStartVoiceRecognition = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      const permResult = await navigator.permissions.query({ name: 'microphone' });
      if (permResult.state === 'denied') {
        showToast('마이크 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
        return;
      }
    } catch (e) {
      // permissions API 미지원 브라우저 → 그냥 진행
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.onstart = () => setIsVoiceEnabled(true);
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      if (!isChatOpen) setIsChatOpen(true); // 챗봇이 닫혀있으면 열기
      await handleChatMessage(transcript);
    };
    recognition.onerror = (e) => {
      setIsVoiceEnabled(false);
      if (e.error === 'not-allowed') {
        showToast('마이크 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
      }
    };
    recognition.onend = () => setIsVoiceEnabled(false); // 인식 종료 시 상태 초기화
    recognition.start();
  }, [showToast, setIsVoiceEnabled, isChatOpen, setIsChatOpen, handleChatMessage]);

  // 백그라운드 음성 모니터링 (useEffect)
  useEffect(() => {
    if (!isBackgroundMonitoring) {
      if (backgroundRecognitionRef.current) {
        backgroundRecognitionRef.current.stop();
        backgroundRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('이 브라우저에서는 백그라운드 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true; // 연속 인식
    recognition.interimResults = true; // 중간 결과 반환

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        // 외부에서 주입된 처리 함수 호출
        processTranscript(transcript, isFinal);
      }
    };

    recognition.onerror = (event) => {
      console.warn('백그라운드 음성 인식 오류:', event.error);
      if (event.error === 'not-allowed') {
        showToast('백그라운드 마이크 권한이 필요합니다.');
      }
    };

    recognition.onend = () => {
      // isBackgroundMonitoring이 여전히 true이면 인식 재시작
      if (isBackgroundMonitoring && backgroundRecognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('백그라운드 음성 인식 재시작 실패:', e);
        }
      }
    };

    // 훅 마운트 시 백그라운드 인식 시작
    try {
      recognition.start();
      backgroundRecognitionRef.current = recognition;
    } catch (e) {
      console.error('백그라운드 음성 인식 시작 실패:', e);
    }

    // 훅 언마운트 시 인식 중지
    return () => {
      if (backgroundRecognitionRef.current) {
        backgroundRecognitionRef.current.stop();
        backgroundRecognitionRef.current = null;
      }
    };
  }, [isBackgroundMonitoring, processTranscript, showToast]); // 의존성 배열에 필요한 값 포함

  return {
    handleStartVoiceRecognition,
  };
};
