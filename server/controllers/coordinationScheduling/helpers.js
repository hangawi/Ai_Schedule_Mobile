const Room = require('../../models/room');
const User = require('../../models/user');
const { SLOT_TYPES } = require('./constants');
const { timeToMinutes, minutesToTime, getDayOfWeekNumber } = require('./utils');


// from roomHelper.js
const getRoomWithMembers = async (roomId) => {
  return await Room.findById(roomId)
    .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
    .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');
};

const getRoomById = async (roomId) => {
  return await Room.findById(roomId);
};

const clearTravelModeData = (room) => {
  room.originalTimeSlots = [];
  room.travelTimeSlots = [];
};

const removeAutoAssignedSlots = (room, shouldPreserve) => {
  room.timeSlots = room.timeSlots.filter(shouldPreserve);
};

const updateRoomSettings = (room, settings) => {
  Object.assign(room.settings, settings);
};

const getMembersOnly = (room) => {
  return room.members.filter(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
    return memberId !== ownerId;
  });
};

const getMemberIds = (members) => {
  return members.map(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberId;
  });
};

const getExistingCarryOvers = (members, startDate) => {
  const carryOvers = [];
  for (const member of members) {
    if (member.carryOver > 0) {
      carryOvers.push({
        memberId: member.user._id.toString(),
        neededHours: member.carryOver,
        priority: member.priority || 3,
        week: startDate
      });
    }
  }
  return carryOvers;
};

// from slotUtils.js
const shouldPreserveSlot = (slot) => {
  if (!slot.assignedBy) return true;
  if (slot.confirmedToPersonalCalendar) return true;
  if (slot.subject && (slot.subject.includes('협의') || slot.subject === SLOT_TYPES.AUTO_ASSIGNED)) {
    if (slot.subject.includes('협의')) return true;
    if (slot.subject === SLOT_TYPES.AUTO_ASSIGNED) return false;
  }
  return false;
};

const filterAutoAssignedSlots = (slots) => {
  return slots.filter(slot =>
    slot.assignedBy === 'auto' &&
    slot.subject !== SLOT_TYPES.TRAVEL_TIME &&
    !slot.confirmedToPersonalCalendar
  );
};

const filterNonTravelSlots = (slots) => {
  return slots.filter(slot => slot.subject !== SLOT_TYPES.TRAVEL_TIME);
};

const groupSlotsByUserAndDate = (slots) => {
  const grouped = new Map();

  for (const slot of slots) {
    const userId = slot.user.toString();
    const dateStr = slot.date.toISOString().split('T')[0];
    const key = `${userId}_${dateStr}`;

    if (!grouped.has(key)) {
      grouped.set(key, { user: slot.user, date: slot.date, slots: [] });
    }
    grouped.get(key).slots.push(slot);
  }

  return grouped;
};

const mergeSlotsByDate = (slots) => {
  if (!slots || slots.length === 0) return [];

  slots.sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return aTime - bTime;
  });

  const merged = [];
  let current = { ...slots[0] };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    const currentEnd = new Date(current.endTime);
    const slotStart = new Date(slot.startTime);

    if (currentEnd.getTime() === slotStart.getTime()) {
      current.endTime = slot.endTime;
    } else {
      merged.push(current);
      current = { ...slot };
    }
  }

  merged.push(current);
  return merged;
};

const extractUserId = (userRef) => {
  return userRef._id ? userRef._id.toString() : userRef.toString();
};

const mergeConsecutiveSlots = (slots) => {
  if (slots.length === 0) return [];

  slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const merged = [];
  let current = {
    startTime: slots[0].startTime,
    endTime: slots[0].endTime
  };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];

    if (current.endTime === slot.startTime) {
      current.endTime = slot.endTime;
    } else {
      merged.push(current);
      current = {
        startTime: slot.startTime,
        endTime: slot.endTime
      };
    }
  }

  merged.push(current);

  return merged;
};

module.exports = {
  getRoomWithMembers,
  getRoomById,
  clearTravelModeData,
  removeAutoAssignedSlots,
  updateRoomSettings,
  getMembersOnly,
  getMemberIds,
  getExistingCarryOvers,
  shouldPreserveSlot,
  filterAutoAssignedSlots,
  filterNonTravelSlots,
  groupSlotsByUserAndDate,
  mergeSlotsByDate,
  extractUserId,
  mergeConsecutiveSlots,
};