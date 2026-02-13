// 시간 관련 유틸리티 함수
// coordinationScheduling 컨트롤러의 시간 유틸리티 통합
const timeToMinutes = (timeString) => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const addDays = (startDate, days) => {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
};

const getTimeDifference = (startTime, endTime) => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
};

const getDayOfWeekNumber = (day) => {
  const dayMap = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  };
  return dayMap[day] || 1;
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  addDays,
  getTimeDifference,
  getDayOfWeekNumber,
};
