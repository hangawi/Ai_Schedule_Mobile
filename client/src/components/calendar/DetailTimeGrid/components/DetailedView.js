/**
 * DetailedView.js - 분할된(상세) 시간표 뷰 컴포넌트
 *
 * 📍 위치: DetailTimeGrid/components/DetailedView.js
 * 🔗 연결: ../index.js
 */

import React from 'react';
import { generateTimeSlots } from '../utils/timeCalculations';
import { formatDate } from '../utils/dateFormatters';
import TimeSlotItem from './TimeSlotItem';


const DetailedView = ({ selectedDate, schedule, mergedSchedule, exceptions, personalTimes, timeRange, showMerged, onSlotClick }) => {
  const timeSlots = generateTimeSlots(timeRange.start, timeRange.end);

  return (
    <div className="grid grid-cols-7 gap-0">
      {/* 시간 컬럼 */}
      <div className="bg-gray-50 border-r border-gray-200">
        <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
          시간
        </div>
        {timeSlots.map(time => (
          <div
            key={time}
            className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-100 h-6 flex items-center justify-center"
          >
            {time}
          </div>
        ))}
      </div>

      {/* 시간 슬롯 컬럼 */}
      <div className="col-span-6">
        <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
          {formatDate(selectedDate)}
        </div>
        {timeSlots.map(time => {
            <TimeSlotItem
              key={time}
              time={time}
              selectedDate={selectedDate}
              schedule={schedule}
              mergedSchedule={mergedSchedule}
              exceptions={exceptions}
              personalTimes={personalTimes}
              onSlotClick={onSlotClick}
              showMerged={showMerged}
            />
      </div>
    </div>
  );
};

export default DetailedView;
