// 이동 모드 관련 서비스 로직
const Room = require('../../models/room'); // Adjust path
const User = require('../../models/user'); // Adjust path (for validateScheduleWithTransportMode)
const ActivityLog = require('../../models/ActivityLog'); // Adjust path (for validateScheduleWithTransportMode)
const dynamicTravelTimeCalculator = require('../../services/dynamicTravelTimeCalculator'); // Adjust path
const { HTTP_STATUS, VALIDATION_RULES, ERROR_MESSAGES, SLOT_TYPES } = require('./constants'); // Adjust path
const { validateRoomExists, validateOwnerPermission } = require('./validators'); // Adjust path
const { getRoomById, getRoomWithMembers } = require('./helpers'); // Adjust path
const { timeToMinutes, minutesToTime } = require('./utils'); // Adjust path


// from original travelModeService.js
const mergeConsecutiveClassSlots = (slots) => {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;

    const userA = (a.user._id || a.user).toString();
    const userB = (b.user._id || b.user).toString();
    const userCompare = userA.localeCompare(userB);
    if (userCompare !== 0) return userCompare;

    return a.startTime.localeCompare(b.startTime);
  });

  const merged = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentUserId = (current.user._id || current.user).toString();
    const nextUserId = (next.user._id || next.user).toString();
    const currentDate = new Date(current.date).toISOString().split('T')[0];
    const nextDate = new Date(next.date).toISOString().split('T')[0];

    if (
      currentUserId === nextUserId &&
      currentDate === nextDate &&
      current.subject === next.subject &&
      current.endTime === next.startTime
    ) {
      current.endTime = next.endTime;
      if (next.originalEndTime) {
        current.originalEndTime = next.originalEndTime;
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
};

const validateAndCorrectBlockedTimes = (room) => {
  const blockedTimes = room.settings?.blockedTimes || [];

  if (blockedTimes.length === 0) {
    return 0;
  }

  let violationCount = 0;

  for (let idx = 0; idx < room.timeSlots.length; idx++) {
    const slot = room.timeSlots[idx];

    if (slot.adjustedForTravelTime) {
      const isTimeInBlockedRange = (startTime, endTime, blockedTimes) => {
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        
        for (const blocked of blockedTimes) {
          const blockedStart = timeToMinutes(blocked.startTime);
          const blockedEnd = timeToMinutes(blocked.endTime);
          
          if (start < blockedEnd && end > blockedStart) {
            return blocked;
          }
        }
        return null;
      };

      const blockedTime = isTimeInBlockedRange(slot.startTime, slot.endTime, blockedTimes);

      if (blockedTime) {
        violationCount++;

        const blockedEndMinutes = timeToMinutes(blockedTime.endTime);
        const slotDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const newStartMinutes = blockedEndMinutes;
        const newEndMinutes = blockedEndMinutes + slotDuration;

        const correctedStart = minutesToTime(newStartMinutes);
        const correctedEnd = minutesToTime(newEndMinutes);

        slot.startTime = correctedStart;
        slot.endTime = correctedEnd;
      }
    }
  }
  return violationCount;
};

const applyNormalMode = (room) => {
  if (room.originalTimeSlots && room.originalTimeSlots.length > 0) {
    room.timeSlots = room.originalTimeSlots;
    room.originalTimeSlots = [];
  }
  room.travelTimeSlots = [];
};

const mapAndSaveTravelSlots = (room, receivedTravelSlots, travelMode) => {
  room.travelTimeSlots = receivedTravelSlots.map(e => {
    const dateObj = e.date instanceof Date ? e.date : new Date(e.date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];

    const userId = e.user?._id || e.user || room.owner._id;

    let userColor = e.color;
    if (!userColor) {
      userColor = room.getUserColor(userId);
    }
    
    return {
      user: userId,
      date: dateObj,
      day: e.day || dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      subject: '이동시간',
      type: 'travel',
      color: userColor,
      from: e.from,
      to: e.to,
      travelMode: e.travelMode || travelMode,
      travelInfo: e.travelInfo
    };
  });
};

const applyClassTimeSlots = (room, receivedTimeSlots) => {
  const classTimeSlots = receivedTimeSlots.filter(e => !e.isTravel && e.subject !== '이동시간');
  const mergedSlots = mergeConsecutiveClassSlots(classTimeSlots);
  
  room.timeSlots = mergedSlots.map((e) => {
    const adjustedStartTime = e.startTime;
    const adjustedEndTime = e.endTime;

    const newSlot = {
      user: e.user._id || e.user,
      date: e.date instanceof Date ? e.date : new Date(e.date),
      day: e.day,
      startTime: adjustedStartTime,
      endTime: adjustedEndTime,
      subject: e.subject || '자동 배정',
      assignedBy: room.owner._id,
      status: 'confirmed',
      adjustedForTravelTime: e.adjustedForTravelTime || false,
      originalStartTime: e.originalStartTime,
      originalEndTime: e.originalEndTime,
      actualStartTime: e.actualStartTime,
      travelTimeBefore: e.travelTimeBefore
    };
    return newSlot;
  });
};

const saveRoomWithRetry = async (room) => {
  const maxRetries = VALIDATION_RULES.MAX_RETRIES;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await room.save();
      return room;
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries) {
        const freshRoom = await Room.findById(room._id);
        if (freshRoom) {
          freshRoom.timeSlots = room.timeSlots;
          freshRoom.originalTimeSlots = room.originalTimeSlots;
          freshRoom.travelTimeSlots = room.travelTimeSlots;
          freshRoom.currentTravelMode = room.currentTravelMode;
          room = freshRoom;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      } else {
        throw error;
      }
    }
  }
};

