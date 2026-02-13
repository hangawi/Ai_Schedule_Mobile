import React from 'react';

const EventEditPanel = ({
  currentTitle,
  isEditing,
  handleStartEdit,
  handleCancel,
  handleClearAll,
  handleSave,
}) => {
  return (
    <div className="schedule-page-title">
      <span>{currentTitle || '달력'}</span>
      <div className="top-edit-buttons">
        {!isEditing ? (
          <>
            <button className="edit-button" onClick={handleStartEdit}>편집</button>
          </>
        ) : (
          <>
            <button className="edit-button cancel-button" onClick={handleCancel}>취소</button>
            <button className="edit-button clear-button" onClick={handleClearAll}>초기화</button>
            <button className="edit-button save-button" onClick={handleSave}>저장</button>
          </>
        )}
      </div>
    </div>
  );
};

export default EventEditPanel;
