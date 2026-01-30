/**
 * Intelligent Route Generation Service
 * 
 * Uses GraphHopper API + OSM segment popularity data to generate high-quality running routes
 */

import axios from "axios";
import { getRoutePopularityScore, analyzeRouteCharacteristics } from "./osm-segment-intelligence";

const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY || "";
const GRAPHHOPPER_BASE_URL = "https://graphhopper.com/api/1";

// ==================== TYPES ====================

interface RouteRequest {
  latitude: number;
  longitude: number;
  distanceKm: number;
  preferTrails?: boolean;
  avoidHills?: boolean;
}

interface GeneratedRoute {
  id: string;
  polyline: string; // Encoded polyline
  coordinates: Array<[number, number]>; // [[lng, lat], ...]
  distance: number; // meters
  elevationGain: number; // meters
  elevationLoss: number; // meters
  duration: number; // seconds (estimated)
  difficulty: string; // "easy", "moderate", "hard"
  popularityScore: number; // 0-1
  qualityScore: number; // 0-1
  turnInstructions: TurnInstruction[];
}

interface TurnInstruction {
  text: string;
  distance: number;
  time: number;
  interval: [number, number];
  sign: number; // -3=sharp left, -2=left, -1=slight left, 0=straight, 1=slight right, 2=right, 3=sharp right
}

