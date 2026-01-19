export type CoachingPhase = 'early' | 'mid' | 'late' | 'final' | 'generic';
export type CoachingCategory = 'form' | 'motivation' | 'breathing' | 'pacing' | 'mental';

export interface CoachingStatement {
  id: string;
  text: string;
  category: CoachingCategory;
  phase: CoachingPhase;
}

export const DEFAULT_PHASE_THRESHOLDS = {
  early: { maxKm: 2, maxPercent: 10 },
  mid: { minKm: 3, maxKm: 5, minPercent: 40, maxPercent: 50 },
  late: { minKm: 7, minPercent: 75, maxPercent: 90 },
  final: { minPercent: 90 },
};

export const MAX_STATEMENT_USES = 3;

export const COACHING_STATEMENTS: CoachingStatement[] = [
  // EARLY PHASE (First 2km or first 10%)
  { id: 'early_1', text: "Keep your posture tall and proud, imagine a string gently lifting the top of your head.", category: 'form', phase: 'early' },
  { id: 'early_2', text: "Settle into a steady, rhythmic breathing pattern that feels sustainable.", category: 'breathing', phase: 'early' },
  { id: 'early_3', text: "Start easy and let your body warm up naturally. The best runs build momentum.", category: 'pacing', phase: 'early' },
  { id: 'early_4', text: "Relax your shoulders and let them drop away from your ears.", category: 'form', phase: 'early' },
  { id: 'early_5', text: "Find your rhythm. These first kilometers are about settling into a sustainable pace.", category: 'pacing', phase: 'early' },
  { id: 'early_6', text: "Keep your hands soft, stretch your fingers and release the tension.", category: 'form', phase: 'early' },
  { id: 'early_7', text: "Great start! Focus on smooth, relaxed movements as you warm up.", category: 'motivation', phase: 'early' },
  { id: 'early_8', text: "Keep your eyes on the horizon, not your feet.", category: 'form', phase: 'early' },

  // MID PHASE (3-5km or 40-50%)
  { id: 'mid_1', text: "Lightly engage your core to keep your torso stable as your legs and arms move.", category: 'form', phase: 'mid' },
  { id: 'mid_2', text: "You're in the groove now. Stay relaxed and maintain your rhythm.", category: 'motivation', phase: 'mid' },
  { id: 'mid_3', text: "Think quick and elastic, lifting the foot up and through instead of pushing long and hard.", category: 'form', phase: 'mid' },
  { id: 'mid_4', text: "Keep your arms relaxed and swinging naturally with your stride.", category: 'form', phase: 'mid' },
  { id: 'mid_5', text: "Let your foot land roughly under your body instead of reaching out in front.", category: 'form', phase: 'mid' },
  { id: 'mid_6', text: "Run with quiet confidence. Efficient, relaxed form is your biggest advantage today.", category: 'mental', phase: 'mid' },
  { id: 'mid_7', text: "You're building a strong foundation. This is where consistency pays off.", category: 'motivation', phase: 'mid' },
  { id: 'mid_8', text: "Check in with your breathing. Keep it controlled and rhythmic.", category: 'breathing', phase: 'mid' },

  // LATE PHASE (7km+ or 75-90%)
  { id: 'late_1', text: "Stay tall through your hips, avoid collapsing or bending at the waist as you tire.", category: 'form', phase: 'late' },
  { id: 'late_2', text: "If you're starting to tire, take a deep breath and reset your rhythm.", category: 'breathing', phase: 'late' },
  { id: 'late_3', text: "Pain fades, pride lasts. Push through this stretch and keep your head up.", category: 'motivation', phase: 'late' },
  { id: 'late_4', text: "Your body is capable of more than your mind believes. Trust your training.", category: 'mental', phase: 'late' },
  { id: 'late_5', text: "You've come this far. Maintain your form and keep moving forward.", category: 'motivation', phase: 'late' },
  { id: 'late_6', text: "When it gets tough, focus on the next 100 meters, not the whole distance.", category: 'mental', phase: 'late' },
  { id: 'late_7', text: "This is where champions are made. Embrace the challenge.", category: 'motivation', phase: 'late' },
  { id: 'late_8', text: "Relax your face and jaw. Tension there wastes precious energy.", category: 'form', phase: 'late' },

  // FINAL PHASE (Last 10%)
  { id: 'final_1', text: "You're almost there! Give it everything you have left.", category: 'motivation', phase: 'final' },
  { id: 'final_2', text: "The finish line is calling. Dig deep and finish strong!", category: 'motivation', phase: 'final' },
  { id: 'final_3', text: "Last push! Every step now is a step closer to victory.", category: 'motivation', phase: 'final' },
  { id: 'final_4', text: "Empty the tank. Leave nothing behind on this final stretch.", category: 'motivation', phase: 'final' },
  { id: 'final_5', text: "You've earned this finish. Sprint home if you can!", category: 'motivation', phase: 'final' },
  { id: 'final_6', text: "The end is in sight. This is your moment to shine!", category: 'motivation', phase: 'final' },

  // GENERIC (Any time)
  { id: 'generic_1', text: "Remember to smile! It helps you relax and enjoy the run.", category: 'mental', phase: 'generic' },
  { id: 'generic_2', text: "You're stronger with every stride. Stay smooth, stay strong.", category: 'motivation', phase: 'generic' },
  { id: 'generic_3', text: "Focus on form. Tall posture, light feet, and controlled breathing.", category: 'form', phase: 'generic' },
  { id: 'generic_4', text: "Your body can do this. Trust it and let your mind follow.", category: 'mental', phase: 'generic' },
  { id: 'generic_5', text: "One step at a time. That's how every great journey is conquered.", category: 'motivation', phase: 'generic' },
  { id: 'generic_6', text: "Every run is a story of progress. Focus on your purpose.", category: 'motivation', phase: 'generic' },
  { id: 'generic_7', text: "It's not about being the fastest, it's about little improvements every session.", category: 'mental', phase: 'generic' },
  { id: 'generic_8', text: "Remember why you started. Keep going, you're making progress.", category: 'motivation', phase: 'generic' },
  { id: 'generic_9', text: "Breathe deep and reset. The next kilometer is yours to own.", category: 'breathing', phase: 'generic' },
  { id: 'generic_10', text: "Your body is capable of amazing things. Trust the process and keep moving forward.", category: 'motivation', phase: 'generic' },
];

