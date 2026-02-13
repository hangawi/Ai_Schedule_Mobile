const User = require('../../models/user');
const schedulingAlgorithm = require('../../services/schedulingAlgorithm');
const { addDays } = require('./utils');


/**
 * 자동 스케줄링 실행
 * @param {Array} membersOnly - 조원 목록
 * @param {Object} owner - 방장 객체
 * @param {Array} existingSlots - 기존 슬롯
 * @param {Object} options - 옵션 객체
 * @param {Array} carryOvers - 이월 정보
 * @returns {Promise<Object>} 스케줄링 결과
 */
const runAutoScheduling = async (membersOnly, owner, existingSlots, options, carryOvers) => {
  return await schedulingAlgorithm.runAutoSchedule(
    membersOnly,
    owner,
    existingSlots,
    options,
    carryOvers
  );
};



/**
 * 스케줄링 결과 처리
 * @param {Object} room - 방 객체
 * @param {Object} result - 스케줄링 결과
 */
const applySchedulingResult = (room, result) => {
  // 새로운 슬롯 추가
  room.timeSlots.push(...result.newSlots);

  // 멤버 업데이트
  for (const member of room.members) {
    const memberId = member.user._id ? member.user._id.toString() : member.user.toString();
    const updatedMember = result.updatedMembers.find(m => m.memberId.toString() === memberId);

    if (updatedMember) {
      member.carryOver = updatedMember.carryOver;
      member.priority = updatedMember.priority;

      if (!member.carryOverHistory) {
        member.carryOverHistory = [];
      }

      if (updatedMember.carryOver > 0) {
        member.carryOverHistory.push({
          week: result.currentWeek || new Date(),
          amount: updatedMember.carryOver
        });
      }
    }
  }
};

module.exports = {
  runAutoScheduling,
  applySchedulingResult,
};