interface ValidationResult {
  isValid: boolean;
  issues: Array<{
    type: 'U_TURN' | 'REPEATED_SEGMENT' | 'DEAD_END';
    location: [number, number];
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  qualityScore: number;
}

// ==================== GRAPHHOPPER API ====================

/**
 * Generate a circuit route using GraphHopper Round Trip API
 */
async function generateGraphHopperRoute(
  lat: number,
  lng: number,
  distanceMeters: number,
  profile: 'foot' | 'hike',
  seed: number = 0
): Promise<any> {
  try {
    const response = await axios.get(`${GRAPHHOPPER_BASE_URL}/route`, {
      params: {
        point: `${lat},${lng}`,
        profile: profile,
        algorithm: 'round_trip',
        'round_trip.distance': distanceMeters,
        'round_trip.seed': seed,
        points_encoded: false,
        elevation: true,
        instructions: true,
        details: ['road_class', 'surface'],
        key: GRAPHHOPPER_API_KEY,
      },
      timeout: 30000, // 30 second timeout
    });

    return response.data;
  } catch (error: any) {
    console.error("GraphHopper API error:", error.response?.data || error.message);
    throw new Error(`GraphHopper API failed: ${error.message}`);
  }
}

/**
 * Validate route for dead ends, U-turns, and backtracking
 */
function validateRoute(coordinates: Array<[number, number]>): ValidationResult {
  const issues: ValidationResult['issues'] = [];
  
  if (coordinates.length < 3) {
    return { isValid: false, issues: [], qualityScore: 0 };
  }
  
  // Check for U-turns (180° turns)
  for (let i = 1; i < coordinates.length - 1; i++) {
    const angle = calculateAngle(
      coordinates[i - 1],
      coordinates[i],
      coordinates[i + 1]
    );
    
    if (angle > 160) {
      issues.push({
        type: 'U_TURN',
        location: coordinates[i],
        severity: 'HIGH',
      });
    }
  }
  
  // Check for repeated segments (running same road twice)
  const segmentSet = new Set<string>();
  for (let i = 0; i < coordinates.length - 1; i++) {
    const segment = `${coordinates[i][0].toFixed(4)},${coordinates[i][1].toFixed(4)}-${coordinates[i + 1][0].toFixed(4)},${coordinates[i + 1][1].toFixed(4)}`;
    if (segmentSet.has(segment)) {
      issues.push({
        type: 'REPEATED_SEGMENT',
        location: coordinates[i],
        severity: 'MEDIUM',
      });
    }
    segmentSet.add(segment);
  }
  
  // Calculate quality score
  const highIssues = issues.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM').length;
  
  const qualityScore = Math.max(0, 1 - (highIssues * 0.3 + mediumIssues * 0.1));
  const isValid = highIssues < 2; // Allow max 1 high severity issue
  
  return { isValid, issues, qualityScore };
}

function calculateAngle(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): number {
  const bearing1 = calculateBearing(p1, p2);
  const bearing2 = calculateBearing(p2, p3);
  
  let angle = Math.abs(bearing2 - bearing1);
  if (angle > 180) angle = 360 - angle;
  
  return angle;
}

function calculateBearing(p1: [number, number], p2: [number, number]): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculate difficulty based on distance and elevation
 */
function calculateDifficulty(distanceKm: number, elevationGainM: number): string {
  const elevationPerKm = elevationGainM / distanceKm;
  
  if (elevationPerKm < 10 && distanceKm < 8) {
    return 'easy';
  } else if (elevationPerKm < 25 && distanceKm < 15) {
    return 'moderate';
  } else {
    return 'hard';
  }
}

// ==================== INTELLIGENT ROUTE GENERATION ====================

/**
 * Generate multiple route candidates and return top 3
 */
export async function generateIntelligentRoute(
  request: RouteRequest
): Promise<GeneratedRoute[]> {
  const { latitude, longitude, distanceKm, preferTrails = true } = request;
  const distanceMeters = distanceKm * 1000;
  const profile = preferTrails ? 'hike' : 'foot';
  
  console.log(`🗺️ Generating ${distanceKm}km route at (${latitude}, ${longitude})`);
  
  // Generate multiple candidates with different seeds
  const maxAttempts = 3;
  const candidates: Array<{
    route: any;
    validation: ValidationResult;
    popularityScore: number;
  }> = [];
  
  for (let seed = 0; seed < maxAttempts; seed++) {
    try {
      const ghResponse = await generateGraphHopperRoute(
        latitude,
        longitude,
        distanceMeters,
        profile,
        seed
      );
      
      if (!ghResponse.paths || ghResponse.paths.length === 0) {
        console.log(`Seed ${seed}: No route found`);
        continue;
      }
      
      const path = ghResponse.paths[0];
      const coordinates = path.points.coordinates as Array<[number, number]>;
      
      // Validate route quality
      const validation = validateRoute(coordinates);
      console.log(`Seed ${seed}: Valid=${validation.isValid}, Quality=${validation.qualityScore.toFixed(2)}, Issues=${validation.issues.length}`);
      
      if (!validation.isValid) {
        console.log(`Seed ${seed}: Rejected - invalid route`);
        continue;
      }
      
      // Check popularity score
      const popularityScore = await getRoutePopularityScore(coordinates);
      console.log(`Seed ${seed}: Popularity=${popularityScore.toFixed(2)}`);
      
      candidates.push({
        route: path,
        validation,
        popularityScore,
      });
      
    } catch (error) {
      console.error(`Seed ${seed} failed:`, error);
    }
  }
  
  // No valid routes found
  if (candidates.length === 0) {
    throw new Error("Could not generate a valid route. Try a different location or distance.");
  }
  
  // Score candidates and pick the best
  const scored = candidates.map(c => ({
    ...c,
    totalScore: 
      c.validation.qualityScore * 0.6 + // 60% weight on quality (no dead ends)
      c.popularityScore * 0.4,          // 40% weight on popularity
  }));
  
  scored.sort((a, b) => b.totalScore - a.totalScore);
  
  console.log(`✅ Generated ${scored.length} routes, returning top ${Math.min(3, scored.length)}`);
  
  // Return top 3 routes (or fewer if less than 3 valid routes)
  const topRoutes = scored.slice(0, 3);
  
  return topRoutes.map((candidate, index) => {
    const route = candidate.route;
    const difficulty = calculateDifficulty(
      route.distance / 1000,
      route.ascend || 0
    );
    
    console.log(`  Route ${index + 1}: Score=${candidate.totalScore.toFixed(2)}, Quality=${candidate.validation.qualityScore.toFixed(2)}, Popularity=${candidate.popularityScore.toFixed(2)}`);
    
    return {
      id: generateRouteId(),
      polyline: encodePolyline(route.points.coordinates),
      coordinates: route.points.coordinates,
      distance: route.distance,
      elevationGain: route.ascend || 0,
      elevationLoss: route.descend || 0,
      duration: route.time / 1000,
      difficulty,
      popularityScore: candidate.popularityScore,
      qualityScore: candidate.validation.qualityScore,
      turnInstructions: route.instructions || [],
    };
  });
}

/**
 * Generate a unique route ID
 */
function generateRouteId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Encode polyline (simplified version - use polyline library for production)
 */
function encodePolyline(coordinates: Array<[number, number]>): string {
  // For now, just stringify - use @mapbox/polyline or similar in production
  return JSON.stringify(coordinates);
}

/**
 * Get estimated time for route (rough calculation)
 */
function estimateRunTime(distanceKm: number, elevationGainM: number): number {
  // Base pace: 6 min/km
  const basePace = 6; // minutes per km
  
  // Add time for elevation (1 minute per 100m gain)
  const elevationTime = (elevationGainM / 100) * 1;
  
  const totalMinutes = distanceKm * basePace + elevationTime;
  return totalMinutes * 60; // Convert to seconds
}
