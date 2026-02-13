import React from 'react';
import { Menu, LogOut, User, Clipboard, ClipboardX, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // useNavigate는 MobileCalendarView에서 직접 사용하므로 prop으로 전달받기

const CalendarHeader = ({
  user,
  isSidebarOpen,
  setIsSidebarOpen,
  isClipboardMonitoring,
  setIsClipboardMonitoring,
  isBackgroundMonitoring,
  toggleBackgroundMonitoring,
  voiceStatus,
  handleLogout,
}) => {
  const navigate = useNavigate(); // MobileCalendarView에서 navigate를 직접 props로 받지 않고 내부에서 사용

  return (
    <>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header"><h2 className="sidebar-title">메뉴</h2><button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button></div>
        <div className="sidebar-menu">
          <button className="sidebar-item" onClick={() => navigate('/')}>🏠 홈으로</button>
          <button className="sidebar-item" onClick={() => navigate('/schedule')}>📅 내 일정</button>
          <button className="sidebar-item" onClick={() => navigate('/groups')}>👥 그룹</button>
          <button className="sidebar-item" onClick={() => navigate('/calendar')}>📆 달력</button>
          <button className="sidebar-item" onClick={() => navigate('/settings')}>⚙️ 설정</button>
        </div>
      </nav>
      <header className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
            <div className="mobile-logo-btn" onClick={() => navigate('/')}>
              <div className="mobile-logo-wrapper">
                <img src="/heyheylogo.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                <div className={`mobile-login-indicator ${user?.google?.refreshToken ? 'google' : 'local'}`}></div>
              </div>
              <h1 className="mobile-logo-text">MeetAgent</h1>
            </div>
          </div>
          <div className="mobile-header-right">
            <button className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`} onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)} title="클립보드">{isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}</button>
            <button className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`} onClick={toggleBackgroundMonitoring} title={isBackgroundMonitoring ? `대화감지 ON ${voiceStatus}` : "대화감지 OFF"}><Phone size={18} /></button>
            <button className="mobile-profile-btn" onClick={() => navigate('/settings')} title="설정">{user && user.firstName ? user.firstName : <User size={18} />}</button>
            <button className="mobile-logout-btn" onClick={handleLogout} title="로그아웃"><LogOut size={16} /></button>
          </div>
        </div>
      </header>
    </>
  );
};

export default CalendarHeader;
