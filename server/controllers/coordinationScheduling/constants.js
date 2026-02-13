// 에러 메시지 상수
const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  OWNER_ONLY: '방장만 이 기능을 사용할 수 있습니다.',
  OWNER_NO_SCHEDULE: (ownerName) => `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`,
  MEMBERS_NO_SCHEDULE: (memberNames) => `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${memberNames}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`,
  INVALID_HOURS_PER_WEEK: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.',
  ALREADY_CONFIRMED: '이미 확정된 스케줄입니다',
  INVALID_TRAVEL_MODE: '유효하지 않은 이동 모드입니다.',
  NO_SCHEDULE_DATA: '스케줄 데이터가 없습니다.',
  TIMER_NOT_RUNNING: '확정 타이머가 실행 중이 아닙니다.',
  INVALID_DURATION: '유효하지 않은 기간입니다. 1-168 사이의 값을 입력하세요.',
};

// HTTP 상태 코드
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

// 검증 규칙 상수
const VALIDATION_RULES = {
  // 시간 관련
  MIN_HOURS_PER_WEEK: 0.167,  // 10분
  MAX_HOURS_PER_WEEK: 10,
  DEFAULT_MIN_HOURS_PER_WEEK: 3,
  DEFAULT_NUM_WEEKS: 4,
  DEFAULT_MIN_CLASS_DURATION_MINUTES: 60,

  // 자동 확정 기간
  MIN_AUTO_CONFIRM_DURATION: 1,
  MAX_AUTO_CONFIRM_DURATION: 168,  // 1주일

  // 재시도 설정
  MAX_RETRIES: 3,
  MAX_USER_SAVE_RETRIES: 5,
};

// 기본값
const DEFAULTS = {
  MIN_HOURS_PER_WEEK: 3,
  NUM_WEEKS: 4,
  TRANSPORT_MODE: 'normal',
  MIN_CLASS_DURATION_MINUTES: 60,
  ASSIGNMENT_MODE: 'normal',
  AUTO_CONFIRM_DURATION_HOURS: 5, // 자동 확정 기본 시간 (5시간)
};

// 이동 모드 관련 상수
const TRAVEL_MODES = {
  NORMAL: 'normal',
  TRANSIT: 'transit',
  WALKING: 'walking',
  DRIVING: 'driving',
};

// 배정 모드
const ASSIGNMENT_MODES = {
  NORMAL: 'normal',
  FIRST_COME_FIRST_SERVED: 'first_come_first_served',
  FROM_TODAY: 'from_today',
};

const VALID_ASSIGNMENT_MODES = [
  ASSIGNMENT_MODES.NORMAL,
  ASSIGNMENT_MODES.FIRST_COME_FIRST_SERVED,
  ASSIGNMENT_MODES.FROM_TODAY,
];

// 슬롯 타입
const SLOT_TYPES = {
  AUTO_ASSIGNED: '자동 배정',
  NEGOTIATED: '협의',
  TRAVEL_TIME: 'TRAVEL_TIME',
};

module.exports = {
  ERROR_MESSAGES,
  HTTP_STATUS,
  VALIDATION_RULES,
  DEFAULTS,
  TRAVEL_MODES,
  ASSIGNMENT_MODES,
  VALID_ASSIGNMENT_MODES,
  SLOT_TYPES,
};