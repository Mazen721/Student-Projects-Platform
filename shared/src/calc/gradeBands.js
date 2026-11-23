import { DEFAULT_PASS_MARK, GRADE_BANDS, GRADE_BAND_THRESHOLDS } from '../constants/index.js';
import ar from '../locales/ar.js';

/**
 * Maps a numeric grade (0..100) to its Arabic grade band and pass/fail status (`FR-090`).
 * Evaluates passMark before band thresholds so higher college pass marks never misclassify a fail.
 */
export function gradeBand(score, passMark = DEFAULT_PASS_MARK) {
  const numeric = Number(score || 0);
  const threshold = Number(passMark ?? DEFAULT_PASS_MARK);

  if (numeric < threshold) {
    return { band: GRADE_BANDS.FAIL, label: ar.gradeBands.fail, passed: false };
  }
  if (numeric >= GRADE_BAND_THRESHOLDS.excellent) {
    return { band: GRADE_BANDS.EXCELLENT, label: ar.gradeBands.excellent, passed: true };
  }
  if (numeric >= GRADE_BAND_THRESHOLDS.veryGood) {
    return { band: GRADE_BANDS.VERY_GOOD, label: ar.gradeBands.veryGood, passed: true };
  }
  if (numeric >= GRADE_BAND_THRESHOLDS.good) {
    return { band: GRADE_BANDS.GOOD, label: ar.gradeBands.good, passed: true };
  }
  return { band: GRADE_BANDS.ACCEPTABLE, label: ar.gradeBands.acceptable, passed: true };
}
