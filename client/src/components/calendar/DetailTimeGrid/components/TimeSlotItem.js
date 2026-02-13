import React from 'react';
import { priorityConfig } from '../constants/priorityConfig'; // Adjust path if necessary
import { getSlotInfo, getExceptionForSlot, getPersonalTimeForSlot } from '../handlers/slotHelpers'; // Adjust path if necessary

const TimeSlotItem = ({
  time,
  selectedDate,
  schedule,
  mergedSchedule,
  exceptions,
  personalTimes,
  onSlotClick,
  showMerged // Add showMerged to props if needed for slotInfo logic
}) => {

  const slotInfo = getSlotInfo(time, selectedDate, schedule, mergedSchedule, showMerged);
  const exception = getExceptionForSlot(time, selectedDate, exceptions);
  const personalTime = getPersonalTimeForSlot(time, selectedDate, personalTimes);
  const isExceptionSlot = !!exception;
  const isPersonalTimeSlot = !!personalTime;

  let slotClass = 'bg-gray-50 hover:bg-gray-100';
  if (isExceptionSlot) {
    if (exception.title === '휴무일' || exception.isHoliday) {
      slotClass = 'bg-gray-300 text-gray-600';
    } else {
      const exceptionPriority = exception.priority !== undefined ? exception.priority : 3;
      slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
    }
  } else if (isPersonalTimeSlot) {
    slotClass = 'bg-red-300';
  } else if (slotInfo) {
    slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
    if (slotInfo.isBlocked) {
      slotClass = 'bg-gray-400 text-gray-600';
    }
  }

  let cursorClass = 'cursor-pointer';
  if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
    cursorClass = 'cursor-not-allowed';
  }

  return (
    <div
      key={time}
      className={`border-b border-gray-100 h-6 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
      onClick={() => {
        if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
          return;
        }
        onSlotClick(time);
      }}
      title={
        isExceptionSlot
          ? exception.title
          : isPersonalTimeSlot
          ? `개인시간: ${personalTime.title}`
          : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
      }
    >
      {isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday) && (
        <div className="flex items-center justify-center w-full h-full">
          <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
            휴무일
          </span>
        </div>
      )}
      {isExceptionSlot && exception.title !== '휴무일' && !exception.isHoliday && (
        <span className="text-white font-medium text-xs">
          {priorityConfig[exception.priority !== undefined ? exception.priority : 3]?.label || '일정'}
        </span>
      )}
      {!isExceptionSlot && slotInfo && (
        <span className="text-white font-medium text-xs">
          {priorityConfig[slotInfo.priority]?.label}
        </span>
      )}
      {isPersonalTimeSlot && !isExceptionSlot && (
        <span className="text-white font-medium text-xs">개인</span>
      )}
    </div>
  );
};

export default TimeSlotItem;
