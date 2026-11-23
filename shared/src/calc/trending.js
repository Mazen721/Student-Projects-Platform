export function computeTrending({ votes7d, views7d } = {}) {
  return Number(votes7d || 0) * 3 + Number(views7d || 0);
}
