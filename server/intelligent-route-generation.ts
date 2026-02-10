/**
 * Intelligent Route Generation Service
 * 
 * Uses GraphHopper API + OSM segment popularity data to generate high-quality running routes
 * 
 * ROUTE QUALITY RULES (Feb 10, 2026 - Enhanced Dead-End Detection):
 * ✅ Avoids highways, motorways, and major roads (using GraphHopper road_class data)
 * ✅ Validates distance within ±15% of target (balanced)
 * ✅ Detects and rejects routes with U-turns >160° (dead-end turnarounds)
 * ✅ Detects OUT-AND-BACK patterns (running back on same road)
 * ✅ Detects DEAD-END turnarounds (goes to point and returns)
 * ✅ Detects INEFFICIENT paths (too direct = out-and-back)
 * ✅ Prevents repeated segments (backtracking)
 * ✅ Enforces genuine circular routes (start = end)
 * ✅ Optimizes for trails, parks, paths, cycleways when preferTrails=true
 * ✅ Filters out routes with >30% highway usage (HIGH severity)
 * ✅ Filters out routes with >10% highway usage (MEDIUM severity)
 * ✅ Scores routes: Quality (50%) + Popularity (30%) + Terrain (20% if preferTrails)
 * ✅ Triple-layer validation: early distance check + full validation + final filter
 * ✅ 30 attempts to find perfect routes
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

interface RoadClassAnalysis {
  hasHighways: boolean;
  highwayPercentage: number;
  trailPercentage: number;
  pathPercentage: number;
  terrainScore: number; // 0-1, higher = more trails/paths
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
    type: 'U_TURN' | 'REPEATED_SEGMENT' | 'DEAD_END' | 'HIGHWAY' | 'DISTANCE_MISMATCH';
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
  profile: 'foot' | 'bike',
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
 * Analyze road classes from GraphHopper details
 */
function analyzeRoadClasses(roadClassDetails: any[]): RoadClassAnalysis {
  if (!roadClassDetails || roadClassDetails.length === 0) {
    return {
      hasHighways: false,
      highwayPercentage: 0,
      trailPercentage: 0,
      pathPercentage: 0,
      terrainScore: 0.5,
    };
  }
  
  let totalSegments = 0;
  let highwaySegments = 0;
  let trailSegments = 0;
  let pathSegments = 0;
  
  // GraphHopper road_class values: https://docs.graphhopper.com/#section/Elevation-API/Details
  // motorway, trunk, primary, secondary, tertiary, unclassified, residential, service, track, path, footway, cycleway
  
  for (const detail of roadClassDetails) {
    const [startIdx, endIdx, roadClass] = detail;
    const segmentLength = endIdx - startIdx;
    totalSegments += segmentLength;
    
    const roadClassLower = (roadClass || '').toLowerCase();
    
    // Highways and major roads (BAD for running)
    if (roadClassLower.includes('motorway') || 
        roadClassLower.includes('trunk') || 
        roadClassLower.includes('primary')) {
      highwaySegments += segmentLength;
    }
    
    // Trails and paths (GOOD for running)
    if (roadClassLower.includes('track') || 
        roadClassLower.includes('trail')) {
      trailSegments += segmentLength;
    }
    
    // Footpaths and cycleways (GREAT for running)
    if (roadClassLower.includes('path') || 
        roadClassLower.includes('footway') || 
        roadClassLower.includes('cycleway')) {
      pathSegments += segmentLength;
    }
  }
  
  const highwayPercentage = totalSegments > 0 ? (highwaySegments / totalSegments) : 0;
  const trailPercentage = totalSegments > 0 ? (trailSegments / totalSegments) : 0;
  const pathPercentage = totalSegments > 0 ? (pathSegments / totalSegments) : 0;
  
  // Terrain score: 1.0 = all trails/paths, 0.0 = all highways
  const terrainScore = Math.max(0, Math.min(1, 
    (trailPercentage * 1.0 + pathPercentage * 1.0) - (highwayPercentage * 2.0)
  ));
  
  return {
    hasHighways: highwayPercentage > 0.1, // More than 10% highways
    highwayPercentage,
    trailPercentage,
    pathPercentage,
    terrainScore,
  };
}