const applyTravelModeToRoom = async (room, enhancedSchedule, travelMode) => {
  const receivedTimeSlots = enhancedSchedule?.timeSlots || (Array.isArray(enhancedSchedule) ? enhancedSchedule : null);
  const receivedTravelSlots = enhancedSchedule?.travelSlots || enhancedSchedule?.travelTimeSlots || [];

  if (!receivedTimeSlots || !Array.isArray(receivedTimeSlots)) {
    throw new Error('enhancedSchedule.timeSlots이 필요합니다.');
  }

  if (travelMode === 'normal') {
    applyNormalMode(room);
  } else {
    if (!room.originalTimeSlots || room.originalTimeSlots.length === 0) {
      room.originalTimeSlots = JSON.parse(JSON.stringify(room.timeSlots));
    }
    mapAndSaveTravelSlots(room, receivedTravelSlots, travelMode);
    applyClassTimeSlots(room, receivedTimeSlots);
  }

  if (travelMode !== 'normal') {
    validateAndCorrectBlockedTimes(room);
  }
  room.currentTravelMode = travelMode;
  await saveRoomWithRetry(room);
  return room;
};

const confirmTravelModeForRoom = async (room, travelMode) => {
  const previousConfirmedMode = room.confirmedTravelMode;
  room.confirmedTravelMode = travelMode;
  room.currentTravelMode = travelMode;
  await room.save();
  return { previousMode: previousConfirmedMode, currentMode: travelMode };
};


