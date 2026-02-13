import React from 'react';

const DirectInputPanel = ({ showDirectInput, directInput, setDirectInput, handleDirectInput }) => {
  if (!showDirectInput) return null;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h4 className="text-sm font-semibold mb-3 text-blue-800">직접 시간 입력</h4>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">시작 시간</label>
          <input
            type="time"
            value={directInput.startTime}
            onChange={(e) => setDirectInput({ ...directInput, startTime: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">종료 시간</label>
          <input
            type="time"
            value={directInput.endTime}
            onChange={(e) => setDirectInput({ ...directInput, endTime: e.target.value })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">선호도</label>
          <select
            value={directInput.priority}
            onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={3}>선호</option>
            <option value={2}>보통</option>
            <option value={1}>조정 가능</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleDirectInput}
            className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectInputPanel;
