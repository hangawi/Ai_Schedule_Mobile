/**
 * ===================================================================================================
 * DetailTimeGrid/index.js - 세부 시간표 편집 모달 (내 프로필 탭)
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/DetailTimeGrid/index.js
 *
 * 🎯 주요 기능:
 *    - 특정 날짜의 10분 단위 시간표를 세밀하게 편집
 *    - 시간 슬롯 클릭으로 우선순위 순환 (선호 3 → 보통 2 → 조정가능 1 → 삭제)
 *    - 직접 시간 입력 모드 (시작/종료 시간 직접 지정)
 *    - 복사 옵션 (다음주, 한달 전체, 특정 기간에 동일 시간 복사)
 *    - 병합/분할 뷰 토글
 *    - 24시간/기본(9~18시) 뷰 전환
 *    - 휴무일 설정 및 전체 날짜 삭제 기능
 *
 * 🔗 연결된 파일:
 *    - ./utils/timeCalculations.js - 시간 계산 유틸
 *    - ./utils/timeSlotMerger.js - 연속 시간 슬롯 병합
 *    - ./utils/dateFormatters.js - 날짜 포맷팅
 *    - ./constants/priorityConfig.js - 우선순위별 색상/레이블
 *    - ./handlers/slotHelpers.js - 슬롯 정보 조회 함수
 *    - ./handlers/copyHandler.js - 복사 옵션 핸들러
 *    - ./hooks/useHandlers.js - 핸들러 함수 모음
 *    - ./components/MergedView.js - 병합된 뷰 컴포넌트
 *    - ./components/DetailedView.js - 상세 뷰 컴포넌트
 *
 * ===================================================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

// Utilities
import { generateTimeSlots } from './utils/timeCalculations';
import { mergeConsecutiveTimeSlots } from './utils/timeSlotMerger';
import { formatDate } from './utils/dateFormatters';

// Constants
import { priorityConfig } from './constants/priorityConfig';

// Handlers
import { hasExceptionInTimeRange as _hasExceptionInTimeRange, removeExceptionsInTimeRange as _removeExceptionsInTimeRange } from './handlers/slotHelpers';
import { applyCopyOptions as _applyCopyOptions, applyCopyOptionsToSchedule as _applyCopyOptionsToSchedule } from './handlers/copyHandler';
import { createHandlers } from './hooks/useHandlers';

// Components
import MergedView from './components/MergedView';
import DetailedView from './components/DetailedView';
import CopyOptionsPanel from './components/CopyOptionsPanel';
import DirectInputPanel from './components/DirectInputPanel';

const DetailTimeGrid = ({
  selectedDate,
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  setExceptions,
  personalTimes = [],
  onClose,
  onSave,
  showFullDay = false
}) => {
  const { showToast } = useToast();
  const [timeRange, setTimeRange] = useState({ start: 9, end: 18 });
  const [selectionStart, setSelectionStart] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [previewSelection, setPreviewSelection] = useState([]);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [directInput, setDirectInput] = useState({
    startTime: '09:00',
    endTime: '10:00',
    priority: 2
  });
  const [showCopyOptions, setShowCopyOptions] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    copyType: 'none',
    includePrevWeek: false,
    includeNextWeek: false,
    includeWholeMonth: false
  });
  const [showMerged, setShowMerged] = useState(false);
  const [mergedSchedule, setMergedSchedule] = useState([]);

  // 초기 상태 저장 (저장하지 않고 닫을 때 복원용)
  const [initialExceptions] = useState([...exceptions]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 복사옵션 외부 클릭 감지를 위한 ref
  const copyOptionsRef = useRef(null);

  // 스케줄 변경 시 병합된 스케줄 업데이트
  useEffect(() => {
    setMergedSchedule(mergeConsecutiveTimeSlots(schedule));
  }, [schedule]);

  // 외부 클릭 감지하여 복사옵션 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (copyOptionsRef.current && !copyOptionsRef.current.contains(event.target)) {
        setShowCopyOptions(false);
      }
    };

    if (showCopyOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyOptions]);

  useEffect(() => {
    if (showFullDay) {
      setTimeRange({ start: 0, end: 24 });
    } else {
      setTimeRange({ start: 9, end: 18 });
    }
  }, [showFullDay]);

  // --- Wrapper functions for imported handlers ---
  const hasExceptionInTimeRange = (startHour, endHour) =>
    _hasExceptionInTimeRange(selectedDate, exceptions, startHour, endHour);

  const removeExceptionsInTimeRange = (startHour, endHour) =>
    _removeExceptionsInTimeRange(selectedDate, exceptions, setExceptions, setHasUnsavedChanges, startHour, endHour);

  const applyCopyOptions = (baseException) =>
    _applyCopyOptions(baseException, copyOptions, selectedDate, setExceptions);

  const applyCopyOptionsToSchedule = (baseSlots) =>
    _applyCopyOptionsToSchedule(baseSlots, copyOptions, selectedDate, setSchedule);

  // --- Create all handlers ---
  const {
    handleSlotClick,
    addQuickTimeSlot,
    addHolidayForDay,
    blockEntireDay,
    deleteEntireDay,
    handleDirectInput
  } = createHandlers({
    selectedDate, schedule, setSchedule, exceptions, setExceptions,
    readOnly, copyOptions, personalTimes, timeRange, setTimeRange,
    onSave, showToast, setHasUnsavedChanges, showMerged, mergedSchedule,
    directInput, setDirectInput, setShowDirectInput,
    getSlotInfo: () => {}, getExceptionForSlot: () => {},
    getPersonalTimeForSlot: () => {},
    hasExceptionInTimeRange, applyCopyOptions, applyCopyOptionsToSchedule,
    removeExceptionsInTimeRange
  });

  // --- Close handler ---
  const handleClose = () => {
    if (hasUnsavedChanges && setExceptions && readOnly) {
      setExceptions([...initialExceptions]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {formatDate(selectedDate)} 세부 시간표
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (timeRange.start === 0 && timeRange.end === 24) {
                      setTimeRange({ start: 9, end: 18 });
                    } else {
                      setTimeRange({ start: 0, end: 24 });
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors font-medium"
                >
                  {timeRange.start === 0 && timeRange.end === 24 ? '기본' : '24시간'}
                </button>
                <button
                  onClick={() => setShowMerged(!showMerged)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    showMerged
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  {showMerged ? '분할' : '병합'}
                </button>
              </div>
            </div>

            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>

          {!readOnly && (
            <div className="space-y-4">
              {/* 빠른 시간 추가 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-blue-800">빠른 시간 추가</h4>
                  <div className="flex gap-2 relative">
                    <CopyOptionsPanel
                      showCopyOptions={showCopyOptions}
                      copyOptions={copyOptions}
                      setCopyOptions={setCopyOptions}
                      copyOptionsRef={copyOptionsRef}
                    />
                    <button
                      onClick={deleteEntireDay}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200 transition-all font-medium"
                    >
                      전체삭제
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* 선호도 선택 */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-700">선호도:</span>
                    <select
                      value={directInput.priority}
                      onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
                      className="px-2 py-1 border border-blue-300 rounded text-sm bg-white"
                    >
                      <option value={3}>선호</option>
                      <option value={2}>보통</option>
                      <option value={1}>조정 가능</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => addQuickTimeSlot(9, 12, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(9, 12)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(9, 12) ? '오전 제거' : '오전 (9-12시)'}
                    </button>
                    <button
                      onClick={() => addQuickTimeSlot(13, 17, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(13, 17)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(13, 17) ? '오후 제거' : '오후 (13-17시)'}
                    </button>
                    <button
                      onClick={() => setShowDirectInput(!showDirectInput)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all transform hover:scale-105 font-medium shadow-md ${
                        showDirectInput
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      직접입력
                    </button>
                    <button
                      onClick={() => addHolidayForDay()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-all transform hover:scale-105 font-medium shadow-md"
                    >
                      휴무일
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DirectInputPanel
            showDirectInput={showDirectInput}
            directInput={directInput}
            setDirectInput={setDirectInput}
            handleDirectInput={handleDirectInput}
          />
        </div>

        {/* 범례 */}
        {!readOnly && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <span className="text-sm font-semibold text-gray-700">범례:</span>
              {Object.entries(priorityConfig).filter(([priority]) => priority !== '0').sort(([p1], [p2]) => p2 - p1).map(([priority, {label, color}]) => (
                <div key={priority} className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${color} mr-2`}></div>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              ))}
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-gray-300 mr-2"></div>
                <span className="text-sm text-gray-600">휴무일</span>
              </div>
            </div>
            {showMerged && (
              <div className="flex items-center justify-center space-x-4 border-t pt-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-green-400 mr-2"></div>
                  <span className="text-sm text-gray-600">병합된 시간대</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-white font-bold bg-green-600 px-2 py-1 rounded mr-2">30분</span>
                  <span className="text-sm text-gray-600">병합 지속시간</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 시간표 그리드 */}
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          {showMerged ? (
            <MergedView
              selectedDate={selectedDate}
              mergedSchedule={mergedSchedule}
              exceptions={exceptions}
              personalTimes={personalTimes}
              timeRange={timeRange}
              onSlotClick={handleSlotClick}
            />
          ) : (
            <DetailedView
              selectedDate={selectedDate}
              schedule={schedule}
              mergedSchedule={mergedSchedule}
              exceptions={exceptions}
              personalTimes={personalTimes}
              timeRange={timeRange}
              showMerged={showMerged}
              onSlotClick={handleSlotClick}
            />
          )}
        </div>

        {/* 푸터 */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-gray-600 font-medium">
              {readOnly
                ? "현재 설정된 시간표를 확인하고 있습니다."
                : "시간 슬롯을 클릭하여 우선순위를 설정하세요. (선호 → 보통 → 조정 가능 → 해제)"
              }
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailTimeGrid;