// From coordinationSchedulingController.js (exports.applyTravelMode)
const applyTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode, enhancedSchedule } = req.body;

    const room = await Room.findById(roomId).populate('members', 'name email').populate('owner', 'name email');
    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ msg: ERROR_MESSAGES.ROOM_NOT_FOUND });
    }
    if (!room.owner._id.equals(req.user.id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ msg: ERROR_MESSAGES.OWNER_ONLY });
    }
    if (room.confirmedAt) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: '이미 확정된 스케줄입니다. 확정 이후에는 이동시간 모드를 변경할 수 없습니다.',
        confirmedAt: room.confirmedAt
      });
    }

    // applyTravelModeToRoom 서비스 함수 호출
    const updatedRoom = await applyTravelModeToRoom(room, enhancedSchedule, travelMode);

    // Socket.io 이벤트
    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('travelModeChanged', {
        roomId: updatedRoom._id.toString(),
        travelMode: updatedRoom.currentTravelMode,
        timeSlots: updatedRoom.timeSlots,
        currentTravelMode: updatedRoom.currentTravelMode
      });
    }

    res.json({
      success: true,
      travelMode: updatedRoom.currentTravelMode,
      timeSlotsCount: updatedRoom.timeSlots.length
    });

  } catch (error) {
    console.error('applyTravelMode error:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};


// From coordinationSchedulingController.js (exports.confirmTravelMode)
const confirmTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body;

    const room = await getRoomById(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    const { previousMode, currentMode } = await confirmTravelModeForRoom(room, travelMode);

    res.json({
      success: true,
      msg: `${currentMode} 모드가 확정되었습니다.`,
      data: {
        previousMode,
        currentMode,
        confirmedTravelMode: room.confirmedTravelMode
      }
    });

  } catch (error) {
    console.error('confirmTravelMode error:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '이동 모드 확정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};


// From coordinationSchedulingController.js (exports.validateScheduleWithTransportMode)
const validateScheduleWithTransportMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { transportMode, viewMode, weekStartDate } = req.body;

    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng');

    if (!room) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ msg: ERROR_MESSAGES.ROOM_NOT_FOUND });
    }
    if (!room.isOwner(req.user.id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ msg: ERROR_MESSAGES.OWNER_ONLY });
    }

    let autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed' && !slot.isTravel
    );
    if (viewMode === 'week' && weekStartDate) {
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      autoAssignedSlots = autoAssignedSlots.filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= weekStart && slotDate < weekEnd;
      });
    }

    if (autoAssignedSlots.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false,
        msg: '검증할 스케줄이 없습니다. 먼저 자동배정을 실행하세요.' 
      });
    }

    if (transportMode === 'normal') {
      return res.json({
        success: true,
        isValid: true,
        transportMode: 'normal',
        warnings: [],
        msg: '일반 모드는 항상 유효합니다.'
      });
    }

    const warnings = [];
    const membersOnly = room.members.filter(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
      return memberId !== ownerId;
    });

    const ownerLocation = {
      lat: room.owner.addressLat,
      lng: room.owner.addressLng,
      address: room.owner.address
    };
    if (!ownerLocation.lat || !ownerLocation.lng) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        msg: '방장의 주소 정보가 없습니다. 프로필에서 주소를 설정해주세요.'
      });
    }

    for (const member of membersOnly) {
      const memberUser = member.user;
      const memberId = memberUser._id.toString();
      const memberName = `${memberUser.firstName} ${memberUser.lastName}`;

      if (!memberUser.addressLat || !memberUser.addressLng) {
        warnings.push({
          type: 'no_address',
          memberId: memberId,
          memberName: memberName,
          reason: '주소 정보 없음'
        });
        continue;
      }

      const memberSlots = autoAssignedSlots.filter(slot => 
        slot.user.toString() === memberId
      );
      if (memberSlots.length === 0) {
        warnings.push({
          type: 'not_assigned',
          memberId: memberId,
          memberName: memberName,
          reason: '스케줄에 배정되지 않음'
        });
        continue;
      }

      const memberLocation = {
        coordinates: { lat: memberUser.addressLat, lng: memberUser.addressLng },
        address: memberUser.address
      };
      const ownerLocationFormatted = {
        coordinates: { lat: ownerLocation.lat, lng: ownerLocation.lng },
        address: ownerLocation.address
      };

      let travelTimeMinutes = 0;
      try {
        travelTimeMinutes = await dynamicTravelTimeCalculator.calculateTravelTimeBetween(
          memberLocation,
          ownerLocationFormatted,
          transportMode
        );
      } catch (error) {
        warnings.push({
          type: 'travel_time_error',
          memberId: memberId,
          memberName: memberName,
          reason: '이동시간 계산 실패'
        });
        continue;
      }

      const dayTranslation = {
        'monday': '월요일', 'tuesday': '화요일', 'wednesday': '수요일', 'thursday': '목요일', 'friday': '금요일', 'saturday': '토요일', 'sunday': '일요일'
      };
      const dayOfWeekMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
      };

      const slotsByDay = {};
      memberSlots.forEach(slot => {
        if (!slotsByDay[slot.day]) { slotsByDay[slot.day] = []; }
        slotsByDay[slot.day].push(slot);
      });

      for (const [dayEn, daySlots] of Object.entries(slotsByDay)) {
        const dayKo = dayTranslation[dayEn] || dayEn;
        let totalClassMinutes = 0;
        daySlots.forEach(slot => {
          const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
          totalClassMinutes += duration;
        });

        const totalRequiredMinutes = travelTimeMinutes + totalClassMinutes;
        const targetDayOfWeek = dayOfWeekMap[dayEn];
        let targetDate = null;
        daySlots.forEach(slot => { if (!targetDate) { targetDate = new Date(slot.date); } });

        const preferredSchedules = (memberUser.defaultSchedule || []).filter(s => {
          if (s.specificDate) {
            const scheduleDate = new Date(s.specificDate);
            const targetDateStr = targetDate ? targetDate.toISOString().split('T')[0] : null;
            const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
            return scheduleDateStr === targetDateStr;
          }
          return s.dayOfWeek === targetDayOfWeek || s.day === dayEn;
        });
        
        if (preferredSchedules.length === 0) {
          warnings.push({
            type: 'no_preference_for_day',
            memberId: memberId,
            memberName: memberName,
            day: dayKo,
            dayEn: dayEn,
            reason: `${dayKo}에 선호시간 없음`
          });
          continue;
        }

        const mergedIntervals = [];
        const sortedPrefs = preferredSchedules
          .map(pref => ({ start: timeToMinutes(pref.startTime), end: timeToMinutes(pref.endTime) }))
          .sort((a, b) => a.start - b.start);

        for (const interval of sortedPrefs) {
          if (mergedIntervals.length === 0 || mergedIntervals[mergedIntervals.length - 1].end < interval.start) {
            mergedIntervals.push({ start: interval.start, end: interval.end });
          } else {
            mergedIntervals[mergedIntervals.length - 1].end = Math.max(mergedIntervals[mergedIntervals.length - 1].end, interval.end);
          }
        }

        let totalAvailableMinutes = 0;
        mergedIntervals.forEach(interval => { totalAvailableMinutes += (interval.end - interval.start); });

        if (totalRequiredMinutes > totalAvailableMinutes) {
          warnings.push({
            type: 'insufficient_preference',
            memberId: memberId,
            memberName: memberName,
            day: dayKo,
            dayEn: dayEn,
            requiredMinutes: totalRequiredMinutes,
            availableMinutes: totalAvailableMinutes,
            travelMinutes: travelTimeMinutes,
            classMinutes: totalClassMinutes,
            reason: `${dayKo} 선호시간 부족 (필요 ${totalRequiredMinutes}분, 가용 ${totalAvailableMinutes}분)`
          });
        }
      }
    }

    const isValid = warnings.length === 0;

    res.json({
      success: true,
      isValid: isValid,
      transportMode: transportMode,
      warnings: warnings,
      msg: isValid 
        ? `${transportMode} 모드로 스케줄이 유효합니다.`
        : `${transportMode} 모드로 스케줄 검증에 ${warnings.length}개의 문제가 발견되었습니다.`
    });

  } catch (error) {
    console.error('validateScheduleWithTransportMode error:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
      success: false,
      msg: '서버 오류가 발생했습니다.', 
      error: error.message 
    });
  }
};

module.exports = {
  applyTravelMode,
  confirmTravelMode,
  validateScheduleWithTransportMode,
  applyTravelModeToRoom,
  confirmTravelModeForRoom,
  mergeConsecutiveClassSlots,
  validateAndCorrectBlockedTimes,
  applyNormalMode,
  mapAndSaveTravelSlots,
  applyClassTimeSlots,
  saveRoomWithRetry,
};
