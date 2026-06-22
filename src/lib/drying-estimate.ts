export interface MoisturePoint {
  timestamp: number;
  moisture: number;
}

export interface DryingEstimate {
  peakMoisture: number;
  peakTimestamp: number;
  currentMoisture: number;
  estimatedElapsedMinutes: number;
  ratePerHour: number;
  etaMinutes: number | null;
  completionTimestamp: number | null;
  dataPointCount: number;
  rSquared: number;
}

const MIN_POINTS = 3;
const MAX_RECENT_POINTS = 10;
const MAX_ETA_HOURS = 48;

export function calculateDryingEstimate(
  points: MoisturePoint[],
  targetMoisture: number
): DryingEstimate | null {
  if (points.length < MIN_POINTS) return null;

  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].moisture > points[peakIdx].moisture) {
      peakIdx = i;
    }
  }

  const peak = points[peakIdx];
  const current = points[points.length - 1];

  if (current.moisture >= peak.moisture) return null;

  const descending = points.slice(peakIdx);
  const recent = descending.slice(-MAX_RECENT_POINTS);

  if (recent.length < MIN_POINTS) return null;

  const reg = weightedLinearRegression(recent);
  if (!reg) return null;

  const ratePerHour = reg.slope * 60;
  const elapsedMinutes = Math.round(
    (current.timestamp - peak.timestamp) / 60_000
  );

  let etaMinutes: number | null = null;
  let completionTimestamp: number | null = null;

  if (reg.slope < -0.001 && current.moisture > targetMoisture) {
    const remaining = current.moisture - targetMoisture;
    const rawEta = remaining / Math.abs(reg.slope);
    if (rawEta <= MAX_ETA_HOURS * 60) {
      etaMinutes = Math.round(rawEta);
      completionTimestamp = current.timestamp + rawEta * 60_000;
    }
  }

  return {
    peakMoisture: peak.moisture,
    peakTimestamp: peak.timestamp,
    currentMoisture: current.moisture,
    estimatedElapsedMinutes: elapsedMinutes,
    ratePerHour: Math.round(ratePerHour * 100) / 100,
    etaMinutes,
    completionTimestamp,
    dataPointCount: recent.length,
    rSquared: reg.rSquared,
  };
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

function weightedLinearRegression(
  points: MoisturePoint[]
): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;

  const t0 = points[0].timestamp;
  const maxIdx = Math.max(n - 1, 1);

  let sw = 0;
  let swt = 0;
  let swm = 0;
  let swtt = 0;
  let swtm = 0;

  for (let i = 0; i < n; i++) {
    const t = (points[i].timestamp - t0) / 60_000;
    const m = points[i].moisture;
    const w = Math.exp(0.3 * (i / maxIdx));

    sw += w;
    swt += w * t;
    swm += w * m;
    swtt += w * t * t;
    swtm += w * t * m;
  }

  const denom = sw * swtt - swt * swt;
  if (Math.abs(denom) < 1e-10) return null;

  const slope = (sw * swtm - swt * swm) / denom;
  const intercept = (swm * swtt - swt * swtm) / denom;

  const meanM = swm / sw;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const t = (points[i].timestamp - t0) / 60_000;
    const m = points[i].moisture;
    const w = Math.exp(0.3 * (i / maxIdx));
    const predicted = slope * t + intercept;
    ssTot += w * (m - meanM) ** 2;
    ssRes += w * (m - predicted) ** 2;
  }

  const rSquared = ssTot > 1e-10 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { slope, intercept, rSquared };
}
