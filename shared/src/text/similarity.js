import { normalizeArabic } from './normalizeArabic.js';

function buildTrigrams(text) {
  if (!text) return new Set();
  if (text.length < 3) return new Set([text]);
  const padded = ` ${text} `;
  const grams = new Set();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

export function trigramSimilarity(first, second) {
  const a = normalizeArabic(first);
  const b = normalizeArabic(second);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const setA = buildTrigrams(a);
  const setB = buildTrigrams(b);
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
