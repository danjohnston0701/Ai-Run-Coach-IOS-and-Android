/**
 * Fitness & Freshness Calculation Service
 * 
 * Implements Training Stress Score (TSS), Chronic Training Load (CTL),
 * Acute Training Load (ATL), and Training Stress Balance (TSB) calculations.
 * 
 * Based on TrainingPeaks methodology and sports science research.
 */

import { db } from "./db";
import { runs, dailyFitness } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// ==================== TSS CALCULATION ====================

/**
 * Calculate Training Stress Score for a run
 * 
 * TSS = (Duration in seconds × Normalized Power × Intensity Factor) ÷ (FTP × 3600) × 100
 * 
 * For running (without power meter):
 * TSS ≈ (Duration in hours × 100) × (HR_intensity)²
 * where HR_intensity = (avgHR - restingHR) / (maxHR - restingHR)
 * 
 * Simplified formula when HR not available:
 * TSS = (Duration in minutes × 0.67) for easy runs
 * TSS = (Duration in minutes × 1.0) for moderate runs
 * TSS = (Duration in minutes × 1.5) for hard runs
 */
export function calculateTSS(
  durationSeconds: number,
  avgHeartRate?: number,
  maxHeartRate?: number,
  restingHeartRate: number = 60, // Default resting HR
  difficulty?: string
): number {
  const durationMinutes = durationSeconds / 60;
  const durationHours = durationSeconds / 3600;

  // Method 1: Heart rate-based (most accurate)
  if (avgHeartRate && maxHeartRate) {
    const hrIntensity = (avgHeartRate - restingHeartRate) / (maxHeartRate - restingHeartRate);
    const tss = durationHours * 100 * Math.pow(hrIntensity, 2);
    return Math.round(Math.max(0, Math.min(tss, 500))); // Cap at 500
  }

  // Method 2: Difficulty-based estimate
  const intensityFactors: Record<string, number> = {
    easy: 0.67,
    moderate: 1.0,
    hard: 1.5,
    extreme: 2.0,
  };

  const factor = difficulty ? intensityFactors[difficulty.toLowerCase()] || 1.0 : 1.0;
  const tss = durationMinutes * factor;

  return Math.round(Math.max(0, Math.min(tss, 500))); // Cap at 500
}

// ==================== FITNESS & FRESHNESS CALCULATION ====================

/**
 * Calculate CTL (Chronic Training Load) - Fitness
 * 
 * CTL is a 42-day exponentially weighted moving average of daily TSS
 * CTL_today = CTL_yesterday + (TSS_today - CTL_yesterday) / 42
 */
function calculateCTL(previousCTL: number, todayTSS: number): number {
  const timeConstant = 42; // days
  return previousCTL + (todayTSS - previousCTL) / timeConstant;
}

/**
 * Calculate ATL (Acute Training Load) - Fatigue
 * 
 * ATL is a 7-day exponentially weighted moving average of daily TSS
 * ATL_today = ATL_yesterday + (TSS_today - ATL_yesterday) / 7
 */
function calculateATL(previousATL: number, todayTSS: number): number {
  const timeConstant = 7; // days
  return previousATL + (todayTSS - previousATL) / timeConstant;
}

/**
 * Calculate TSB (Training Stress Balance) - Form
 * 
 * TSB = CTL_yesterday - ATL_today
 * 
 * Interpretation:
 * TSB > +25: Very fresh, possibly detraining
 * TSB +10 to +25: Fresh, good for race
 * TSB -10 to +10: Neutral, maintaining
 * TSB -30 to -10: Overreaching (productive stress)
 * TSB < -30: High risk of overtraining
 */
function calculateTSB(ctl: number, atl: number): number {
  return ctl - atl;
}

/**
 * Determine training status based on TSB
 */
function getTrainingStatus(tsb: number): string {
  if (tsb > 25) return "detraining";
  if (tsb > 10) return "optimal";
  if (tsb > -10) return "maintaining";
  if (tsb > -30) return "productive";
  return "overtrained";
}

