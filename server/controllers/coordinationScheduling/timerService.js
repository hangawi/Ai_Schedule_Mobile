// 타이머 관련 서비스 로직
const setConfirmationTimer = (room, hours) => {
  const confirmAt = new Date();
  confirmAt.setHours(confirmAt.getHours() + hours);
  room.autoConfirmAt = confirmAt;
  room.autoConfirmDuration = hours;
};

const cancelConfirmationTimer = (room) => {
  room.autoConfirmAt = null;
  room.autoConfirmDuration = null;
};

// isScheduleConfirmed와 isConfirmationTimerRunning은 validators.js에서 임포트하여 사용하거나
// 필요에 따라 여기에 다시 정의할 수 있지만, 현재는 validators에 있으므로 재정의하지 않습니다.
// 여기서는 setConfirmationTimer와 cancelConfirmationTimer만 제공합니다.

module.exports = {
  setConfirmationTimer,
  cancelConfirmationTimer,
};
