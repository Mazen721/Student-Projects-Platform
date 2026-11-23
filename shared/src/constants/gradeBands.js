export const GRADE_BANDS = Object.freeze({
  EXCELLENT: 'excellent',
  VERY_GOOD: 'veryGood',
  GOOD: 'good',
  ACCEPTABLE: 'acceptable',
  FAIL: 'fail',
});

export const GRADE_BAND_VALUES = Object.freeze(Object.values(GRADE_BANDS));

export const GRADE_BAND_THRESHOLDS = Object.freeze({
  excellent: 85,
  veryGood: 75,
  good: 65,
});
