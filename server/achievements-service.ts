/**
 * Achievements Detection Service
 * 
 * Automatically detects when users earn achievements based on their activities.
 * Awards badges, updates notifications, and posts to social feed.
 */

import { db } from "./db";
import { achievements, userAchievements, runs, goals, feedActivities, notifications } from "@shared/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";

// ==================== ACHIEVEMENT DEFINITIONS ====================

/**
 * Initialize default achievements in database
 * Run this once to populate the achievements table
 */
export async function initializeAchievements(): Promise<void> {
  const defaultAchievements = [
    // Distance Milestones
    {
      name: "First Steps",
      description: "Complete your first run",
      category: "distance",
      requirement: { type: "run_count", value: 1 },
      rarity: "common",
      points: 10,
      badgeImage: "badge_first_run.png"
    },
    {
      name: "5K Warrior",
      description: "Complete a 5km run",
      category: "distance",
      requirement: { type: "single_distance", value: 5 },
      rarity: "common",
      points: 20,
      badgeImage: "badge_5k.png"
    },
    {
      name: "10K Hero",
      description: "Complete a 10km run",
      category: "distance",
      requirement: { type: "single_distance", value: 10 },
      rarity: "rare",
      points: 50,
      badgeImage: "badge_10k.png"
    },
    {
      name: "Half Marathon Champion",
      description: "Complete a half marathon (21.1km)",
      category: "distance",
      requirement: { type: "single_distance", value: 21.1 },
      rarity: "epic",
      points: 100,
      badgeImage: "badge_half_marathon.png"
    },
    {
      name: "Marathon Legend",
      description: "Complete a full marathon (42.2km)",
      category: "distance",
      requirement: { type: "single_distance", value: 42.2 },
      rarity: "legendary",
      points: 200,
      badgeImage: "badge_marathon.png"
    },
    {
      name: "Century Club",
      description: "Run 100km total distance",
      category: "distance",
      requirement: { type: "total_distance", value: 100 },
      rarity: "common",
      points: 30,
      badgeImage: "badge_100km.png"
    },
    {
      name: "500K Club",
      description: "Run 500km total distance",
      category: "distance",
      requirement: { type: "total_distance", value: 500 },
      rarity: "rare",
      points: 75,
      badgeImage: "badge_500km.png"
    },
    {
      name: "1000K Ultra",
      description: "Run 1000km total distance",
      category: "distance",
      requirement: { type: "total_distance", value: 1000 },
      rarity: "epic",
      points: 150,
      badgeImage: "badge_1000km.png"
    },
    
    // Speed Achievements
    {
      name: "Speed Demon",
      description: "Run 5km under 25 minutes",
      category: "speed",
      requirement: { type: "pace_threshold", distance: 5, time: 1500 },
      rarity: "rare",
      points: 50,
      badgeImage: "badge_speed_demon.png"
    },
    {
      name: "Sub-4 Marathoner",
      description: "Complete a marathon in under 4 hours",
      category: "speed",
      requirement: { type: "pace_threshold", distance: 42.2, time: 14400 },
      rarity: "legendary",
      points: 300,
      badgeImage: "badge_sub4_marathon.png"
    },
    
    // Consistency Achievements
    {
      name: "Weekly Warrior",
      description: "Run 3 times in a single week",
      category: "consistency",
      requirement: { type: "weekly_runs", value: 3 },
      rarity: "common",
      points: 15,
      badgeImage: "badge_weekly_warrior.png"
    },
    {
      name: "Monthly Marathon",
      description: "Run 100km in a single month",
      category: "consistency",
      requirement: { type: "monthly_distance", value: 100 },
      rarity: "rare",
      points: 60,
      badgeImage: "badge_monthly_marathon.png"
    },
    {
      name: "Streak Master",
      description: "Run for 7 consecutive days",
      category: "consistency",
      requirement: { type: "streak_days", value: 7 },
      rarity: "rare",
      points: 50,
      badgeImage: "badge_streak_master.png"
    },
    {
      name: "Centurion",
      description: "Complete 100 total runs",
      category: "consistency",
      requirement: { type: "run_count", value: 100 },
      rarity: "epic",
      points: 100,
      badgeImage: "badge_centurion.png"
    },
    
    // Social Achievements
    {
      name: "Team Player",
      description: "Complete your first group run",
      category: "social",
      requirement: { type: "group_runs", value: 1 },
      rarity: "common",
      points: 20,
      badgeImage: "badge_team_player.png"
    },
    {
      name: "Goal Crusher",
      description: "Complete your first goal",
      category: "social",
      requirement: { type: "goals_completed", value: 1 },
      rarity: "common",
      points: 25,
      badgeImage: "badge_goal_crusher.png"
    },
    
    // Segment Achievements
    {
      name: "Segment Hunter",
      description: "Complete your first segment",
      category: "segment",
      requirement: { type: "segment_efforts", value: 1 },
      rarity: "common",
      points: 15,
      badgeImage: "badge_segment_hunter.png"
    },
    {
      name: "KOM/QOM",
      description: "Set a segment record (King/Queen of Mountain)",
      category: "segment",
      requirement: { type: "segment_kom", value: 1 },
      rarity: "legendary",
      points: 250,
      badgeImage: "badge_kom.png"
    },
    {
      name: "PR Machine",
      description: "Set 10 personal records on segments",
      category: "segment",
      requirement: { type: "segment_prs", value: 10 },
      rarity: "epic",
      points: 100,
      badgeImage: "badge_pr_machine.png"
    },
  ];

  for (const achievement of defaultAchievements) {
    try {
      // Check if achievement already exists
      const existing = await db
        .select()
        .from(achievements)
        .where(eq(achievements.name, achievement.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(achievements).values(achievement);
        console.log(`✅ Added achievement: ${achievement.name}`);
      }
    } catch (error) {
      console.error(`Failed to add achievement ${achievement.name}:`, error);
    }
  }
}

// ==================== ACHIEVEMENT DETECTION ====================

/**
 * Check and award achievements after a run is completed
 */
export async function checkAchievementsAfterRun(runId: string, userId: string): Promise<string[]> {
  try {
    const awardedAchievements: string[] = [];

    // Get the run
    const run = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (!run[0]) return [];

    // Get all achievements
    const allAchievements = await db.select().from(achievements);

    // Get user's existing achievements
    const existingAchievements = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    const existingAchievementIds = new Set(existingAchievements.map(a => a.achievementId));

    // Check each achievement
    for (const achievement of allAchievements) {
      // Skip if already earned
      if (existingAchievementIds.has(achievement.id)) continue;

      const req = achievement.requirement as any;
      let earned = false;

      switch (req.type) {
        case "run_count": {
          const totalRuns = await db
            .select({ count: count() })
            .from(runs)
            .where(eq(runs.userId, userId));
          earned = totalRuns[0].count >= req.value;
          break;
        }

        case "single_distance": {
          earned = run[0].distance >= req.value;
          break;
        }

        case "total_distance": {
          const totalDistance = await db
            .select({ sum: sql<number>`COALESCE(SUM(${runs.distance}), 0)` })
            .from(runs)
            .where(eq(runs.userId, userId));
          earned = totalDistance[0].sum >= req.value;
          break;
        }

        case "pace_threshold": {
          earned = run[0].distance >= req.distance && run[0].duration <= req.time;
          break;
        }

        case "weekly_runs": {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weeklyRuns = await db
            .select({ count: count() })
            .from(runs)
            .where(
              and(
                eq(runs.userId, userId),
                gte(runs.completedAt, weekAgo)
              )
            );
          earned = weeklyRuns[0].count >= req.value;
          break;
        }

        case "monthly_distance": {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          const monthlyDistance = await db
            .select({ sum: sql<number>`COALESCE(SUM(${runs.distance}), 0)` })
            .from(runs)
            .where(
              and(
                eq(runs.userId, userId),
                gte(runs.completedAt, monthAgo)
              )
            );
          earned = monthlyDistance[0].sum >= req.value;
          break;
        }

        case "streak_days": {
          // Simple streak check (could be improved)
          const recentRuns = await db
            .select()
            .from(runs)
            .where(eq(runs.userId, userId))
            .orderBy(runs.completedAt);
          
          let currentStreak = 0;
          let lastDate: Date | null = null;
          
          for (const r of recentRuns) {
            if (!r.completedAt) continue;
            const runDate = new Date(r.completedAt).toDateString();
            
            if (!lastDate) {
              currentStreak = 1;
            } else {
              const dayDiff = Math.floor((new Date(runDate).getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
              if (dayDiff === 1) {
                currentStreak++;
              } else if (dayDiff > 1) {
                currentStreak = 1;
              }
            }
            lastDate = new Date(runDate);
          }
          
          earned = currentStreak >= req.value;
          break;
        }

        case "goals_completed": {
          const completedGoals = await db
            .select({ count: count() })
            .from(goals)
            .where(
              and(
                eq(goals.userId, userId),
                eq(goals.status, "completed")
              )
            );
          earned = completedGoals[0].count >= req.value;
          break;
        }
      }

      if (earned) {
        // Award achievement
        await db.insert(userAchievements).values({
          userId,
          achievementId: achievement.id,
          runId,
        });

        // Create notification
        await db.insert(notifications).values({
          userId,
          type: "achievement_earned",
          title: `Achievement Unlocked!`,
          message: `You earned "${achievement.name}" - ${achievement.description}`,
          data: { achievementId: achievement.id, points: achievement.points },
          read: false,
        });

        // Post to feed
        await db.insert(feedActivities).values({
          userId,
          activityType: "achievement_earned",
          achievementId: achievement.id,
          content: `Earned the "${achievement.name}" achievement!`,
          visibility: "friends",
        });

        awardedAchievements.push(achievement.name);
        console.log(`🏆 User ${userId} earned achievement: ${achievement.name}`);
      }
    }

    return awardedAchievements;
  } catch (error) {
    console.error("Error checking achievements:", error);
    return [];
  }
}

/**
 * Get user's achievements with progress
 */
export async function getUserAchievements(userId: string) {
  try {
    // Get earned achievements
    const earned = await db
      .select({
        userAchievement: userAchievements,
        achievement: achievements
      })
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(userAchievements.earnedAt);

    // Get all achievements
    const all = await db.select().from(achievements);

    // Calculate progress for unearned achievements
    const earnedIds = new Set(earned.map(e => e.achievement?.id));
    const unearned = all.filter(a => !earnedIds.has(a.id));

    // Calculate total points
    const totalPoints = earned.reduce((sum, e) => sum + (e.achievement?.points || 0), 0);

    return {
      earned: earned.map(e => ({
        ...e.achievement,
        earnedAt: e.userAchievement.earnedAt
      })),
      unearned,
      totalPoints,
      totalEarned: earned.length,
      totalAvailable: all.length,
      completionPercent: Math.round((earned.length / all.length) * 100)
    };
  } catch (error) {
    console.error("Error getting user achievements:", error);
    throw error;
  }
}
