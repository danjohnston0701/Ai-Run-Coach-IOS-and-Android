/**
 * Segment Matching Service
 * 
 * Automatically detects when a user's GPS track passes through known segments.
 * Updates leaderboards, detects PRs, and awards achievements.
 * 
 * Uses simplified polyline matching with Haversine distance formula.
 */

import { db } from "./db";
import { segments, segmentEfforts, runs } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// ==================== GPS UTILITIES ====================

/**
 * Calculate distance between two GPS points using Haversine formula
 * Returns distance in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a GPS point is within threshold distance of a line segment
 */
function isPointNearSegment(
  point: { lat: number; lng: number },
  segmentStart: { lat: number; lng: number },
  segmentEnd: { lat: number; lng: number },
  threshold: number = 50 // meters
): boolean {
  // Calculate perpendicular distance from point to line segment
  const dist = haversineDistance(point.lat, point.lng, segmentStart.lat, segmentStart.lng);
  return dist <= threshold;
}

/**
 * Find matching segment in GPS track
 * Returns start and end indices if match found
 */
function findSegmentInTrack(
  gpsTrack: Array<{ latitude: number; longitude: number; timestamp?: number }>,
  segment: {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    distance: number;
  },
  threshold: number = 50 // meters
): { startIndex: number; endIndex: number } | null {
  const track = gpsTrack;
  
  // Look for start point match
  for (let i = 0; i < track.length - 1; i++) {
    const point = track[i];
    const distToStart = haversineDistance(
      point.latitude,
      point.longitude,
      segment.startLat,
      segment.startLng
    );

    // Found potential start point
    if (distToStart <= threshold) {
      // Now look ahead for end point
      for (let j = i + 1; j < track.length; j++) {
        const futurePoint = track[j];
        const distToEnd = haversineDistance(
          futurePoint.latitude,
          futurePoint.longitude,
          segment.endLat,
          segment.endLng
        );

        // Found end point - verify distance is reasonable
        if (distToEnd <= threshold) {
          // Calculate actual distance covered
          let actualDistance = 0;
          for (let k = i; k < j; k++) {
            actualDistance += haversineDistance(
              track[k].latitude,
              track[k].longitude,
              track[k + 1].latitude,
              track[k + 1].longitude
            );
          }

          // Distance should be within 20% of segment distance
          const distanceRatio = actualDistance / segment.distance;
          if (distanceRatio >= 0.8 && distanceRatio <= 1.2) {
            return { startIndex: i, endIndex: j };
          }
        }
      }
    }
  }

  return null;
}

// ==================== SEGMENT MATCHING ====================

/**
 * Match a run's GPS track against all nearby segments
 */
export async function matchRunToSegments(
  runId: string,
  userId: string,
  gpsTrack: Array<{ latitude: number; longitude: number; timestamp?: number }>,
  avgHeartRate?: number,
  maxHeartRate?: number,
  avgCadence?: number
): Promise<Array<{ segmentId: string; elapsedTime: number; isNewPR: boolean }>> {
  try {
    if (!gpsTrack || gpsTrack.length < 10) {
      console.log(`Run ${runId}: GPS track too short for segment matching`);
      return [];
    }

    // Get bounding box of the run
    const lats = gpsTrack.map(p => p.latitude);
    const lngs = gpsTrack.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding (0.01 degrees ≈ 1km)
    const padding = 0.02;

    // Find segments that overlap with run's bounding box
    const candidateSegments = await db
      .select()
      .from(segments)
      .where(
        sql`${segments.startLat} BETWEEN ${minLat - padding} AND ${maxLat + padding}
        AND ${segments.startLng} BETWEEN ${minLng - padding} AND ${maxLng + padding}`
      );

    console.log(`Run ${runId}: Found ${candidateSegments.length} candidate segments`);

    const matches: Array<{ segmentId: string; elapsedTime: number; isNewPR: boolean }> = [];

    // Try to match each segment
    for (const segment of candidateSegments) {
      const match = findSegmentInTrack(gpsTrack, {
        startLat: segment.startLat!,
        startLng: segment.startLng!,
        endLat: segment.endLat!,
        endLng: segment.endLng!,
        distance: segment.distance!,
      });

      if (match) {
        // Calculate elapsed time
        let elapsedTime = 0;
        if (gpsTrack[match.startIndex].timestamp && gpsTrack[match.endIndex].timestamp) {
          elapsedTime = Math.floor(
            (gpsTrack[match.endIndex].timestamp! - gpsTrack[match.startIndex].timestamp!) / 1000
          );
        } else {
          // Estimate based on average 5 min/km pace if timestamps missing
          elapsedTime = Math.round((segment.distance! / 1000) * 300); // 5 min/km
        }

        // Check if this is a personal record
        const existingEfforts = await db
          .select()
          .from(segmentEfforts)
          .where(
            and(
              eq(segmentEfforts.segmentId, segment.id as any),
              eq(segmentEfforts.userId, userId)
            )
          )
          .orderBy(segmentEfforts.elapsedTime);

        const isNewPR = existingEfforts.length === 0 || elapsedTime < existingEfforts[0].elapsedTime;

        // Get overall rank
        const allEfforts = await db
          .select()
          .from(segmentEfforts)
          .where(eq(segmentEfforts.segmentId, segment.id as any))
          .orderBy(segmentEfforts.elapsedTime);

        const leaderboardRank = allEfforts.filter(e => e.elapsedTime < elapsedTime).length + 1;

        // Determine achievement type
        let achievementType: string | null = null;
        if (isNewPR) achievementType = "new_pr";
        if (leaderboardRank === 1) achievementType = "kom"; // King/Queen of Mountain
        if (leaderboardRank <= 10) achievementType = "top_10";

        // Save segment effort
        await db.insert(segmentEfforts).values({
          segmentId: segment.id as any,
          userId,
          runId,
          elapsedTime,
          startIndex: match.startIndex,
          endIndex: match.endIndex,
          avgHeartRate,
          maxHeartRate,
          avgCadence,
          isPersonalRecord: isNewPR,
          leaderboardRank,
          achievementType,
        });

        // Update segment effort count
        await db
          .update(segments)
          .set({ 
            effort_count: sql`${segments.effortCount} + 1` 
          } as any)
          .where(eq(segments.id, segment.id));

        matches.push({
          segmentId: segment.id,
          elapsedTime,
          isNewPR,
        });

        console.log(
          `✅ Matched segment ${segment.name}: ${elapsedTime}s (${isNewPR ? "NEW PR!" : "not PR"})`
        );
      }
    }

    return matches;
  } catch (error) {
    console.error("Error matching segments:", error);
    return [];
  }
}

