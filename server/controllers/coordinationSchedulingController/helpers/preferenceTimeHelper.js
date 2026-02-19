// 선호시간 제거 헬퍼
const { timeToMinutes, minutesToTime, getDayOfWeekNumber } = require('../../coordinationScheduling/utils');

/**
 * 선호시간에서 배정된 부분만 제거하고 나머지는 분할하여 유지 + 백업
 */
const removePreferenceTimes = (user, slots, roomId) => {
  const deletedTimes = [];
  const newDefaultSchedule = [];

  // 1. 슬롯을 날짜별로 그룹화하고 개별 시간 범위 저장
  const assignedRangesByDate = {};

  slots.forEach(slot => {
    const dateStr = slot.date.toISOString().split('T')[0];
    const dayOfWeek = getDayOfWeekNumber(slot.day);

    if (!assignedRangesByDate[dateStr]) {
      assignedRangesByDate[dateStr] = {
        dateStr,
        dayOfWeek,
        ranges: []
      };
    }

    assignedRangesByDate[dateStr].ranges.push({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime)
    });
  });

  // 2. 각 선호시간을 확인하고 배정 범위와 겹치면 분할
  if (user.defaultSchedule) {
    user.defaultSchedule.forEach(schedule => {
      const prefStart = timeToMinutes(schedule.startTime);
      const prefEnd = timeToMinutes(schedule.endTime);
      const scheduleDayOfWeekForMatch = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

      let matchingDateRanges = null;

      for (const [dateStr, dateData] of Object.entries(assignedRangesByDate)) {
        const matches = schedule.specificDate
          ? schedule.specificDate === dateStr
          : scheduleDayOfWeekForMatch === dateData.dayOfWeek;

        if (matches) {
          matchingDateRanges = dateData;
          break;
        }
      }

      if (!matchingDateRanges) {
        newDefaultSchedule.push(schedule);
      } else {
        let currentSegments = [{ start: prefStart, end: prefEnd }];

        for (const assignedRange of matchingDateRanges.ranges) {
          const newSegments = [];

          for (const segment of currentSegments) {
            const overlapStart = Math.max(segment.start, assignedRange.start);
            const overlapEnd = Math.min(segment.end, assignedRange.end);

            if (overlapStart < overlapEnd) {
              deletedTimes.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(overlapStart),
                endTime: minutesToTime(overlapEnd),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });

              if (segment.start < assignedRange.start) {
                newSegments.push({ start: segment.start, end: assignedRange.start });
              }
              if (segment.end > assignedRange.end) {
                newSegments.push({ start: assignedRange.end, end: segment.end });
              }
            } else {
              newSegments.push(segment);
            }
          }

          currentSegments = newSegments;
        }

        for (const segment of currentSegments) {
          newDefaultSchedule.push({
            dayOfWeek: schedule.dayOfWeek,
            startTime: minutesToTime(segment.start),
            endTime: minutesToTime(segment.end),
            priority: schedule.priority,
            specificDate: schedule.specificDate
          });
        }
      }
    });

    user.defaultSchedule = newDefaultSchedule;
  }

  // scheduleExceptions에서 해당 날짜 삭제
  if (user.scheduleExceptions) {
    slots.forEach(slot => {
      const dateStr = slot.date.toISOString().split('T')[0];
      user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
        if (exception.specificDate) {
          return exception.specificDate !== dateStr;
        }
        return true;
      });
    });
  }

  // 백업된 삭제 시간을 user.deletedPreferencesByRoom에 저장
  if (deletedTimes.length > 0) {
    if (!user.deletedPreferencesByRoom) {
      user.deletedPreferencesByRoom = [];
    }

    user.deletedPreferencesByRoom = user.deletedPreferencesByRoom.filter(
      item => item.roomId.toString() !== roomId.toString()
    );

    user.deletedPreferencesByRoom.push({
      roomId: roomId,
      deletedTimes: deletedTimes,
      deletedAt: new Date()
    });
  }
};

module.exports = { removePreferenceTimes };
