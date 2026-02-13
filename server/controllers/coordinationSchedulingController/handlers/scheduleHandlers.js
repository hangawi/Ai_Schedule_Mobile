/**
 * scheduleHandlers.js - 스케줄링 관련 API 핸들러
 *
 * 📍 위치: controllers/coordinationSchedulingController/handlers/scheduleHandlers.js
 * 🔗 연결: ../../coordinationSchedulingController.js
 *
 * 핸들러: runAutoSchedule, deleteAllTimeSlots, getAvailableSlots
 */

const Room = require('../../../models/room');
const User = require('../../../models/user');
const ActivityLog = require('../../../models/ActivityLog');
const schedulingAlgorithm = require('../../../services/schedulingAlgorithm');

const { HTTP_STATUS } = require('../constants/errorMessages');

const {
  validateOwnerSchedule,
  validateMembersSchedule,
} = require('../validators/scheduleValidator');
const {
  validateRoomExists,
  validateOwnerPermission,
} = require('../validators/roomPermissionValidator');

const {
  getRoomWithMembers,
  clearTravelModeData,
  removeAutoAssignedSlots,
  updateRoomSettings,
  getMembersOnly,
  getMemberIds,
  getExistingCarryOvers,
} = require('../helpers/roomHelper');
const { shouldPreserveSlot } = require('../utils/slotUtils');

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      minHoursPerWeek = 3,
      numWeeks = 4,
      currentWeek,
      assignmentMode,
      transportMode = 'normal',
      minClassDurationMinutes = 60,
      skipConfirmation = false  // 사전 확인 건너뛰기 플래그
    } = req.body;

    const validModes = ['normal', 'first_come_first_served', 'from_today'];
    const mode = assignmentMode && validModes.includes(assignmentMode)
      ? assignmentMode
      : 'normal';

    const startDate = currentWeek ? new Date(currentWeek) : new Date();

    // 방 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 이전 자동 배정 슬롯 제거 (협의/확정 보존)
    removeAutoAssignedSlots(room, shouldPreserveSlot);
    clearTravelModeData(room);

    // 시간 검증
    if (minHoursPerWeek < 0.167 || minHoursPerWeek > 10) {
      return res.status(400).json({ msg: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.' });
    }

    // 설정 저장
    updateRoomSettings(room, { minHoursPerWeek, assignmentMode: mode });
    await room.save();

    // 조원 추출
    const membersOnly = getMembersOnly(room);
    const memberIds = getMemberIds(membersOnly);

    // 선호시간 검증
    if (!validateOwnerSchedule(room.owner)) {
      const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
      return res.status(400).json({
        msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
      });
    }

    const membersWithoutSchedule = validateMembersSchedule(membersOnly);
    if (membersWithoutSchedule.length > 0) {
      return res.status(400).json({
        msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
      });
    }

    // 이월 정보 수집
    const existingCarryOvers = getExistingCarryOvers(room.members, startDate);

    // 🔍 사전 선호시간 체크 (skipConfirmation이 false일 때만)
    if (!skipConfirmation) {
      const insufficientMembers = [];
      const requiredMinutesPerWeek = minHoursPerWeek * 60;

      // 각 멤버의 전체 기간 선호시간 계산
      for (const member of membersOnly) {
        const user = member.user;
        const memberName = user?.firstName || user?.name || 'Unknown';

        console.log(`
🔍 [사전체크] ${memberName} 선호시간 계산 시작`);

        let totalPreferredMinutes = 0;

        // numWeeks만큼 반복하여 각 주의 선호시간 계산
        for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
          const weekStartDate = new Date(startDate);
          weekStartDate.setUTCDate(startDate.getUTCDate() + (weekIndex * 7));

          const weekDays = [];
          for (let i = 0; i < 7; i++) {
            const day = new Date(weekStartDate);
            day.setUTCDate(weekStartDate.getUTCDate() + i);
            weekDays.push(day);
          }

          let weekPreferredMinutes = 0;
          for (const day of weekDays) {
            const dayOfWeek = day.getUTCDay();
            const dateStr = day.toISOString().split('T')[0];

            console.log(`  [${dateStr}] dayOfWeek=${dayOfWeek}`);

            const daySchedules = (user.defaultSchedule || []).filter(s => {
              if (s.priority < 2) return false;
              if (s.specificDate) {
                const specificDateStr = new Date(s.specificDate).toISOString().split('T')[0];
                return specificDateStr === dateStr;
              }
              return s.dayOfWeek === dayOfWeek;
            });


            for (const schedule of daySchedules) {
              const [startHour, startMin] = schedule.startTime.split(':').map(Number);
              const [endHour, endMin] = schedule.endTime.split(':').map(Number);
              const minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
              weekPreferredMinutes += minutes;
            }
          }


          totalPreferredMinutes += weekPreferredMinutes;

          // 이번 주 선호시간이 부족하면 기록하고 중단
          if (weekPreferredMinutes < requiredMinutesPerWeek) {
            break; // 한 주라도 부족하면 중단 (하지만 totalPreferredMinutes는 유지)
          }
        }

        // 한 주라도 부족하면 insufficientMembers에 추가
        if (totalPreferredMinutes < requiredMinutesPerWeek * numWeeks) {
          insufficientMembers.push({
            memberName,
            memberId: member.user._id.toString(),
            availableMinutes: totalPreferredMinutes,
            requiredMinutes: requiredMinutesPerWeek * numWeeks
          });
        }
      }

      // 부족한 멤버가 있으면 확인 요청 응답
      if (insufficientMembers.length > 0) {
        return res.status(200).json({
          needsConfirmation: true,
          insufficientMembers,
          message: '일부 멤버의 선호시간이 부족합니다. 해당 멤버를 제외하고 배정하시겠습니까?'
        });
      }
    }

    // 자동 스케줄링 실행 (주별 선호시간 체크는 알고리즘 내부에서 처리)
    const result = await schedulingAlgorithm.runAutoSchedule(
      membersOnly,
      room.owner,
      room.timeSlots,
      {
        assignmentMode: mode,
        minHoursPerWeek,
        numWeeks,
        currentWeek,
        roomSettings: {
          ...room.settings,
          ownerBlockedTimes: room.settings.blockedTimes || []
        },
        transportMode,
        minClassDurationMinutes
      },
      existingCarryOvers,
    );

    // 🔧 선호시간 부족 경고 (주별) - 배정은 계속 진행
    const preferenceWarnings = (result.warnings || []).filter(
      w => w.type === 'insufficient_preferred_time'
    );

    if (preferenceWarnings.length > 0) {
      preferenceWarnings.forEach(w => {
        console.log(`   - ${w.message}`);
      });
    }

    // 장기 이월 확인
    const twoWeeksAgo = new Date(startDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date(startDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const conflictSuggestions = [];

    for (const member of room.members) {
      const memberUser = await User.findById(member.user);
      if (member.carryOver > 0) {
        const history = member.carryOverHistory || [];

        const hasConsecutiveCarryOver = history.some(h =>
          new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
          new Date(h.week).getTime() < oneWeekAgo.getTime() &&
          h.amount > 0
        );

        if (hasConsecutiveCarryOver) {
          const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
          conflictSuggestions.push({
            title: '장기 이월 멤버 발생',
            content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
          });
        }
      }
    }

    // 슬롯을 room.timeSlots에 직접 추가
    const addedSlots = new Set();

    Object.values(result.assignments).forEach(assignment => {
      if (assignment.slots && assignment.slots.length > 0) {
        assignment.slots.forEach((slot, idx) => {
          // 필수 필드 검증
          if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
            return;
          }

          // 중복 체크를 위한 유니크 키 생성
          const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

          if (!addedSlots.has(slotKey)) {
            const newSlot = {
              user: assignment.memberId,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              day: slot.day,
              priority: 3,
              subject: '자동 배정',
              assignedBy: req.user.id || req.user._id || 'auto-scheduler',
              assignedAt: new Date(),
              status: 'confirmed',
            };

            room.timeSlots.push(newSlot);
            addedSlots.add(slotKey);
          }
        });
      }
    });

    // 이월 시간 처리
    for (const member of room.members) {
      const memberId = member.user._id.toString();
      const assignment = result.assignments[memberId];

      if (assignment && assignment.assignedHours >= minHoursPerWeek * 2) {
        if (member.carryOver > 0) {
          member.carryOverHistory.push({
            week: startDate,
            amount: -member.carryOver,
            reason: 'resolved_by_auto_schedule',
            timestamp: new Date()
          });
          member.carryOver = 0;
        }
      }
    }

    if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {
      for (const carryOver of result.carryOverAssignments) {
        const memberIndex = room.members.findIndex(m =>
          m.user.toString() === carryOver.memberId
        );

        if (memberIndex !== -1) {
          const member = room.members[memberIndex];
          member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

          if (carryOver.neededHours > 0) {
            if (!member.carryOverHistory) {
              member.carryOverHistory = [];
            }

            member.carryOverHistory.push({
              week: carryOver.week || startDate,
              amount: carryOver.neededHours,
              reason: 'unassigned_from_auto_schedule',
              timestamp: new Date(),
              priority: carryOver.priority || 3
            });

            // 2주 이상 연속 이월 체크
            const recentCarryOvers = member.carryOverHistory.filter(h => {
              const historyDate = new Date(h.week);
              const twoWeeksAgo = new Date(startDate);
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              return historyDate >= twoWeeksAgo && h.amount > 0;
            });

            if (recentCarryOvers.length >= 2) {
              member.needsIntervention = true;
              member.interventionReason = 'consecutive_carryover';
            }
          }
        }
      }
    }

    // 우선도에 따른 다음 주 우선 배정
    Object.values(result.assignments).forEach(assignment => {
      if (assignment.carryOver && assignment.carryOver > 0) {
        const memberIndex = room.members.findIndex(m =>
          m.user.toString() === assignment.memberId
        );

        if (memberIndex !== -1) {
          const member = room.members[memberIndex];
          if (!member.tempPriorityBoost) {
            member.tempPriorityBoost = assignment.carryOver;
          }
        }
      }
    });

    // 자동 확정 타이머 설정
    const autoConfirmDurationMinutes = room.autoConfirmDuration || 5;
    const autoConfirmDelay = autoConfirmDurationMinutes * 60 * 1000;
    room.autoConfirmAt = new Date(Date.now() + autoConfirmDelay);

    // 자동배정은 항상 normal 모드로 실행
    room.currentTravelMode = 'normal';
    room.confirmedTravelMode = null;
    room.travelTimeSlots = [];

    await room.save();

    // 활동 로그 기록
    try {
      const ownerUser = await User.findById(req.user.id);
      const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : 'Unknown';
      await ActivityLog.logActivity(
        roomId,
        req.user.id,
        ownerName,
        'auto_assign',
        `자동배정 실행 완료 (주당 ${minHoursPerWeek}시간, ${membersOnly.length}명 배정)`
      );
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    // freshRoom populate 후 반환
    const freshRoom = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
      .populate('members.user', 'firstName lastName email defaultSchedule address addressDetail addressLat addressLng')
      .populate('timeSlots.user', '_id firstName lastName email')
      .populate('requests.requester', 'firstName lastName email')
      .populate('requests.targetUser', 'firstName lastName email')
      .lean();

    res.json({
      room: freshRoom,
      unassignedMembersInfo: result.unassignedMembersInfo,
      conflictSuggestions: conflictSuggestions,
      assignmentMode: mode,
      warnings: preferenceWarnings.length > 0 ? preferenceWarnings : undefined, // 선호시간 부족 경고
    });
  } catch (error) {
    if (error.message.includes('defaultSchedule')) {
      res.status(400).json({ msg: '선호시간표 데이터에 오류가 있습니다. 모든 멤버가 내프로필에서 선호시간표를 설정했는지 확인해주세요.' });
    } else if (error.message.includes('timeSlots')) {
      res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 선호시간표를 설정했는지 확인해주세요.' });
    } else if (error.message.includes('member')) {
      res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
    } else if (error.message.includes('settings')) {
      res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
    } else if (error.message.includes('priority')) {
      res.status(400).json({ msg: '우선순위 설정에 오류가 있습니다. 멤버 우선순위를 확인해주세요.' });
    } else {
      res.status(500).json({ msg: `자동 배정 실행 중 오류가 발생했습니다: ${error.message}` });
    }
  }
};

// @desc    Delete all time slots
// @route   DELETE /api/coordination/rooms/:roomId/slots
// @access  Private (Room Owner only)
exports.deleteAllTimeSlots = async (req, res) => {
  // Retry 헬퍼 함수 (VersionError 처리)
  const saveWithRetry = async (doc, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await doc.save();
        return;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries) {
          // 최신 버전 다시 불러오기
          const Model = doc.constructor;
          const fresh = await Model.findById(doc._id);
          if (fresh) {
            // 변경사항 재적용
            if (doc.personalTimes !== undefined) fresh.personalTimes = doc.personalTimes;
            if (doc.defaultSchedule !== undefined) fresh.defaultSchedule = doc.defaultSchedule;
            if (doc.deletedPreferencesByRoom !== undefined) fresh.deletedPreferencesByRoom = doc.deletedPreferencesByRoom;
            doc = fresh;
          }
        } else {
          throw error;
        }
      }
    }
  };

  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId)
      .populate('owner', 'personalTimes')
      .populate('members.user', 'personalTimes');

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // Clear the timeSlots array
    room.timeSlots = [];

    // 자동 확정 타이머 해제 (전체 비우기)
    room.autoConfirmAt = null;

    // 확정된 이동수단 모드 초기화
    room.confirmedTravelMode = null;
    room.confirmedAt = null;

    // ✨ 이동시간 관련 데이터 모두 초기화
    room.travelTimeSlots = [];
    room.originalTimeSlots = [];
    room.currentTravelMode = 'normal';

    // Also clear non-pending requests as they are linked to slots
    room.requests = room.requests.filter(r => r.status === 'pending');

    await room.save();

    // 확정된 개인일정 삭제 + 선호시간 복구
    const updatePromises = [];

    // 조원들의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
    for (const member of room.members) {
      const memberUser = await User.findById(member.user._id || member.user);
      if (memberUser) {
        // personalTimes에서 해당 방 관련 항목 삭제
        if (memberUser.personalTimes) {
          memberUser.personalTimes = memberUser.personalTimes.filter(pt =>
            !pt.title || !pt.title.includes(room.name)
          );
        }

        // 백업된 선호시간 복구
        if (memberUser.deletedPreferencesByRoom) {
          const backup = memberUser.deletedPreferencesByRoom.find(
            item => item.roomId.toString() === roomId.toString()
          );

          if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
            // defaultSchedule 초기화 (없으면)
            if (!memberUser.defaultSchedule) {
              memberUser.defaultSchedule = [];
            }

            // 백업된 선호시간을 defaultSchedule에 다시 추가
            backup.deletedTimes.forEach(deletedTime => {
              // 중복 체크 (같은 dayOfWeek, startTime, endTime)
              const isDuplicate = memberUser.defaultSchedule.some(schedule =>
                schedule.dayOfWeek === deletedTime.dayOfWeek &&
                schedule.startTime === deletedTime.startTime &&
                schedule.endTime === deletedTime.endTime &&
                schedule.specificDate === deletedTime.specificDate
              );

              if (!isDuplicate) {
                memberUser.defaultSchedule.push(deletedTime);
              }
            });

            // 백업 삭제 (복구 완료)
            memberUser.deletedPreferencesByRoom = memberUser.deletedPreferencesByRoom.filter(
              item => item.roomId.toString() !== roomId.toString()
            );
          }
        }

        updatePromises.push(saveWithRetry(memberUser));
      }
    }

    // 방장의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
    const owner = await User.findById(room.owner._id || room.owner);
    if (owner) {
      // personalTimes에서 해당 방 관련 항목 삭제
      if (owner.personalTimes) {
        owner.personalTimes = owner.personalTimes.filter(pt =>
          !pt.title || !pt.title.includes(room.name)
        );
      }

      // 백업된 선호시간 복구
      if (owner.deletedPreferencesByRoom) {
        const backup = owner.deletedPreferencesByRoom.find(
          item => item.roomId.toString() === roomId.toString()
        );

        if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
          // defaultSchedule 초기화 (없으면)
          if (!owner.defaultSchedule) {
            owner.defaultSchedule = [];
          }

          // 백업된 선호시간을 defaultSchedule에 다시 추가
          backup.deletedTimes.forEach(deletedTime => {
            // 중복 체크 (같은 dayOfWeek, startTime, endTime)
            const isDuplicate = owner.defaultSchedule.some(schedule =>
              schedule.dayOfWeek === deletedTime.dayOfWeek &&
              schedule.startTime === deletedTime.startTime &&
              schedule.endTime === deletedTime.endTime &&
              schedule.specificDate === deletedTime.specificDate
            );

            if (!isDuplicate) {
              owner.defaultSchedule.push(deletedTime);
            }
          });

          // 백업 삭제 (복구 완료)
          owner.deletedPreferencesByRoom = owner.deletedPreferencesByRoom.filter(
            item => item.roomId.toString() !== roomId.toString()
          );
        }
      }

      updatePromises.push(saveWithRetry(owner));
    }

    await Promise.all(updatePromises);

    const updatedRoom = await Room.findById(room._id)
       .populate('owner', 'firstName lastName email address addressLat addressLng')
       .populate('members.user', 'firstName lastName email address addressLat addressLng')
       .populate('timeSlots.user', '_id firstName lastName email');

    res.json(updatedRoom);

  } catch (error) {
    console.error('Error deleting all time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get available slots
// @route   GET /api/coordination/rooms/:roomId/available-slots
// @access  Private
exports.getAvailableSlots = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await getRoomWithMembers(roomId);
    if (!validateRoomExists(room, res)) return;

    // 현재 슬롯 반환
    res.json({
      success: true,
      data: {
        timeSlots: room.timeSlots,
        travelTimeSlots: room.travelTimeSlots || []
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '슬롯 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};
