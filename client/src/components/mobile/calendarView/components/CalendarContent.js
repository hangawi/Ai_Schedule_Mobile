import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const CalendarContent = ({
  calendarRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  translateY,
  isSwiping,
  isEditing,
  events,
  handleDateClick,
  handleEventClick,
  renderEventContent,
  handleViewChange,
}) => {
  return (
    <div
      className="calendar-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pull-indicator top">{translateY > 0 ? '이전 달' : ''}</div>
      <div className="pull-indicator bottom">{translateY < 0 ? '다음 달' : ''}</div>
      <div className="calendar-wrapper" style={{ transform: `translateY(${translateY}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease-out', padding: '16px' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          timeZone="local"
          headerToolbar={isEditing ? { left: 'backToMonth prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' } : false}
          customButtons={{ backToMonth: { text: '◀ 월', click: () => calendarRef.current?.getApi().changeView('dayGridMonth') } }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          viewDidMount={handleViewChange}
          datesSet={handleViewChange}
          height="auto"
          locale="ko"
          buttonText={{ month: '월', week: '주', day: '일' }}
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          nowIndicator={true}
          dayMaxEvents={2}
          moreLinkText={(num) => `+${num}개`}
          eventDisplay="block"
          displayEventTime={false}
          navLinks={true}
          navLinkDayClick={(date) => calendarRef.current?.getApi().changeView('timeGridDay', date)}
        />
      </div>
    </div>
  );
};

export default CalendarContent;
