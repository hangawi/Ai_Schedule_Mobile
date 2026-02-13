const User = require('../../models/user');
const { addDays } = require('./utils');

/**
 * 장기 이월 멤버 확인
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @returns {Promise<Array>} 충돌 제안 배열
 */
const checkLongTermCarryOvers = async (members, startDate) => {
  const twoWeeksAgo = addDays(startDate, -14);
  const oneWeekAgo = addDays(startDate, -7);
  const suggestions = [];

  for (const member of members) {
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
        suggestions.push({
          title: '장기 이월 멤버 발생',
          content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
        });
      }
    }
  }

  return suggestions;
};

/**
 * 이월 정보 가져오기
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @returns {Array} 이월 정보 배열
 */
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

module.exports = {
  checkLongTermCarryOvers,
  getExistingCarryOvers,
};