/**
 * Re-process a run to find segment matches
 * Useful if segments were added after the run was completed
 */
export async function reprocessRunForSegments(runId: string): Promise<void> {
  try {
    const run = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (!run[0] || !run[0].gpsTrack) {
      throw new Error("Run not found or has no GPS track");
    }

    const gpsTrack = run[0].gpsTrack as Array<{ latitude: number; longitude: number; timestamp?: number }>;

    await matchRunToSegments(
      runId,
      run[0].userId,
      gpsTrack,
      run[0].avgHeartRate || undefined,
      run[0].maxHeartRate || undefined,
      run[0].cadence || undefined
    );
  } catch (error) {
    console.error(`Error reprocessing run ${runId}:`, error);
    throw error;
  }
}

/**
 * Create a new segment from a run
 */
export async function createSegmentFromRun(
  runId: string,
  userId: string,
  startIndex: number,
  endIndex: number,
  name: string,
  description?: string
): Promise<string> {
  try {
    const run = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (!run[0] || !run[0].gpsTrack) {
      throw new Error("Run not found or has no GPS track");
    }

    const gpsTrack = run[0].gpsTrack as Array<{ latitude: number; longitude: number; altitude?: number }>;

    if (startIndex >= endIndex || endIndex >= gpsTrack.length) {
      throw new Error("Invalid start/end indices");
    }

    const startPoint = gpsTrack[startIndex];
    const endPoint = gpsTrack[endIndex];

    // Calculate segment distance
    let distance = 0;
    for (let i = startIndex; i < endIndex; i++) {
      distance += haversineDistance(
        gpsTrack[i].latitude,
        gpsTrack[i].longitude,
        gpsTrack[i + 1].latitude,
        gpsTrack[i + 1].longitude
      );
    }

    // Calculate elevation gain/loss if altitude data available
    let elevationGain = 0;
    let elevationLoss = 0;
    if (gpsTrack[startIndex].altitude !== undefined) {
      for (let i = startIndex; i < endIndex; i++) {
        const altDiff = (gpsTrack[i + 1].altitude || 0) - (gpsTrack[i].altitude || 0);
        if (altDiff > 0) elevationGain += altDiff;
        else elevationLoss += Math.abs(altDiff);
      }
    }

    // Create segment polyline (simplified)
    const segmentPoints = gpsTrack.slice(startIndex, endIndex + 1);
    const polyline = JSON.stringify(
      segmentPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))
    );

    // Insert segment
    const newSegment = await db
      .insert(segments)
      .values({
        name,
        description,
        startLat: startPoint.latitude,
        startLng: startPoint.longitude,
        endLat: endPoint.latitude,
        endLng: endPoint.longitude,
        polyline,
        distance,
        elevationGain: elevationGain || null,
        elevationLoss: elevationLoss || null,
        avgGradient: elevationGain > 0 ? (elevationGain / distance) * 100 : null,
        createdById: userId,
      } as any)
      .returning();

    return newSegment[0].id;
  } catch (error) {
    console.error("Error creating segment:", error);
    throw error;
  }
}
