export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface HeartRateZoneInfo {
  zone: HeartRateZone;
  name: string;
  color: string;
  minPercent: number;
  maxPercent: number;
  description: string;
}

export interface HeartRateReading {
  bpm: number;
  timestamp: number;
  source: 'garmin' | 'samsung' | 'apple' | 'manual' | 'simulated';
  confidence?: number;
}

export interface HeartRateZoneSummary {
  zone1Minutes: number;
  zone2Minutes: number;
  zone3Minutes: number;
  zone4Minutes: number;
  zone5Minutes: number;
}

export const HEART_RATE_ZONES: HeartRateZoneInfo[] = [
  { zone: 1, name: 'Recovery', color: '#3B82F6', minPercent: 0, maxPercent: 60, description: 'Light effort, easy breathing' },
  { zone: 2, name: 'Fat Burn', color: '#22C55E', minPercent: 60, maxPercent: 70, description: 'Comfortable pace, can hold conversation' },
  { zone: 3, name: 'Aerobic', color: '#EAB308', minPercent: 70, maxPercent: 80, description: 'Moderate effort, slightly breathless' },
  { zone: 4, name: 'Threshold', color: '#F97316', minPercent: 80, maxPercent: 90, description: 'Hard effort, difficult to talk' },
  { zone: 5, name: 'Max Effort', color: '#EF4444', minPercent: 90, maxPercent: 100, description: 'Maximum effort, unsustainable' },
];

export function calculateMaxHeartRate(age: number): number {
  return Math.round(220 - age);
}

export function getAgeFromDob(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getHeartRateZone(bpm: number, maxHR: number): HeartRateZoneInfo {
  const percent = (bpm / maxHR) * 100;
  
  if (percent < 60) return HEART_RATE_ZONES[0];
  if (percent < 70) return HEART_RATE_ZONES[1];
  if (percent < 80) return HEART_RATE_ZONES[2];
  if (percent < 90) return HEART_RATE_ZONES[3];
  return HEART_RATE_ZONES[4];
}

export function getHeartRatePercent(bpm: number, maxHR: number): number {
  return Math.min(100, Math.round((bpm / maxHR) * 100));
}

export function calculateAverageHeartRate(readings: HeartRateReading[]): number {
  if (readings.length === 0) return 0;
  const sum = readings.reduce((acc, r) => acc + r.bpm, 0);
  return Math.round(sum / readings.length);
}

export function getHeartRateTrend(readings: HeartRateReading[], windowMs: number = 60000): 'rising' | 'stable' | 'falling' {
  if (readings.length < 3) return 'stable';
  
  const now = Date.now();
  const recentReadings = readings.filter(r => now - r.timestamp < windowMs);
  
  if (recentReadings.length < 2) return 'stable';
  
  const firstHalf = recentReadings.slice(0, Math.floor(recentReadings.length / 2));
  const secondHalf = recentReadings.slice(Math.floor(recentReadings.length / 2));
  
  const firstAvg = calculateAverageHeartRate(firstHalf);
  const secondAvg = calculateAverageHeartRate(secondHalf);
  
  const diff = secondAvg - firstAvg;
  
  if (diff > 5) return 'rising';
  if (diff < -5) return 'falling';
  return 'stable';
}

export function calculateZoneSummary(readings: HeartRateReading[], maxHR: number): HeartRateZoneSummary {
  const summary: HeartRateZoneSummary = {
    zone1Minutes: 0,
    zone2Minutes: 0,
    zone3Minutes: 0,
    zone4Minutes: 0,
    zone5Minutes: 0,
  };
  
  if (readings.length < 2) return summary;
  
  for (let i = 1; i < readings.length; i++) {
    const reading = readings[i];
    const prevReading = readings[i - 1];
    const durationMinutes = (reading.timestamp - prevReading.timestamp) / 60000;
    
    const zone = getHeartRateZone(reading.bpm, maxHR);
    
    switch (zone.zone) {
      case 1: summary.zone1Minutes += durationMinutes; break;
      case 2: summary.zone2Minutes += durationMinutes; break;
      case 3: summary.zone3Minutes += durationMinutes; break;
      case 4: summary.zone4Minutes += durationMinutes; break;
      case 5: summary.zone5Minutes += durationMinutes; break;
    }
  }
  
  summary.zone1Minutes = Math.round(summary.zone1Minutes * 10) / 10;
  summary.zone2Minutes = Math.round(summary.zone2Minutes * 10) / 10;
  summary.zone3Minutes = Math.round(summary.zone3Minutes * 10) / 10;
  summary.zone4Minutes = Math.round(summary.zone4Minutes * 10) / 10;
  summary.zone5Minutes = Math.round(summary.zone5Minutes * 10) / 10;
  
  return summary;
}

export function getZoneColor(zone: HeartRateZone): string {
  return HEART_RATE_ZONES[zone - 1].color;
}

export function formatHeartRateForCoaching(
  currentHR: number | null,
  maxHR: number,
  avgHR: number | null,
  trend: 'rising' | 'stable' | 'falling'
): string {
  if (!currentHR) return '';
  
  const zone = getHeartRateZone(currentHR, maxHR);
  const percent = getHeartRatePercent(currentHR, maxHR);
  
  let prompt = `\nHEART RATE DATA:\n`;
  prompt += `- Current: ${currentHR} bpm (Zone ${zone.zone}: ${zone.name}, ${percent}% of max)\n`;
  
  if (avgHR) {
    prompt += `- Average this segment: ${avgHR} bpm\n`;
  }
  
  prompt += `- Trend: ${trend}\n\n`;
  prompt += `Heart rate coaching guidance:\n`;
  prompt += `- Zone 1-2: Runner is comfortable, can push harder if desired\n`;
  prompt += `- Zone 3: Good aerobic effort, sustainable pace\n`;
  prompt += `- Zone 4: Working hard, may need encouragement or form reminders\n`;
  prompt += `- Zone 5: Maximum effort, only appropriate for sprints or final push\n`;
  
  return prompt;
}
