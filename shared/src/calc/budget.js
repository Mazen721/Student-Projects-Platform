/**
 * Pure BOM budget calculator (`FR-055`).
 * Boundary cases: empty list -> 0, fractional unitPrice * quantity rounding.
 */
export function computeBudget(bomItems = []) {
  if (!Array.isArray(bomItems) || bomItems.length === 0) {
    return 0;
  }
  const total = bomItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
