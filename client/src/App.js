/**
 * App.js - 모바일 전용 React 애플리케이션 최상위 컴포넌트
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import AuthScreen from './components/auth/AuthScreen';
import MobileDashboard from './components/mobile/MobileDashboard';
import MobileCalendarView from './components/mobile/MobileCalendarView';
import MobileScheduleView from './components/mobile/MobileScheduleView';
import MobileGroupsView from './components/mobile/MobileGroupsView';
import MobileSettings from './components/mobile/MobileSettings';
import { ToastProvider } from './contexts/ToastContext';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { auth } from './config/firebaseConfig';

const libraries = ['places'];

function App() {
   const { isLoggedIn, user, handleLoginSuccess } = useAuth();
   const [, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(() => {
      const saved = localStorage.getItem('voiceRecognitionEnabled');
      return saved !== null ? JSON.parse(saved) : true;
   });
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [eventActions] = useState(null);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey, eventActions);

   // 파비콘에 빨간 뱃지 그리기
   const updateFavicon = useCallback((count) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
         ctx.drawImage(img, 0, 0, 64, 64);
         if (count > 0) {
            const text = count > 99 ? '99+' : String(count);
            const fontSize = text.length > 2 ? 20 : 26;
            ctx.font = `bold ${fontSize}px sans-serif`;
            const textWidth = ctx.measureText(text).width;
            const badgeSize = Math.max(28, textWidth + 12);
            const x = 64 - badgeSize / 2;
            const y = badgeSize / 2;
            ctx.beginPath();
            ctx.arc(x, y, badgeSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y + 1);
         }
         let link = document.querySelector("link[rel~='icon']");
         if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
         link.href = canvas.toDataURL('image/png');
      };
      img.src = '/heyheylogo.png';
   }, []);

   // PWA 앱 아이콘 뱃지
   useEffect(() => {
      if (!isLoggedIn) return;

      const updateBadge = async () => {
         try {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            const token = await currentUser.getIdToken();
            const res = await fetch(
               `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/coordination/my-rooms`,
               { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const rooms = [...(data.owned || []), ...(data.joined || [])];
            const total = rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);

            document.title = total > 0 ? `(${total}) AI Schedule` : 'AI Schedule';
            updateFavicon(total);

            if ('setAppBadge' in navigator) {
               if (total > 0) {
                  navigator.setAppBadge(total);
               } else {
                  navigator.clearAppBadge();
               }
            }
         } catch (e) {
            // 뱃지 업데이트 실패 무시
         }
      };

      updateBadge();
      const interval = setInterval(updateBadge, 30000);
      return () => clearInterval(interval);
   }, [isLoggedIn]);

   const [sharedText, setSharedText] = useState(null);
   const [copiedText, setCopiedText] = useState(null);
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [dismissedCopiedTexts, setDismissedCopiedTexts] = useState(() => {
      try {
         const saved = localStorage.getItem('dismissedCopiedTexts');
         const recentTexts = (saved ? JSON.parse(saved) : []).slice(-100);
         return new Set(recentTexts);
      } catch (error) {
         return new Set();
      }
   });

   useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const text = queryParams.get('text');
      if (text) {
         setSharedText(text);
         window.history.replaceState({}, document.title, window.location.pathname);
      }
   }, []);

   const analyzeClipboard = useCallback(async (text) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return false;

         const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/call-analysis/analyze-clipboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify({ text }),
         });

         if (response.ok) {
            const data = await response.json();
            return data.success && data.data.isScheduleRelated && data.data.confidence >= 0.5;
         }
         return false;
      } catch (error) {
         const schedulePatterns = [
            /\d{1,2}:\d{2}|\d{1,2}시\s*\d{0,2}분?|(오전|오후|새벽|저녁|아침)\s*\d{1,2}시?/,
            /(오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|다음주|이번주|다음달|이번달)\s*(에|부터|까지)?/i,
            /(만나|만날|만나자|만나요|보자|보요|가자|가요|하자|하요|먹자|먹어요)/,
            /(약속|미팅|회의|모임|만남|식사|점심|저녁|영화|공연|수업|강의|프로젝트)/,
            /(카페|식당|영화관|극장|백화점|공원|학교|회사|사무실|집|기숙사)에?서?/
         ];

         const matchCount = schedulePatterns.filter(pattern => pattern.test(text)).length;
         const hasMinimumLength = text.length >= 10;
         return matchCount >= 2 && hasMinimumLength;
      }
   }, []);

   const addToDismissedTexts = useCallback((text) => {
      setDismissedCopiedTexts(prev => {
         const newSet = new Set(prev).add(text);
         localStorage.setItem('dismissedCopiedTexts', JSON.stringify(Array.from(newSet)));
         return newSet;
      });
   }, []);

   const readClipboard = useCallback(async () => {
      if (!isClipboardMonitoring) return;
      if (!navigator.clipboard?.readText || document.visibilityState !== 'visible') return;

      try {
         const text = await navigator.clipboard.readText();
         const trimmedText = text.trim();

         if (trimmedText.length >= 5 && trimmedText.length <= 50 && !dismissedCopiedTexts.has(text)) {
            const hasDateOrDay = /(\d{1,2}월|\d{1,2}일|\d{4}년|월요일|화요일|수요일|목요일|금요일|토요일|일요일|오늘|내일|모레|다음주|이번주)/.test(trimmedText);

            if (hasDateOrDay) {
               analyzeClipboard(text).then(isSchedule => {
                 if (isSchedule) {
                    setCopiedText(text);
                    setIsAnalyzing(true);
                    setTimeout(() => setIsAnalyzing(false), 500);
                 } else {
                    addToDismissedTexts(text);
                 }
               });
            } else {
               addToDismissedTexts(text);
            }
         } else if (trimmedText.length > 50) {
            addToDismissedTexts(text);
         }
      } catch (err) {
         // Clipboard read failed
      }
   }, [isClipboardMonitoring, dismissedCopiedTexts, analyzeClipboard, addToDismissedTexts]);

   useEffect(() => {
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible') {
            setTimeout(readClipboard, 100);
         }
      };
      window.addEventListener('focus', readClipboard);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
         window.removeEventListener('focus', readClipboard);
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, [readClipboard]);

   const handleToggleVoiceRecognition = useCallback(() => {
      setIsVoiceRecognitionEnabled(prev => {
         const newValue = !prev;
         localStorage.setItem('voiceRecognitionEnabled', JSON.stringify(newValue));
         return newValue;
      });
   }, []);

   const handleConfirmSharedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      setSharedText(null);
   };

   const handleConfirmCopiedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      addToDismissedTexts(text);
      setCopiedText(null);
   };

   const handleCloseCopiedText = (text) => {
      addToDismissedTexts(text);
      setCopiedText(null);
      setIsAnalyzing(false);
   };

   const GOOGLE_API_KEY = process.env.REACT_APP_MY_GOOGLE_KEY;

   return (
      <LoadScript
         googleMapsApiKey={GOOGLE_API_KEY}
         libraries={libraries}
         language="ko"
      >
         <ToastProvider>
         <Router>
            <Routes>
               <Route path="/auth" element={
                  (() => {
                     const params = new URLSearchParams(window.location.search);
                     const hasCalendarCallback = params.get('calendarConnected') || params.get('calendarError');
                     if (isLoggedIn && !hasCalendarCallback) return <Navigate to="/" />;
                     return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
                  })()
               } />
               <Route path="/" element={
                  isLoggedIn ? <MobileDashboard user={user} /> : <Navigate to="/auth" />
               } />
               <Route path="/schedule" element={
                  isLoggedIn ? <MobileScheduleView user={user} isClipboardMonitoring={isClipboardMonitoring} setIsClipboardMonitoring={setIsClipboardMonitoring} isVoiceEnabled={isVoiceRecognitionEnabled} setIsVoiceEnabled={handleToggleVoiceRecognition} /> : <Navigate to="/auth" />
               } />
               <Route path="/groups" element={
                  isLoggedIn ? <MobileGroupsView user={user} isClipboardMonitoring={isClipboardMonitoring} setIsClipboardMonitoring={setIsClipboardMonitoring} isVoiceEnabled={isVoiceRecognitionEnabled} setIsVoiceEnabled={handleToggleVoiceRecognition} /> : <Navigate to="/auth" />
               } />
               <Route path="/calendar" element={
                  isLoggedIn ? <MobileCalendarView user={user} isClipboardMonitoring={isClipboardMonitoring} setIsClipboardMonitoring={setIsClipboardMonitoring} isVoiceEnabled={isVoiceRecognitionEnabled} setIsVoiceEnabled={handleToggleVoiceRecognition} /> : <Navigate to="/auth" />
               } />
               <Route path="/settings" element={
                  isLoggedIn ? <MobileSettings user={user} /> : <Navigate to="/auth" />
               } />
            </Routes>
            {isLoggedIn && sharedText && (
               <SharedTextModal text={sharedText} onClose={() => setSharedText(null)} onConfirm={handleConfirmSharedText} />
            )}
            {isLoggedIn && copiedText && !sharedText && (
               <CopiedTextModal text={copiedText} isAnalyzing={isAnalyzing} onClose={() => handleCloseCopiedText(copiedText)} onConfirm={handleConfirmCopiedText} />
            )}
         </Router>
         </ToastProvider>
      </LoadScript>
   );
}

export default App;
