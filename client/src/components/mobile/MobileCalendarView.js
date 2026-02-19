import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Calendar, Settings, FileText } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { useBackgroundMonitoring } from '../../hooks/useBackgroundMonitoring';
import BottomNavigation from './BottomNavigation';

import MobileScheduleEdit from './MobileScheduleEdit';
import ChatBox from '../chat/ChatBox';
import EventDetailModal, { MapModal } from './EventDetailModal';
import AutoDetectedScheduleModal from '../modals/AutoDetectedScheduleModal';
import CustomAlertModal from '../modals/CustomAlertModal';

// 분할된 모듈
import { renderEventContent } from './calendarView/utils/eventUtils';
import useCalendarData from './calendarView/hooks/useCalendarData';
import { createCalendarHandlers } from './calendarView/hooks/useCalendarHandlers';
import useTouchGesture from './calendarView/hooks/useTouchGesture';
import useCameraOCR from './calendarView/hooks/useCameraOCR';
import { useVoiceRecognition } from './calendarView/hooks/useVoiceRecognition';
import BottomSection from './calendarView/components/BottomSection';
import CalendarContent from './calendarView/components/CalendarContent';
import EventEditPanel from './calendarView/components/EventEditPanel';
import CalendarHeader from './calendarView/components/CalendarHeader';

import './MobileCalendarView.css';

