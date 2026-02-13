import React from 'react';

const CopyOptionsPanel = ({ showCopyOptions, copyOptions, setCopyOptions, copyOptionsRef }) => {
  return (
    <div className="relative" ref={copyOptionsRef}>
      <button
        onClick={() => setCopyOptions(prev => ({...prev, show: !prev.show}))} // assuming setCopyOptions now manages a 'show' property
        className={`px-3 py-1 rounded-lg text-xs transition-all font-medium ${
          showCopyOptions
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
        }`}
      >
        복사옵션
      </button>

      {showCopyOptions && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>
          <div className="p-4">
            <h4 className="text-sm font-semibold mb-3 text-gray-800">복사 옵션 설정</h4>
            <div className="space-y-2">
              {[
                { value: 'none', label: '복사하지 않음 (현재 날짜만)' },
                { value: 'nextWeek', label: '다음주 같은 요일에 복사' },
                { value: 'prevWeek', label: '이전주 같은 요일에 복사' },
                { value: 'wholeMonth', label: '이번달 모든 같은 요일에 복사' },
                { value: 'thisWholeWeek', label: '이번 주 내내 적용' },
                { value: 'nextWholeWeek', label: '다음 주 내내 적용' },
              ].map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="copyType"
                    value={option.value}
                    checked={copyOptions.copyType === option.value}
                    onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                    className="mr-2"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              선택한 옵션은 시간 추가 시 자동으로 적용됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyOptionsPanel;