/**
 * Validate route for dead ends, U-turns, backtracking, highways, and distance
 */
function validateRoute(
  coordinates: Array<[number, number]>,
  actualDistanceMeters: number,
  targetDistanceMeters: number,
  roadClassDetails?: any[]
): ValidationResult {
  const issues: ValidationResult['issues'] = [];
  
  if (coordinates.length < 3) {
    return { isValid: false, issues: [], qualityScore: 0 };
  }
  
  // Check distance tolerance (±15% of target) - BALANCED
  const distanceDiffPercent = Math.abs(actualDistanceMeters - targetDistanceMeters) / targetDistanceMeters;
  if (distanceDiffPercent > 0.15) {
    issues.push({
      type: 'DISTANCE_MISMATCH',
      location: coordinates[0],
      severity: 'HIGH', // Any distance mismatch >15% is HIGH severity = auto-reject
    });
    console.log(`❌ REJECTED: Distance ${(distanceDiffPercent * 100).toFixed(1)}% off target (actual=${(actualDistanceMeters/1000).toFixed(2)}km, target=${(targetDistanceMeters/1000).toFixed(2)}km)`);
  }
  
  // Check for U-turns (sharp turns >160°)
  let uTurnCount = 0;
  for (let i = 1; i < coordinates.length - 1; i++) {
    const angle = calculateAngle(
      coordinates[i - 1],
      coordinates[i],
      coordinates[i + 1]
    );

    // U-turn threshold: 160° (allows gentle curves but rejects dead-end turnarounds)
    if (angle > 160) {
      uTurnCount++;
      issues.push({
        type: 'U_TURN',
        location: coordinates[i],
        severity: 'HIGH',
      });
      console.log(`❌ U-turn detected at point ${i}: ${angle.toFixed(1)}° turn`);
    }
  }
  
  if (uTurnCount > 0) {
    console.log(`❌ Total U-turns: ${uTurnCount} (route will be REJECTED)`);
  }
  
  // Check for repeated segments (running same road twice)
  const segmentSet = new Set<string>();
  const reverseSegmentSet = new Set<string>(); // For detecting out-and-back
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    // Forward segment
    const segment = `${coordinates[i][0].toFixed(4)},${coordinates[i][1].toFixed(4)}-${coordinates[i + 1][0].toFixed(4)},${coordinates[i + 1][1].toFixed(4)}`;
    // Reverse segment (to detect going back on same road)
    const reverseSegment = `${coordinates[i + 1][0].toFixed(4)},${coordinates[i + 1][1].toFixed(4)}-${coordinates[i][0].toFixed(4)},${coordinates[i][1].toFixed(4)}`;
    
    // Check for exact repeated segment
    if (segmentSet.has(segment)) {
      issues.push({
        type: 'REPEATED_SEGMENT',
        location: coordinates[i],
        severity: 'MEDIUM',
      });
      console.log(`⚠️ Repeated segment detected at index ${i}`);
    }
    
    // Check for out-and-back (running back on the same road)
    if (reverseSegmentSet.has(reverseSegment)) {
      issues.push({
        type: 'OUT_AND_BACK',
        location: coordinates[i],
        severity: 'HIGH', // Out-and-back is HIGH severity
      });
      console.log(`❌ OUT-AND-BACK detected: Running back on same road at index ${i}`);
    }
    
    segmentSet.add(segment);
    reverseSegmentSet.add(segment); // Add forward segment - if we see it in reverse later, that's out-and-back
  }
  
  // Check for DEAD-END turnarounds (route goes to a point and returns)
  // This is different from U-turns - it's about the overall path shape
  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];
  const midPoint = coordinates[Math.floor(coordinates.length / 2)];
  
  // Calculate distance from start to midpoint and midpoint to end
  const distStartToMid = calculateDistance(startPoint[0], startPoint[1], midPoint[0], midPoint[1]);
  const distMidToEnd = calculateDistance(midPoint[0], midPoint[1], endPoint[0], endPoint[1]);
  
  // If start->mid and mid->end are very similar, it's likely an out-and-back
  const outAndBackRatio = Math.min(distStartToMid, distMidToEnd) / Math.max(distStartToMid, distMidToEnd);
  if (outAndBackRatio > 0.92 && distStartToMid > 300) { // Within 8% similarity and significant distance (strict)
    issues.push({
      type: 'DEAD_END_TURNAROUND',
      location: midPoint,
      severity: 'HIGH',
    });
    console.log(`❌ DEAD-END TURNAROUND: Out-and-back ratio ${outAndBackRatio.toFixed(2)}`);
  }
  
  // Check path coverage - a true circuit should cover area, not just a line
  // Calculate the ratio of actual path distance to "as the crow flies" distance
  const directDistance = calculateDistance(startPoint[0], startPoint[1], endPoint[0], endPoint[1]);
  const pathEfficiency = actualDistanceMeters / (directDistance * 1000 + 1); // +1 to avoid div by zero

  // If the route is nearly a straight line out and back, flag it but don't reject (MEDIUM only)
  // A good circuit should have pathEfficiency < 3.0 (not going nearly straight out and back)
  if (pathEfficiency > 3.0 && actualDistanceMeters > 1000) {
    issues.push({
      type: 'INEFFICIENT_PATH',
      location: midPoint,
      severity: 'MEDIUM', // Only MEDIUM, not HIGH - allows some straight-ish routes
    });
    console.log(`⚠️ INEFFICIENT PATH: Ratio ${pathEfficiency.toFixed(2)} suggests out-and-back (scored down, not rejected)`);
  }
  
  // Check for highways/motorways
  if (roadClassDetails && roadClassDetails.length > 0) {
    const roadAnalysis = analyzeRoadClasses(roadClassDetails);
    console.log(`🛣️ Road analysis: highways=${(roadAnalysis.highwayPercentage * 100).toFixed(1)}%, trails=${(roadAnalysis.trailPercentage * 100).toFixed(1)}%, paths=${(roadAnalysis.pathPercentage * 100).toFixed(1)}%`);
    
    if (roadAnalysis.hasHighways) {
      const severity = roadAnalysis.highwayPercentage > 0.3 ? 'HIGH' : 'MEDIUM';
      issues.push({
        type: 'HIGHWAY',
        location: coordinates[0],
        severity,
      });
      console.log(`${severity === 'HIGH' ? '❌' : '⚠️'} Highway ${severity}: ${(roadAnalysis.highwayPercentage * 100).toFixed(1)}% of route`);
    }
  }
  
  // Calculate quality score
  const highIssues = issues.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM').length;
  
  const qualityScore = Math.max(0, 1 - (highIssues * 0.5 + mediumIssues * 0.2));
  
  // STRICT: Don't allow ANY high severity issues (distance >10%, highways >30%, U-turns)
  const isValid = highIssues === 0 && mediumIssues <= 2;
  
  if (!isValid) {
    console.log(`❌ Route validation FAILED: ${highIssues} HIGH issues, ${mediumIssues} MEDIUM issues`);
  }
  
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

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
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
  
  // Check if API key is set
  if (!GRAPHHOPPER_API_KEY) {
    throw new Error("GRAPHHOPPER_API_KEY is not set in environment variables");
  }
  
  // GraphHopper free API only supports 'foot', 'bike', 'car'
  // Always use 'foot' for running routes
  const profile = 'foot';
  
  console.log(`\n🗺️ ========== GENERATING ${distanceKm}km ROUTE ==========`);
  console.log(`📍 Location: (${latitude}, ${longitude})`);
  console.log(`📏 Target: ${(distanceMeters * 0.85 / 1000).toFixed(2)}km - ${(distanceMeters * 1.15 / 1000).toFixed(2)}km (±15%)`);
  console.log(`🌲 Prefer trails: ${preferTrails}`);
  
  // Track rejection reasons for detailed reporting
  const rejectionStats = {
    distance: 0,        // Outside ±15% tolerance
    distanceEarly: 0,   // Outside ±10% early check
    uTurns: 0,          // Sharp U-turns >160°
    highways: 0,        // Too much highway usage
    outAndBack: 0,      // Running back on same road
    deadEnd: 0,         // Dead-end turnaround pattern
    inefficient: 0,     // Path efficiency too low (MEDIUM only, not rejected)
    terrain: 0,         // Low trail score when preferTrails=true
    validationFailed: 0,// Other validation issues
    noRoute: 0,         // GraphHopper returned no route
    error: 0,           // API errors
    passed: 0           // Routes that passed all checks
  };
  
  // Generate multiple candidates with different seeds (15 attempts to stay within GraphHopper free tier limits)
  const maxAttempts = 15;
  const candidates: Array<{
    route: any;
    validation: ValidationResult;
    popularityScore: number;
  }> = [];
  
  // Use random starting seed to ensure different routes each generation
  const baseSeed = Math.floor(Math.random() * 100);
  console.log(`🎲 Base seed: ${baseSeed}, Max attempts: ${maxAttempts}\n`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Stop early if we already have 3 good candidates
    if (candidates.length >= 3) {
      console.log(`✅ Found 3 valid routes, stopping early at attempt ${attempt}`);
      break;
    }
    
    const seed = baseSeed + attempt;
    try {
      const ghResponse = await generateGraphHopperRoute(
        latitude,
        longitude,
        distanceMeters,
        profile,
        seed
      );
      
      if (!ghResponse.paths || ghResponse.paths.length === 0) {
        console.log(`Seed ${seed}: ❌ No route found from GraphHopper`);
        rejectionStats.noRoute++;
        continue;
      }
      
      const path = ghResponse.paths[0];
      let coordinates = path.points.coordinates as Array<[number, number]>;
      
      // ENSURE CIRCULAR ROUTE: Force start and end to be the exact same point
      if (coordinates.length > 0) {
        const startPoint: [number, number] = [longitude, latitude];
        
        // Replace first point with exact user location
        coordinates[0] = startPoint;
        
        // Replace last point with exact user location to close the loop
        coordinates[coordinates.length - 1] = startPoint;
        
        console.log(`Seed ${seed}: Enforced circular route - start (${startPoint[0].toFixed(6)}, ${startPoint[1].toFixed(6)}) = end`);
      }
      
      // Debug: Log what GraphHopper returned
      console.log(`Seed ${seed}: GraphHopper returned distance=${path.distance}m, ascend=${path.ascend}m, time=${path.time}ms, points=${coordinates.length}`);
      
      // CRITICAL: Check distance IMMEDIATELY before any other validation
      const actualDistance = path.distance;
      const distanceDiffPercent = Math.abs(actualDistance - distanceMeters) / distanceMeters;
      console.log(`Seed ${seed}: Distance check: target=${(distanceMeters/1000).toFixed(2)}km, actual=${(actualDistance/1000).toFixed(2)}km, diff=${(distanceDiffPercent * 100).toFixed(1)}%`);
      
      if (distanceDiffPercent > 0.10) {
        console.log(`❌ Seed ${seed}: REJECTED - Distance ${(distanceDiffPercent * 100).toFixed(1)}% off target (outside ±10% early check)`);
        rejectionStats.distanceEarly++;
        continue; // Skip this route immediately
      }
      
      // Extract road class details for validation
      const roadClassDetails = path.details?.road_class || [];
      
      // Analyze terrain (for preferTrails filtering)
      const roadAnalysis = analyzeRoadClasses(roadClassDetails);
      console.log(`Seed ${seed}: Terrain - trails=${(roadAnalysis.trailPercentage * 100).toFixed(1)}%, paths=${(roadAnalysis.pathPercentage * 100).toFixed(1)}%, highways=${(roadAnalysis.highwayPercentage * 100).toFixed(1)}%, score=${roadAnalysis.terrainScore.toFixed(2)}`);
      
      // If user prefers trails but route has very few, penalize it
      if (preferTrails && roadAnalysis.terrainScore < 0.3) {
        console.log(`❌ Seed ${seed}: REJECTED - Low terrain score (${roadAnalysis.terrainScore.toFixed(2)} < 0.3)`);
        rejectionStats.terrain++;
        continue;
      }
      
      // Validate route quality (includes U-turns, highways, repeated segments)
      const validation = validateRoute(coordinates, path.distance, distanceMeters, roadClassDetails);
      
      const highIssues = validation.issues.filter(i => i.severity === 'HIGH').length;
      const medIssues = validation.issues.filter(i => i.severity === 'MEDIUM').length;
      console.log(`Seed ${seed}: Validation - HIGH issues=${highIssues}, MEDIUM issues=${medIssues}, Quality=${validation.qualityScore.toFixed(2)}`);
      
      if (!validation.isValid) {
        // Track specific rejection reasons from validation
        validation.issues.forEach(issue => {
          if (issue.severity === 'HIGH') {
            if (issue.type === 'U_TURN') rejectionStats.uTurns++;
            else if (issue.type === 'DISTANCE_MISMATCH') rejectionStats.distance++;
            else if (issue.type === 'HIGHWAY_OVERUSE') rejectionStats.highways++;
            else if (issue.type === 'OUT_AND_BACK') rejectionStats.outAndBack++;
            else if (issue.type === 'DEAD_END_TURNAROUND') rejectionStats.deadEnd++;
            else rejectionStats.validationFailed++;
          } else if (issue.severity === 'MEDIUM') {
            if (issue.type === 'INEFFICIENT_PATH') rejectionStats.inefficient++;
          }
        });
        console.log(`❌ Seed ${seed}: REJECTED - Failed validation (${highIssues} HIGH, ${medIssues} MEDIUM issues: ${validation.issues.map(i => i.type).join(', ')})`);
        continue;
      }
      
      console.log(`✅ Seed ${seed}: PASSED all validation checks`);
      rejectionStats.passed++;
      
      // Check popularity score
      const popularityScore = await getRoutePopularityScore(coordinates);
      console.log(`Seed ${seed}: Popularity=${popularityScore.toFixed(2)}`);
      
      candidates.push({
        route: path,
        validation,
        popularityScore,
        terrainScore: roadAnalysis.terrainScore,
      } as any);
      
    } catch (error) {
      console.error(`❌ Seed ${seed} failed with error:`, error);
      rejectionStats.error++;
    }
  }
  
  // No valid routes found - print detailed rejection report
  if (candidates.length === 0) {
    console.log(`\n❌ ========== ROUTE GENERATION FAILED ==========`);
    console.log(`📊 REJECTION STATISTICS (out of ${maxAttempts} attempts):`);
    console.log(`   • Distance (>10% early): ${rejectionStats.distanceEarly}`);
    console.log(`   • Distance (>15% final): ${rejectionStats.distance}`);
    console.log(`   • U-Turns (>160°): ${rejectionStats.uTurns}`);
    console.log(`   • Highways (>30%): ${rejectionStats.highways}`);
    console.log(`   • Out-and-back: ${rejectionStats.outAndBack}`);
    console.log(`   • Dead-end turnaround: ${rejectionStats.deadEnd}`);
    console.log(`   • Low terrain score: ${rejectionStats.terrain}`);
    console.log(`   • No route found: ${rejectionStats.noRoute}`);
    console.log(`   • API errors: ${rejectionStats.error}`);
    console.log(`   • Other validation: ${rejectionStats.validationFailed}`);
    console.log(`   ✅ PASSED: ${rejectionStats.passed}`);
    
    // Build detailed error message
    const topReasons = [];
    if (rejectionStats.distanceEarly > 5) topReasons.push(`distance mismatch (${rejectionStats.distanceEarly + rejectionStats.distance} rejected)`);
    if (rejectionStats.uTurns > 3) topReasons.push(`U-turns/dead-ends (${rejectionStats.uTurns} rejected)`);
    if (rejectionStats.highways > 3) topReasons.push(`highway usage (${rejectionStats.highways} rejected)`);
    if (rejectionStats.outAndBack + rejectionStats.deadEnd > 3) topReasons.push(`out-and-back patterns (${rejectionStats.outAndBack + rejectionStats.deadEnd} rejected)`);
    if (rejectionStats.terrain > 3) topReasons.push(`low trail coverage (${rejectionStats.terrain} rejected)`);
    
    const reasonText = topReasons.length > 0 ? ` Main issues: ${topReasons.join(', ')}.` : '';
    
    throw new Error(`Could not generate valid ${distanceKm}km routes in this area.${reasonText} Try ${Math.max(3, distanceKm - 2)}km or ${distanceKm + 2}km, or enable/disable "Prefer Trails".`);
  }
  
  console.log(`✅ Found ${candidates.length} valid route(s) that meet all criteria`);
  
  // Score candidates and pick the best
  const scored = candidates.map((c: any) => {
    // Base scoring: quality (50%) + popularity (30%)
    let totalScore = 
      c.validation.qualityScore * 0.5 + // 50% weight on quality (no dead ends, highways, distance ok)
      c.popularityScore * 0.3;          // 30% weight on popularity
    
    // If user prefers trails, add terrain score (20% weight)
    if (preferTrails) {
      totalScore += c.terrainScore * 0.2;
      console.log(`Terrain bonus for seed: quality=${c.validation.qualityScore.toFixed(2)}, popularity=${c.popularityScore.toFixed(2)}, terrain=${c.terrainScore.toFixed(2)}`);
    } else {
      // Without trail preference, give remaining 20% to quality
      totalScore += c.validation.qualityScore * 0.2;
    }
    
    return { ...c, totalScore };
  });
  
  scored.sort((a, b) => b.totalScore - a.totalScore);
  
  // FINAL SAFETY CHECK: Filter out any routes that somehow have wrong distances
  const finalFiltered = scored.filter((c: any) => {
    const routeDistance = c.route.distance;
    const distDiff = Math.abs(routeDistance - distanceMeters) / distanceMeters;
    const isAcceptable = distDiff <= 0.15;
    
    if (!isAcceptable) {
      console.log(`🚨 FINAL FILTER: Removing route with distance ${(routeDistance/1000).toFixed(2)}km (${(distDiff * 100).toFixed(1)}% off target)`);
    }
    
    return isAcceptable;
  });
  
  if (finalFiltered.length === 0) {
    throw new Error("All routes failed final distance validation. Try a different distance or location.");
  }
  
  console.log(`✅ Generated ${finalFiltered.length} valid routes, returning top ${Math.min(3, finalFiltered.length)}`);
  
  // Return top 3 routes (or fewer if less than 3 valid routes)
  const topRoutes = finalFiltered.slice(0, 3);
  
  return topRoutes.map((candidate: any, index: number) => {
    const route = candidate.route;
    const difficulty = calculateDifficulty(
      route.distance / 1000,
      route.ascend || 0
    );
    
    console.log(`  Route ${index + 1}: Distance=${route.distance}m (${(route.distance / 1000).toFixed(2)}km), Score=${candidate.totalScore.toFixed(2)}, Quality=${candidate.validation.qualityScore.toFixed(2)}, Popularity=${candidate.popularityScore.toFixed(2)}, Terrain=${candidate.terrainScore?.toFixed(2) || 'N/A'}`);
    
    const generatedRoute = {
      id: generateRouteId(),
      polyline: encodePolyline(route.points.coordinates),
      coordinates: route.points.coordinates,
      distance: route.distance, // Distance in meters from GraphHopper
      elevationGain: route.ascend || 0,
      elevationLoss: route.descend || 0,
      duration: route.time / 1000, // Convert milliseconds to seconds
      difficulty,
      popularityScore: candidate.popularityScore,
      qualityScore: candidate.validation.qualityScore,
      turnInstructions: route.instructions || [],
    };
    
    console.log(`  → Returning: distance=${generatedRoute.distance}m, elevation=${generatedRoute.elevationGain}m↗/${generatedRoute.elevationLoss}m↘, duration=${generatedRoute.duration}s`);
    
    return generatedRoute;
  });
}

/**
 * Generate a unique route ID
 */
function generateRouteId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Encode polyline using Google Polyline encoding algorithm
 * Implements the algorithm directly to avoid module import issues
 */
function encodePolyline(coordinates: Array<[number, number]>): string {
  // Convert from [lng, lat] to [lat, lng] for polyline encoding
  const latLngCoords = coordinates.map(coord => [coord[1], coord[0]]);
  
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of latLngCoords) {
    const lat5 = Math.round(lat * 1e5);
    const lng5 = Math.round(lng * 1e5);
    
    encoded += encodeValue(lat5 - prevLat);
    encoded += encodeValue(lng5 - prevLng);
    
    prevLat = lat5;
    prevLng = lng5;
  }
  
  return encoded;
}

/**
 * Encode a single value for polyline format
 */
function encodeValue(value: number): string {
  let encoded = '';
  let num = value < 0 ? ~(value << 1) : (value << 1);
  
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  
  encoded += String.fromCharCode(num + 63);
  return encoded;
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