export interface StatementUsage {
  [statementId: string]: number;
}

export function determinePhase(
  distanceKm: number,
  totalDistanceKm: number | null
): CoachingPhase {
  const percentComplete = totalDistanceKm && totalDistanceKm > 0
    ? (distanceKm / totalDistanceKm) * 100
    : null;

  if (percentComplete !== null) {
    if (percentComplete >= 90) return 'final';
    if (percentComplete >= 75) return 'late';
    if (percentComplete >= 40 && percentComplete <= 50) return 'mid';
    if (percentComplete <= 10) return 'early';
    return 'generic';
  }

  if (distanceKm <= 2) return 'early';
  if (distanceKm >= 3 && distanceKm <= 5) return 'mid';
  return 'generic';
}

export function getAvailableStatements(
  currentPhase: CoachingPhase,
  usageCounts: StatementUsage
): CoachingStatement[] {
  return COACHING_STATEMENTS.filter(statement => {
    const phaseMatch = statement.phase === currentPhase || statement.phase === 'generic';
    const usageCount = usageCounts[statement.id] || 0;
    const withinLimit = usageCount < MAX_STATEMENT_USES;
    return phaseMatch && withinLimit;
  });
}

export function selectStatement(
  currentPhase: CoachingPhase,
  usageCounts: StatementUsage,
  preferPhaseSpecific: boolean = true
): CoachingStatement | null {
  const available = getAvailableStatements(currentPhase, usageCounts);

  if (available.length === 0) return null;

  if (preferPhaseSpecific) {
    const phaseSpecific = available.filter(s => s.phase === currentPhase);
    if (phaseSpecific.length > 0) {
      return phaseSpecific[Math.floor(Math.random() * phaseSpecific.length)];
    }
  }

  return available[Math.floor(Math.random() * available.length)];
}

export function recordStatementUsage(usageCounts: StatementUsage, statementId: string): void {
  usageCounts[statementId] = (usageCounts[statementId] || 0) + 1;
}

export function shouldTriggerCoaching(
  lastCoachingDistanceKm: number,
  currentDistanceKm: number,
  lastCoachingTime: number,
  currentTime: number,
  minIntervalSeconds: number = 120
): boolean {
  const timeSinceLastCoaching = (currentTime - lastCoachingTime) / 1000;
  const kmCrossed = Math.floor(currentDistanceKm) > Math.floor(lastCoachingDistanceKm);
  const intervalMet = timeSinceLastCoaching >= minIntervalSeconds;

  return kmCrossed && intervalMet;
}

export const COACHING_PHASE_PROMPT = `COACHING PHASE RULES - CRITICAL:
You must ONLY use coaching statements appropriate for the runner's current phase:

1. EARLY PHASE (first 2km OR first 10% of run):
   - Focus on: warm-up, settling into rhythm, relaxed form
   - Topics: posture basics, breathing pattern establishment, easy pacing
   - Avoid: fatigue-related advice, pushing through pain, finishing strong messages

2. MID PHASE (3-5km OR 40-50% of run):
   - Focus on: maintaining form, staying in the groove, rhythm
   - Topics: core engagement, arm swing, foot strike, confidence
   - Avoid: warm-up advice, final sprint encouragement

3. LATE PHASE (7km+ OR 75-90% of run):
   - Focus on: mental strength, managing fatigue, maintaining form under tiredness
   - Topics: resetting when tired, embracing challenge, breaking distance into chunks
   - This is the ONLY phase where fatigue-related advice is appropriate

4. FINAL PHASE (last 10% of run):
   - Focus on: finishing strong, celebration, final push
   - Topics: sprint to finish, leaving nothing behind, victory lap
   - Maximum motivation and energy

5. GENERIC (any time):
   - Timeless advice: smiling, trust in training, purpose reminders
   - Use sparingly to supplement phase-specific content

REPETITION RULE: Do not use the same statement more than 3 times during a single run.`;
