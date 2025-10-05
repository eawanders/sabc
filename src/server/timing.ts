export function startTiming() {
  return Date.now();
}

export function createServerTiming(start: number, label = 'app') {
  const duration = Math.max(0, Date.now() - start);
  return `${label};dur=${duration.toFixed(1)}`;
}