/**
 * Calculate ramp rate (weekly CTL change)
 * Recommendation: 5-8 TSS/week increase is safe
 */
function calculateRampRate(currentCTL: number, ctlSevenDaysAgo: number): number {
  return currentCTL - ctlSevenDaysAgo;
}

/**
 * Assess injury risk based on ramp rate and TSB
 */
function getInjuryRisk(rampRate: number, tsb: number): string {
  // High risk if:
  // - Ramping up too fast (>8 TSS/week)
  // - TSB is very negative (<-30)
  if (rampRate > 8 || tsb < -30) return "high";
  
  // Moderate risk if:
  // - Ramping moderately fast (5-8 TSS/week)
  // - TSB is negative (-30 to -10)
  if (rampRate > 5 || (tsb < -10 && tsb >= -30)) return "moderate";
  
  return "low";
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Update fitness metrics for a specific date
 */
export async function updateDailyFitness(
  userId: string,
  date: string, // YYYY-MM-DD
  tss: number
): Promise<void> {
  try {
    // Get yesterday's metrics
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayMetrics = await db
      .select()
      .from(dailyFitness)
      .where(
        and(
          eq(dailyFitness.userId, userId),
          eq(dailyFitness.date, yesterdayStr)
        )
      )
      .limit(1);

    const previousCTL = yesterdayMetrics[0]?.ctl || 0;
    const previousATL = yesterdayMetrics[0]?.atl || 0;

    // Calculate today's metrics
    const newCTL = calculateCTL(previousCTL, tss);
    const newATL = calculateATL(previousATL, tss);
    const newTSB = calculateTSB(newCTL, newATL);

    // Get CTL from 7 days ago for ramp rate
    const sevenDaysAgo = new Date(date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const sevenDaysAgoMetrics = await db
      .select()
      .from(dailyFitness)
      .where(
        and(
          eq(dailyFitness.userId, userId),
          eq(dailyFitness.date, sevenDaysAgoStr)
        )
      )
      .limit(1);

    const ctlSevenDaysAgo = sevenDaysAgoMetrics[0]?.ctl || 0;
    const rampRate = calculateRampRate(newCTL, ctlSevenDaysAgo);
    const status = getTrainingStatus(newTSB);
    const injuryRisk = getInjuryRisk(rampRate, newTSB);

    // Upsert daily fitness record
    await db
      .insert(dailyFitness)
      .values({
        userId,
        date,
        ctl: newCTL,
        atl: newATL,
        tsb: newTSB,
        trainingLoad: tss,
        status,
        rampRate,
        injuryRisk,
      })
      .onConflictDoUpdate({
        target: [dailyFitness.userId, dailyFitness.date],
        set: {
          ctl: newCTL,
          atl: newATL,
          tsb: newTSB,
          trainingLoad: tss,
          status,
          rampRate,
          injuryRisk,
        },
      });

    console.log(`✅ Updated fitness metrics for ${userId} on ${date}`);
  } catch (error) {
    console.error("❌ Error updating daily fitness:", error);
    throw error;
  }
}

/**
 * Recalculate all historical fitness metrics for a user
 * Use this when backfilling data or after adding new runs
 */
export async function recalculateHistoricalFitness(userId: string): Promise<void> {
  try {
    console.log(`🔄 Recalculating historical fitness for user ${userId}...`);

    // Get all runs for this user, ordered by date
    const userRuns = await db
      .select({
        id: runs.id,
        completedAt: runs.completedAt,
        tss: runs.tss,
        duration: runs.duration,
        avgHeartRate: runs.avgHeartRate,
        maxHeartRate: runs.maxHeartRate,
        difficulty: runs.difficulty,
      })
      .from(runs)
      .where(eq(runs.userId, userId))
      .orderBy(runs.completedAt);

    if (userRuns.length === 0) {
      console.log(`No runs found for user ${userId}`);
      return;
    }

    // Group runs by date and calculate/update TSS if needed
    const runsByDate: Map<string, { tss: number; runs: typeof userRuns }> = new Map();

    for (const run of userRuns) {
      const date = run.completedAt!.toISOString().split('T')[0];
      
      // Calculate TSS if not already set
      let tss = run.tss || 0;
      if (tss === 0) {
        tss = calculateTSS(
          run.duration,
          run.avgHeartRate || undefined,
          run.maxHeartRate || undefined,
          60,
          run.difficulty || undefined
        );
        
        // Update run with calculated TSS
        await db
          .update(runs)
          .set({ tss })
          .where(eq(runs.id, run.id));
      }

      if (!runsByDate.has(date)) {
        runsByDate.set(date, { tss: 0, runs: [] });
      }
      
      const dayData = runsByDate.get(date)!;
      dayData.tss += tss;
      dayData.runs.push(run);
    }

    // Calculate fitness metrics for each day
    const dates = Array.from(runsByDate.keys()).sort();
    
    for (const date of dates) {
      const dayData = runsByDate.get(date)!;
      await updateDailyFitness(userId, date, dayData.tss);
    }

    console.log(`✅ Historical fitness recalculated for ${userId} (${dates.length} days)`);
  } catch (error) {
    console.error("❌ Error recalculating historical fitness:", error);
    throw error;
  }
}

/**
 * Get fitness trend for a date range
 */
export async function getFitnessTrend(
  userId: string,
  startDate: string,
  endDate: string
) {
  return await db
    .select()
    .from(dailyFitness)
    .where(
      and(
        eq(dailyFitness.userId, userId),
        gte(dailyFitness.date, startDate),
        lte(dailyFitness.date, endDate)
      )
    )
    .orderBy(dailyFitness.date);
}

/**
 * Get current fitness status
 */
export async function getCurrentFitness(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const current = await db
    .select()
    .from(dailyFitness)
    .where(eq(dailyFitness.userId, userId))
    .orderBy(desc(dailyFitness.date))
    .limit(1);

  return current[0] || null;
}

/**
 * Get AI recommendations based on fitness status
 */
export function getFitnessRecommendations(
  ctl: number,
  atl: number,
  tsb: number,
  status: string,
  injuryRisk: string
): string[] {
  const recommendations: string[] = [];

  switch (status) {
    case "overtrained":
      recommendations.push("⚠️ High fatigue detected. Take 2-3 rest days.");
      recommendations.push("Focus on recovery: sleep, nutrition, hydration.");
      recommendations.push("Consider easy 20-30min recovery runs only.");
      break;

    case "productive":
      recommendations.push("💪 You're in a productive training phase!");
      recommendations.push("Maintain current training load for adaptation.");
      recommendations.push("Schedule a recovery week after 3-4 weeks.");
      break;

    case "maintaining":
      recommendations.push("✅ Well-balanced training load.");
      recommendations.push("Good time to add intensity or volume.");
      recommendations.push("Consider a hard workout this week.");
      break;

    case "optimal":
      recommendations.push("🏆 Perfect fitness for racing!");
      recommendations.push("Taper maintained - ready to perform.");
      recommendations.push("Keep workouts short and sharp.");
      break;

    case "detraining":
      recommendations.push("⚠️ Fitness declining - increase training volume.");
      recommendations.push("Add 1-2 more runs per week.");
      recommendations.push("Gradually ramp up distance by 10% per week.");
      break;
  }

  // Injury risk warnings
  if (injuryRisk === "high") {
    recommendations.push("🚨 HIGH INJURY RISK: Reduce volume by 20-30%.");
  } else if (injuryRisk === "moderate") {
    recommendations.push("⚠️ Moderate injury risk: Monitor for pain/fatigue.");
  }

  return recommendations;
}
