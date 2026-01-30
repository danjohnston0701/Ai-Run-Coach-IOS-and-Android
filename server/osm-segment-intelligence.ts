/**
 * OSM Segment Intelligence Service
 * 
 * Tracks which OpenStreetMap road segments users run on to:
 * - Build popularity heatmaps
 * - Improve route generation
 * - Avoid unpopular/bad routes
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import axios from "axios";

// ==================== TYPES ====================

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

interface OSMWaySegment {
  osmWayId: bigint;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distance: number;
}

interface SegmentPopularity {
  osmWayId: bigint;
  runCount: number;
  uniqueUsers: number;
  avgRating?: number;
  lastUsed: Date;
}

// ==================== GPS UTILITIES ====================

/**
 * Calculate distance between two GPS points using Haversine formula
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
 * Simplify GPS track using Ramer-Douglas-Peucker algorithm
 * Reduces points while maintaining shape
 */
function simplifyTrack(points: GPSPoint[], epsilon: number = 0.0001): GPSPoint[] {
  if (points.length <= 2) return points;

  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyTrack(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyTrack(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function pointToLineDistance(point: GPSPoint, lineStart: GPSPoint, lineEnd: GPSPoint): number {
  const dist = haversineDistance(point.latitude, point.longitude, lineStart.latitude, lineStart.longitude);
  return dist;
}

// ==================== OSM SEGMENT SNAPPING ====================

/**
 * Snap GPS track to nearest OSM road segments
 * Uses GraphHopper Map Matching API or Overpass API
 */
export async function snapTrackToOSMSegments(
  gpsTrack: GPSPoint[]
): Promise<OSMWaySegment[]> {
  try {
    // Simplify track to reduce API calls (keep every 50m)
    const simplified = simplifyGPSTrack(gpsTrack, 50);
    
    if (simplified.length < 2) {
      console.log("Track too short after simplification");
      return [];
    }

    // For now, create synthetic segments between consecutive points
    // In production, you'd use GraphHopper Map Matching API or Overpass API
    const segments: OSMWaySegment[] = [];
    
    for (let i = 0; i < simplified.length - 1; i++) {
      const p1 = simplified[i];
      const p2 = simplified[i + 1];
      
      const distance = haversineDistance(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude
      );
      
      // Create synthetic OSM way ID (hash of coordinates)
      const osmWayId = BigInt(
        Math.abs(
          hashCoordinates(p1.latitude, p1.longitude, p2.latitude, p2.longitude)
        )
      );
      
      segments.push({
        osmWayId,
        startLat: p1.latitude,
        startLng: p1.longitude,
        endLat: p2.latitude,
        endLng: p2.longitude,
        distance,
      });
    }
    
    return segments;
  } catch (error) {
    console.error("Error snapping track to OSM:", error);
    return [];
  }
}

/**
 * Simplify GPS track to keep only points ~distance meters apart
 */
function simplifyGPSTrack(track: GPSPoint[], minDistance: number): GPSPoint[] {
  if (track.length === 0) return [];
  
  const simplified: GPSPoint[] = [track[0]];
  let lastPoint = track[0];
  
  for (let i = 1; i < track.length; i++) {
    const dist = haversineDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      track[i].latitude,
      track[i].longitude
    );
    
    if (dist >= minDistance) {
      simplified.push(track[i]);
      lastPoint = track[i];
    }
  }
  
  // Always include last point
  if (simplified[simplified.length - 1] !== track[track.length - 1]) {
    simplified.push(track[track.length - 1]);
  }
  
  return simplified;
}

/**
 * Hash coordinates to create consistent segment ID
 */
function hashCoordinates(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Simple hash: combine rounded coordinates
  const hash = 
    Math.floor(lat1 * 10000) * 1000000 +
    Math.floor(lng1 * 10000) * 100 +
    Math.floor(lat2 * 10000) * 10 +
    Math.floor(lng2 * 10000);
  return hash;
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Record that a user ran through these OSM segments
 */
export async function recordSegmentUsage(
  runId: string,
  userId: string,
  segments: OSMWaySegment[]
): Promise<void> {
  try {
    if (segments.length === 0) return;
    
    // Batch insert segment usage
    const values = segments.map(seg => ({
      osm_way_id: seg.osmWayId.toString(),
      run_id: runId,
      user_id: userId,
      distance_meters: seg.distance,
      timestamp: new Date(),
    }));
    
    // Insert in batches of 100
    for (let i = 0; i < values.length; i += 100) {
      const batch = values.slice(i, i + 100);
      
      await db.execute(sql`
        INSERT INTO segment_usage (osm_way_id, run_id, user_id, distance_meters, timestamp)
        SELECT * FROM json_populate_recordset(
          NULL::segment_usage,
          ${JSON.stringify(batch)}
        )
      `);
    }
    
    console.log(`Recorded ${segments.length} OSM segments for run ${runId}`);
  } catch (error) {
    console.error("Error recording segment usage:", error);
    throw error;
  }
}

/**
 * Get popularity scores for OSM segments in a polyline route
 */
export async function getRoutePopularityScore(
  polyline: Array<[number, number]> // [[lng, lat], ...]
): Promise<number> {
  try {
    if (polyline.length < 2) return 0;
    
    // Convert polyline to segments
    const segments: OSMWaySegment[] = [];
    for (let i = 0; i < polyline.length - 1; i++) {
      const [lng1, lat1] = polyline[i];
      const [lng2, lat2] = polyline[i + 1];
      
      const distance = haversineDistance(lat1, lng1, lat2, lng2);
      const osmWayId = BigInt(Math.abs(hashCoordinates(lat1, lng1, lat2, lng2)));
      
      segments.push({
        osmWayId,
        startLat: lat1,
        startLng: lng1,
        endLat: lat2,
        endLng: lng2,
        distance,
      });
    }
    
    // Query popularity for these segments
    const osmWayIds = segments.map(s => s.osmWayId.toString());
    
    const result = await db.execute(sql`
      SELECT 
        osm_way_id,
        run_count,
        unique_users,
        avg_rating
      FROM segment_popularity
      WHERE osm_way_id = ANY(${osmWayIds})
    `);
    
    if (result.rows.length === 0) {
      return 0.1; // Low score for routes with no usage data
    }
    
    // Calculate weighted average popularity
    let totalScore = 0;
    let totalDistance = 0;
    
    for (const segment of segments) {
      const popularity = result.rows.find(
        (row: any) => row.osm_way_id === segment.osmWayId.toString()
      );
      
      const segmentScore = popularity
        ? (popularity.run_count * 0.6 + (popularity.avg_rating || 3) * 0.4) / 50
        : 0.1; // Low score for unused segments
      
      totalScore += segmentScore * segment.distance;
      totalDistance += segment.distance;
    }
    
    return Math.min(totalScore / totalDistance, 1.0); // Normalize to 0-1
  } catch (error) {
    console.error("Error calculating route popularity:", error);
    return 0.5; // Default score
  }
}

/**
 * Update popularity aggregations (run daily via cron)
 */
export async function updatePopularityScores(): Promise<void> {
  try {
    await db.execute(sql`SELECT update_segment_popularity()`);
    console.log("✅ Updated segment popularity scores");
  } catch (error) {
    console.error("Error updating popularity scores:", error);
  }
}

/**
 * Analyze route characteristics for validation
 */
export function analyzeRouteCharacteristics(gpsTrack: GPSPoint[]): {
  backtrackingScore: number;
  turnCount: number;
  hasDeadEnds: boolean;
  circuitQuality: number;
} {
  if (gpsTrack.length < 10) {
    return {
      backtrackingScore: 0,
      turnCount: 0,
      hasDeadEnds: false,
      circuitQuality: 0,
    };
  }
  
  let backtrackCount = 0;
  let sharpTurnCount = 0;
  
  // Check for 180° turns (backtracking)
  for (let i = 2; i < gpsTrack.length; i++) {
    const p1 = gpsTrack[i - 2];
    const p2 = gpsTrack[i - 1];
    const p3 = gpsTrack[i];
    
    const angle = calculateAngle(p1, p2, p3);
    
    if (angle > 160) {
      backtrackCount++;
    } else if (angle > 90) {
      sharpTurnCount++;
    }
  }
  
  // Check if start and end are close (good circuit)
  const startEndDistance = haversineDistance(
    gpsTrack[0].latitude,
    gpsTrack[0].longitude,
    gpsTrack[gpsTrack.length - 1].latitude,
    gpsTrack[gpsTrack.length - 1].longitude
  );
  
  const isCircuit = startEndDistance < 100; // Within 100m
  
  return {
    backtrackingScore: backtrackCount / gpsTrack.length,
    turnCount: sharpTurnCount,
    hasDeadEnds: backtrackCount > 3, // More than 3 U-turns = likely has dead ends
    circuitQuality: isCircuit ? 1.0 : Math.max(0, 1 - startEndDistance / 500),
  };
}

/**
 * Calculate angle between three GPS points
 */
function calculateAngle(p1: GPSPoint, p2: GPSPoint, p3: GPSPoint): number {
  const bearing1 = calculateBearing(p1, p2);
  const bearing2 = calculateBearing(p2, p3);
  
  let angle = Math.abs(bearing2 - bearing1);
  if (angle > 180) angle = 360 - angle;
  
  return angle;
}

function calculateBearing(p1: GPSPoint, p2: GPSPoint): number {
  const lat1 = p1.latitude * Math.PI / 180;
  const lat2 = p2.latitude * Math.PI / 180;
  const dLng = (p2.longitude - p1.longitude) * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}
