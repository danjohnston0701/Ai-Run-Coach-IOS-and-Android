/**
 * Training Plan AI Generator Service
 * 
 * Generates personalized training plans using OpenAI GPT-4.
 * Plans are tailored to user's fitness level, goals, and current training load.
 */

import { db } from "./db";
import { trainingPlans, weeklyPlans, plannedWorkouts, users, runs, goals } from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { getCurrentFitness } from "./fitness-service";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==================== TRAINING PLAN TEMPLATES ====================

interface WorkoutTemplate {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  workoutType: string;
  intensity: string;
  description: string;
}

/**
 * Generate AI-powered training plan
 */
export async function generateTrainingPlan(
  userId: string,
  goalType: string, // 5k, 10k, half_marathon, marathon, ultra
  targetDistance: number, // km
  targetTime?: number, // seconds
  targetDate?: Date,
  experienceLevel: string = "intermediate", // beginner, intermediate, advanced
  daysPerWeek: number = 4
): Promise<string> {
  try {
    // Get user profile
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Get current fitness
    const fitness = await getCurrentFitness(userId);

    // Get recent run history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRuns = await db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.userId, userId),
          gte(runs.completedAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(runs.completedAt))
      .limit(20);

    // Calculate weekly mileage base
    const totalDistance = recentRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const weeklyMileageBase = recentRuns.length > 0 ? (totalDistance / 4) : 20; // Default 20km/week

    // Calculate plan duration
    const weeksUntilTarget = targetDate ? 
      Math.ceil((targetDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)) : 
      getPlanDuration(goalType, experienceLevel);

    // Build context for AI
    const context = {
      user: {
        fitnessLevel: user[0]?.fitnessLevel || experienceLevel,
        age: user[0]?.dob ? Math.floor((Date.now() - new Date(user[0].dob).getTime()) / 31557600000) : null,
        gender: user[0]?.gender,
      },
      fitness: fitness ? {
        ctl: fitness.ctl,
        atl: fitness.atl,
        tsb: fitness.tsb,
        status: fitness.status,
      } : null,
      recentActivity: {
        runsLast30Days: recentRuns.length,
        avgWeeklyDistance: weeklyMileageBase,
        avgPace: recentRuns[0]?.avgPace,
      },
      goal: {
        type: goalType,
        distance: targetDistance,
        targetTime,
        targetDate: targetDate?.toISOString(),
        weeksAvailable: weeksUntilTarget,
      },
      preferences: {
        daysPerWeek,
        includeSpeedWork: true,
        includeHillWork: true,
        includeLongRuns: true,
      }
    };

    // Generate plan with OpenAI
    const prompt = `You are an expert running coach. Generate a ${weeksUntilTarget}-week training plan for a ${experienceLevel} runner preparing for a ${goalType} (${targetDistance}km).

Runner Profile:
- Current weekly mileage: ${weeklyMileageBase.toFixed(1)}km
- Fitness level: ${experienceLevel}
- Training days per week: ${daysPerWeek}
- Current fitness (CTL): ${fitness?.ctl || 'N/A'}
- Training status: ${fitness?.status || 'N/A'}

Goal:
- ${goalType.toUpperCase()} (${targetDistance}km)
${targetTime ? `- Target time: ${Math.floor(targetTime / 60)} minutes` : ''}
${targetDate ? `- Race date: ${targetDate.toDateString()}` : ''}

Requirements:
1. Build gradually from current ${weeklyMileageBase.toFixed(1)}km/week base
2. Include easy runs, tempo runs, intervals, and long runs
3. Follow 80/20 rule (80% easy, 20% hard)
4. Build for 3 weeks, recover 1 week pattern
5. Taper for final 2 weeks before race
6. Increase weekly volume by max 10% per week

Return JSON with this exact structure:
{
  "planName": "12-Week Half Marathon Plan",
  "totalWeeks": 12,
  "weeks": [
    {
      "weekNumber": 1,
      "weekDescription": "Base building week - focus on easy mileage",
      "totalDistance": 25.0,
      "focusArea": "endurance",
      "intensityLevel": "easy",
      "workouts": [
        {
          "dayOfWeek": 1,
          "workoutType": "easy",
          "distance": 6.0,
          "targetPace": "5:30/km",
          "intensity": "z2",
          "description": "Easy recovery run",
          "instructions": "Keep heart rate in zone 2. Should feel conversational."
        }
      ]
    }
  ]
}

Include all ${weeksUntilTarget} weeks with ${daysPerWeek} workouts per week.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert running coach who creates scientifically-sound training plans. Always respond with valid JSON only, no extra text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const planData = JSON.parse(response.choices[0].message.content || "{}");

    // Create training plan in database
    const plan = await db
      .insert(trainingPlans)
      .values({
        userId,
        goalType,
        targetDistance,
        targetTime,
        targetDate,
        totalWeeks: weeksUntilTarget,
        experienceLevel,
        weeklyMileageBase,
        daysPerWeek,
        includeSpeedWork: true,
        includeHillWork: true,
        includeLongRuns: true,
        status: "active",
        aiGenerated: true,
      })
      .returning();

    const planId = plan[0].id;

    // Create weekly plans and workouts
    for (const week of planData.weeks) {
      const weeklyPlan = await db
        .insert(weeklyPlans)
        .values({
          trainingPlanId: planId,
          weekNumber: week.weekNumber,
          weekDescription: week.weekDescription,
          totalDistance: week.totalDistance,
          focusArea: week.focusArea,
          intensityLevel: week.intensityLevel,
        })
        .returning();

      const weeklyPlanId = weeklyPlan[0].id;

      // Create individual workouts
      for (const workout of week.workouts) {
        // Calculate scheduled date
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + ((week.weekNumber - 1) * 7) + workout.dayOfWeek);

        await db.insert(plannedWorkouts).values({
          weeklyPlanId,
          trainingPlanId: planId,
          dayOfWeek: workout.dayOfWeek,
          scheduledDate,
          workoutType: workout.workoutType,
          distance: workout.distance,
          targetPace: workout.targetPace,
          intensity: workout.intensity,
          description: workout.description,
          instructions: workout.instructions,
          isCompleted: false,
        });
      }
    }

    console.log(`✅ Generated ${weeksUntilTarget}-week training plan for user ${userId}`);
    return planId;
  } catch (error) {
    console.error("Error generating training plan:", error);
    throw error;
  }
}

/**
 * Get default plan duration based on goal type and experience level
 */
function getPlanDuration(goalType: string, experienceLevel: string): number {
  const durations: Record<string, Record<string, number>> = {
    "5k": { beginner: 8, intermediate: 6, advanced: 4 },
    "10k": { beginner: 10, intermediate: 8, advanced: 6 },
    "half_marathon": { beginner: 14, intermediate: 12, advanced: 10 },
    "marathon": { beginner: 20, intermediate: 18, advanced: 16 },
    "ultra": { beginner: 24, intermediate: 20, advanced: 18 },
  };

  return durations[goalType]?.[experienceLevel] || 12;
}

/**
 * Adapt training plan based on recent performance
 */
export async function adaptTrainingPlan(
  planId: string,
  reason: string, // missed_workout, injury, over_training, ahead_of_schedule
  userId: string
): Promise<void> {
  try {
    // Get plan
    const plan = await db
      .select()
      .from(trainingPlans)
      .where(eq(trainingPlans.id, planId))
      .limit(1);

    if (!plan[0]) {
      throw new Error("Training plan not found");
    }

    // Get current fitness
    const fitness = await getCurrentFitness(userId);

    // Get completed workouts
    const completedWorkouts = await db
      .select()
      .from(plannedWorkouts)
      .where(
        and(
          eq(plannedWorkouts.trainingPlanId, planId),
          eq(plannedWorkouts.isCompleted, true)
        )
      );

    // Generate adaptation recommendation with AI
    const prompt = `As a running coach, adapt this training plan due to: ${reason}

Current Status:
- Current week: ${plan[0].currentWeek}/${plan[0].totalWeeks}
- Completed workouts: ${completedWorkouts.length}
- Current fitness (CTL): ${fitness?.ctl || 'N/A'}
- Training status: ${fitness?.status || 'N/A'}

Recommend adaptations in JSON format:
{
  "recommendation": "Brief explanation of changes",
  "adjustments": [
    "Reduce next week volume by 20%",
    "Add extra rest day"
  ],
  "continueAsIs": false
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert running coach providing training plan adaptations. Respond with JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const adaptation = JSON.parse(response.choices[0].message.content || "{}");

    // Save adaptation
    await db.insert(planAdaptations).values({
      trainingPlanId: planId,
      reason,
      changes: adaptation,
      aiSuggestion: adaptation.recommendation,
      userAccepted: false,
    });

    console.log(`✅ Plan adaptation created for ${reason}`);
  } catch (error) {
    console.error("Error adapting training plan:", error);
    throw error;
  }
}

/**
 * Mark workout as completed and link to run
 */
export async function completeWorkout(
  workoutId: string,
  runId: string
): Promise<void> {
  await db
    .update(plannedWorkouts)
    .set({
      isCompleted: true,
      completedRunId: runId,
    })
    .where(eq(plannedWorkouts.id, workoutId));
}