const MobileCalendarView = ({ user, isClipboardMonitoring, setIsClipboardMonitoring, setIsVoiceEnabled }) => {
   const navigate = useNavigate();
   const [searchParams, setSearchParams] = useSearchParams();
   const calendarRef = useRef(null);

   const [showScheduleEdit, setShowScheduleEdit] = useState(false);
   const [isChatOpen, setIsChatOpen] = useState(searchParams.get('chat') === 'open');
   const [isEditing, setIsEditing] = useState(false);
   const [initialState, setInitialState] = useState(null);
   const [currentTitle, setCurrentTitle] = useState('');
   const [calendarView, setCalendarView] = useState('dayGridMonth');
   const [selectedDate, setSelectedDate] = useState(new Date());

   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showMapModal, setShowMapModal] = useState(false);
   const [selectedLocation, setSelectedLocation] = useState(null);

   const [toastMessage, setToastMessage] = useState(null);
   const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
   const showToast = useCallback((msg) => { setToastMessage(msg); }, []);

   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const backgroundRecognitionRef = useRef(null);

   // --- 데이터 훅 ---
   const {
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      isLoading,
      globalEvents,
      visibleRangeRef,
      fetchSchedule,
      fetchGlobalEvents,
      convertScheduleToEvents,
      chatEnhanced,
      isLoggedIn,
      eventActions,
      setEventAddedKey,
   } = useCalendarData(user, calendarRef);

   // --- 터치 제스처 훅 ---
   const { translateY, isSwiping, handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchGesture(calendarRef);

   // --- 카메라/OCR 훅 ---
   const { isOcrProcessing, cameraInputRef, handleStartCamera, handleCameraCapture } = useCameraOCR(fetchSchedule, fetchGlobalEvents, showToast);

   // --- 이벤트 핸들러 ---
   const {
      handleStartEdit, handleCancel, handleSave, handleClearAll,
      handleDateClick, handleEventClick, handleDeleteScheduleEvent,
      handleSplitItemClick, handleOpenMap, handleCloseMapModal,
      handleViewChange, handleLogout, handleChatMessage,
   } = createCalendarHandlers({
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      initialState, setInitialState,
      isEditing, setIsEditing,
      calendarRef, selectedDate, setSelectedDate,
      visibleRangeRef,
      fetchSchedule, fetchGlobalEvents,
      showToast, setConfirmModal, setSelectedEvent,
      navigate,
      convertScheduleToEvents,
      user,
      isChatOpen, setIsChatOpen,
      chatEnhanced, globalEvents,
      setIsVoiceEnabled,
      setShowMapModal, setSelectedLocation,
      setCalendarView, setCurrentTitle,
   });

   // --- 백그라운드 대화 감지 훅 ---
   const {
      isBackgroundMonitoring,
      toggleBackgroundMonitoring,
      processTranscript,
      detectedSchedules,
      confirmSchedule,
      dismissSchedule,
      voiceStatus,
      isAnalyzing: isBackgroundAnalyzing,
      backgroundTranscript
   } = useBackgroundMonitoring(eventActions, setEventAddedKey);

   // --- 음성 인식 훅 ---
   const { handleStartVoiceRecognition } = useVoiceRecognition({
      showToast,
      setIsVoiceEnabled,
      isChatOpen,
      setIsChatOpen,
      handleChatMessage,
      isBackgroundMonitoring,
      processTranscript,
   });

   // --- 쿼리 파라미터 처리 ---
   useEffect(() => {
      if (searchParams.get('chat') === 'open') {
         searchParams.delete('chat');
         setSearchParams(searchParams, { replace: true });
      }
   }, []);

   useEffect(() => {
      if (searchParams.get('voice') === 'start') {
         searchParams.delete('voice');
         setSearchParams(searchParams, { replace: true });
         setTimeout(() => handleStartVoiceRecognition(), 500);
      }
   }, []);

   useEffect(() => {
      if (searchParams.get('camera') === 'open') {
         searchParams.delete('camera');
         setSearchParams(searchParams, { replace: true });
         setTimeout(() => handleStartCamera(), 500);
      }
   }, []);



   // --- 렌더링 ---
   if (showScheduleEdit) return <MobileScheduleEdit onBack={() => setShowScheduleEdit(false)} />;

   return (
      <div className={`mobile-calendar-view view-${calendarView} ${calendarView === 'timeGridDay' ? 'split-mode' : ''}`}>
        <CalendarHeader
          user={user}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isClipboardMonitoring={isClipboardMonitoring}
          setIsClipboardMonitoring={setIsClipboardMonitoring}
          isBackgroundMonitoring={isBackgroundMonitoring}
          toggleBackgroundMonitoring={toggleBackgroundMonitoring}
          voiceStatus={voiceStatus}
          handleLogout={handleLogout}
        />
         <div className="schedule-content">
            {isLoading ? (
               <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                  <img src="/waiting.webp" alt="로딩 중" style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px' }} />
                  <p style={{ color: '#666', fontSize: '14px' }}>로딩 중...</p>
               </div>
            ) :
               <>
                  <EventEditPanel
                     currentTitle={currentTitle}
                     isEditing={isEditing}
                     handleStartEdit={handleStartEdit}
                     handleCancel={handleCancel}
                     handleClearAll={handleClearAll}
                     handleSave={handleSave}
                  />
                  {googleCalendarEvents.length > 0 && (
                     <div className="calendar-legend">
                        <span className="legend-item">
                           <span className="legend-dot" style={{ backgroundColor: '#ef4444' }}></span>
                           앱 일정
                        </span>
                        <span className="legend-item">
                           <span className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></span>
                           구글 캘린더
                        </span>
                     </div>
                  )}
                  <CalendarContent
                    calendarRef={calendarRef}
                    handleTouchStart={handleTouchStart}
                    handleTouchMove={handleTouchMove}
                    handleTouchEnd={handleTouchEnd}
                    translateY={translateY}
                    isSwiping={isSwiping}
                    isEditing={isEditing}
                    events={events}
                    handleDateClick={handleDateClick}
                    handleEventClick={handleEventClick}
                    renderEventContent={renderEventContent}
                    handleViewChange={handleViewChange}
                  />
                  <BottomSection
                     isEditing={isEditing}
                     calendarView={calendarView}
                     selectedDate={selectedDate}
                     defaultSchedule={defaultSchedule}
                     personalTimes={personalTimes}
                     events={events}
                     onSplitItemClick={handleSplitItemClick}
                  />
               </>
            }
         </div>
         {/* 숨겨진 카메라 입력 */}
         <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
         />

         {/* OCR 처리 중 로딩 */}
         {isOcrProcessing && (
            <div style={{
               position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
               backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
               alignItems: 'center', justifyContent: 'center', zIndex: 9999
            }}>
               <div style={{
                  background: 'white', borderRadius: '12px', padding: '24px',
                  textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
               }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>📸</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>시간표 분석 중...</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>AI가 시간표를 인식하고 있습니다</div>
               </div>
            </div>
         )}

         {/* 하단 네비게이션 바 - 항상 표시 */}
         <BottomNavigation
            onRefresh={fetchSchedule}
            onChat={() => setIsChatOpen(!isChatOpen)}
            onMic={handleStartVoiceRecognition}
            onCamera={handleStartCamera}
         />

         {/* 챗봇 - isChatOpen이 true일 때만 표시 */}
         {isChatOpen && (
            <ChatBox
               onSendMessage={handleChatMessage}
               currentTab="profile"
               onEventUpdate={fetchSchedule}
               forceOpen={true}
            />
         )}
         {selectedEvent && <EventDetailModal event={selectedEvent} user={user} onClose={() => setSelectedEvent(null)} onOpenMap={handleOpenMap} onDelete={handleDeleteScheduleEvent} previousLocation={null} isEditing={isEditing} />}
         {showMapModal && selectedLocation && <MapModal address={selectedLocation.address} lat={selectedLocation.lat} lng={selectedLocation.lng} onClose={handleCloseMapModal} />}
         {detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               schedules={detectedSchedules}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               isAnalyzing={isBackgroundAnalyzing}
            />
         )}
         {toastMessage && (
            <div
               style={{
                  position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 100000, backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff',
                  padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                  maxWidth: '85%', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  animation: 'fadeInUp 0.3s ease-out'
               }}
               onClick={() => setToastMessage(null)}
               onAnimationEnd={() => setTimeout(() => setToastMessage(null), 2500)}
            >
               {toastMessage}
            </div>
         )}
         <CustomAlertModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmModal.onConfirm}
            title={confirmModal.title}
            message={confirmModal.message}
            type="warning"
            showCancel={true}
            confirmText="확인"
            cancelText="취소"
         />
      </div>
   );
};

export default MobileCalendarView;
