import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteResult {
  success: boolean;
  distance?: number;
  duration?: number;
  polyline?: string;
  instructions?: string[];
  error?: string;
}

interface CalibratedRoute {
  waypoints: LatLng[];
  result: RouteResult;
}

interface CircuitValidation {
  valid: boolean;
  backtrackRatio: number;
  angularSpread: number;
}

interface ElevationData {
  gain: number;
  loss: number;
}

interface GeneratedRoute {
  id: string;
  name: string;
  distance: number;
  duration: number;
  polyline: string;
  waypoints: LatLng[];
  difficulty: 'easy' | 'moderate' | 'hard';
  elevationGain: number;
  elevationLoss: number;
  instructions: string[];
  backtrackRatio: number;
  angularSpread: number;
  templateName: string;
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

export function getDistanceKm(p1: LatLng, p2: LatLng): number {
  const R = 6371;
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(p1.lat)) * Math.cos(toRadians(p2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function decodePolyline(encoded: string): LatLng[] {
  try {
    const decoded = polyline.decode(encoded);
    return decoded.map(([lat, lng]: [number, number]) => ({ lat, lng }));
  } catch (e) {
    return [];
  }
}

export function projectPoint(lat: number, lng: number, bearingDegrees: number, distanceKm: number): LatLng {
  const R = 6371;
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);
  const bearing = toRadians(bearingDegrees);
  const d = distanceKm / R;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

export function getRouteFootprint(encodedPolyline: string): number {
  const points = decodePolyline(encodedPolyline);
  if (points.length < 2) return 0;
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  
  return getDistanceKm({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng });
}

export function calculateBacktrackRatio(encodedPolyline: string): number {
  const points = decodePolyline(encodedPolyline);
  if (points.length < 10) return 0;
  
  const distances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + getDistanceKm(points[i - 1], points[i]));
  }
  const totalDistance = distances[distances.length - 1];
  const excludeDistance = 0.3;
  
  let startIdx = 0;
  let endIdx = points.length - 1;
  
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] >= excludeDistance) {
      startIdx = i;
      break;
    }
  }
  for (let i = distances.length - 1; i >= 0; i--) {
    if (totalDistance - distances[i] >= excludeDistance) {
      endIdx = i;
      break;
    }
  }
  
  if (endIdx <= startIdx + 5) {
    startIdx = 0;
    endIdx = points.length - 1;
  }
  
  const gridSize = 0.0003;
  const directedSegments: string[] = [];
  
  for (let i = startIdx; i < endIdx; i++) {
    const g1 = `${Math.round(points[i].lat / gridSize)},${Math.round(points[i].lng / gridSize)}`;
    const g2 = `${Math.round(points[i + 1].lat / gridSize)},${Math.round(points[i + 1].lng / gridSize)}`;
    if (g1 !== g2) {
      directedSegments.push(`${g1}->${g2}`);
    }
  }
  
  if (directedSegments.length === 0) return 0;
  
  const segmentSet = new Set(directedSegments);
  let backtrackCount = 0;
  
  for (const seg of directedSegments) {
    const parts = seg.split('->');
    const reverse = `${parts[1]}->${parts[0]}`;
    if (segmentSet.has(reverse)) {
      backtrackCount++;
    }
  }
  
  return backtrackCount / directedSegments.length;
}

export function calculateAngularSpread(encodedPolyline: string, startLat: number, startLng: number): number {
  const points = decodePolyline(encodedPolyline);
  if (points.length < 5) return 0;
  
  const bearings: number[] = [];
  for (const point of points) {
    const dLat = point.lat - startLat;
    const dLng = point.lng - startLng;
    if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) continue;
    
    const bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
    const normalizedBearing = ((bearing % 360) + 360) % 360;
    bearings.push(normalizedBearing);
  }
  
  if (bearings.length < 3) return 0;
  
  const sectors = new Set<number>();
  for (const bearing of bearings) {
    sectors.add(Math.floor(bearing / 30));
  }
  
  return sectors.size * 30;
}

export function isGenuineCircuit(encodedPolyline: string, startLat: number, startLng: number): CircuitValidation {
  const backtrackRatio = calculateBacktrackRatio(encodedPolyline);
  const angularSpread = calculateAngularSpread(encodedPolyline, startLat, startLng);
  
  const valid = angularSpread >= 180 && backtrackRatio <= 0.35;
  
  return { valid, backtrackRatio, angularSpread };
}

function getRouteSegments(encodedPolyline: string): Set<string> {
  const points = decodePolyline(encodedPolyline);
  const segments = new Set<string>();
  const gridSize = 0.0005;
  
  for (let i = 0; i < points.length - 1; i++) {
    const g1 = `${Math.round(points[i].lat / gridSize)},${Math.round(points[i].lng / gridSize)}`;
    const g2 = `${Math.round(points[i + 1].lat / gridSize)},${Math.round(points[i + 1].lng / gridSize)}`;
    if (g1 !== g2) {
      segments.add([g1, g2].sort().join("->"));
    }
  }
  
  return segments;
}

export function calculateRouteOverlap(polyline1: string, polyline2: string): number {
  const seg1 = getRouteSegments(polyline1);
  const seg2 = getRouteSegments(polyline2);
  
  if (seg1.size === 0 || seg2.size === 0) return 0;
  
  let overlap = 0;
  seg1.forEach(s => {
    if (seg2.has(s)) overlap++;
  });
  
  return overlap / Math.min(seg1.size, seg2.size);
}

const MAJOR_ROAD_KEYWORDS = ['highway', 'hwy', 'motorway', 'expressway', 'freeway', 'interstate', 'turnpike'];

export function containsMajorRoads(instructions: string[]): boolean {
  for (const instruction of instructions) {
    const lower = instruction.toLowerCase();
    for (const keyword of MAJOR_ROAD_KEYWORDS) {
      if (lower.includes(keyword)) return true;
    }
  }
  return false;
}

export function assignDifficulty(
  backtrackRatio: number,
  hasMajorRoads: boolean,
  elevationGain: number
): 'easy' | 'moderate' | 'hard' {
  let difficulty: 'easy' | 'moderate' | 'hard';
  
  if (backtrackRatio <= 0.25 && !hasMajorRoads) {
    difficulty = 'easy';
  } else {
    difficulty = 'moderate';
  }
  
  if (hasMajorRoads && difficulty === 'easy') {
    difficulty = 'moderate';
  }
  
  if (elevationGain > 100 && difficulty === 'easy') {
    difficulty = 'moderate';
  }
  if (elevationGain > 200) {
    difficulty = 'hard';
  }
  
  return difficulty;
}

interface TemplatePattern {
  name: string;
  waypoints: { bearing: number; radiusMultiplier: number }[];
}

export function getGeometricTemplates(): TemplatePattern[] {
  return [
    { name: 'North Loop', waypoints: [{ bearing: 330, radiusMultiplier: 1.2 }, { bearing: 30, radiusMultiplier: 1.4 }, { bearing: 90, radiusMultiplier: 0.8 }] },
    { name: 'South Loop', waypoints: [{ bearing: 150, radiusMultiplier: 1.2 }, { bearing: 210, radiusMultiplier: 1.4 }, { bearing: 270, radiusMultiplier: 0.8 }] },
    { name: 'East Loop', waypoints: [{ bearing: 45, radiusMultiplier: 1.2 }, { bearing: 90, radiusMultiplier: 1.4 }, { bearing: 135, radiusMultiplier: 0.8 }] },
    { name: 'West Loop', waypoints: [{ bearing: 225, radiusMultiplier: 1.2 }, { bearing: 270, radiusMultiplier: 1.4 }, { bearing: 315, radiusMultiplier: 0.8 }] },
    { name: 'Clockwise Square', waypoints: [{ bearing: 0, radiusMultiplier: 1.4 }, { bearing: 90, radiusMultiplier: 1.4 }, { bearing: 180, radiusMultiplier: 1.4 }, { bearing: 270, radiusMultiplier: 1.4 }] },
    { name: 'Counter-clockwise Square', waypoints: [{ bearing: 270, radiusMultiplier: 1.4 }, { bearing: 180, radiusMultiplier: 1.4 }, { bearing: 90, radiusMultiplier: 1.4 }, { bearing: 0, radiusMultiplier: 1.4 }] },
    { name: 'NE-SW Diagonal', waypoints: [{ bearing: 45, radiusMultiplier: 1.8 }, { bearing: 225, radiusMultiplier: 1.8 }] },
    { name: 'NW-SE Diagonal', waypoints: [{ bearing: 315, radiusMultiplier: 1.8 }, { bearing: 135, radiusMultiplier: 1.8 }] },
    { name: 'Pentagon', waypoints: [{ bearing: 0, radiusMultiplier: 1.3 }, { bearing: 72, radiusMultiplier: 1.3 }, { bearing: 144, radiusMultiplier: 1.3 }, { bearing: 216, radiusMultiplier: 1.3 }, { bearing: 288, radiusMultiplier: 1.3 }] },
    { name: 'Figure-8 NS', waypoints: [{ bearing: 0, radiusMultiplier: 1.0 }, { bearing: 45, radiusMultiplier: 0.5 }, { bearing: 180, radiusMultiplier: 1.0 }, { bearing: 225, radiusMultiplier: 0.5 }] },
    { name: 'Figure-8 EW', waypoints: [{ bearing: 90, radiusMultiplier: 1.0 }, { bearing: 135, radiusMultiplier: 0.5 }, { bearing: 270, radiusMultiplier: 1.0 }, { bearing: 315, radiusMultiplier: 0.5 }] },
    { name: 'North Reach', waypoints: [{ bearing: 350, radiusMultiplier: 2.0 }, { bearing: 10, radiusMultiplier: 1.5 }, { bearing: 30, radiusMultiplier: 0.8 }] },
    { name: 'South Reach', waypoints: [{ bearing: 170, radiusMultiplier: 2.0 }, { bearing: 190, radiusMultiplier: 1.5 }, { bearing: 210, radiusMultiplier: 0.8 }] },
    { name: 'Hexagon', waypoints: [{ bearing: 0, radiusMultiplier: 1.2 }, { bearing: 60, radiusMultiplier: 1.2 }, { bearing: 120, radiusMultiplier: 1.2 }, { bearing: 180, radiusMultiplier: 1.2 }, { bearing: 240, radiusMultiplier: 1.2 }, { bearing: 300, radiusMultiplier: 1.2 }] },
    { name: 'East Heavy', waypoints: [{ bearing: 30, radiusMultiplier: 0.8 }, { bearing: 90, radiusMultiplier: 1.8 }, { bearing: 150, radiusMultiplier: 0.8 }] },
    { name: 'West Heavy', waypoints: [{ bearing: 210, radiusMultiplier: 0.8 }, { bearing: 270, radiusMultiplier: 1.8 }, { bearing: 330, radiusMultiplier: 0.8 }] },
    { name: 'Triangle North', waypoints: [{ bearing: 0, radiusMultiplier: 1.6 }, { bearing: 120, radiusMultiplier: 1.2 }, { bearing: 240, radiusMultiplier: 1.2 }] },
    { name: 'Triangle South', waypoints: [{ bearing: 180, radiusMultiplier: 1.6 }, { bearing: 60, radiusMultiplier: 1.2 }, { bearing: 300, radiusMultiplier: 1.2 }] },
    { name: 'Octagon Circuit', waypoints: [{ bearing: 0, radiusMultiplier: 1.1 }, { bearing: 45, radiusMultiplier: 1.1 }, { bearing: 90, radiusMultiplier: 1.1 }, { bearing: 135, radiusMultiplier: 1.1 }, { bearing: 180, radiusMultiplier: 1.1 }, { bearing: 225, radiusMultiplier: 1.1 }, { bearing: 270, radiusMultiplier: 1.1 }, { bearing: 315, radiusMultiplier: 1.1 }] },
    { name: 'Large Octagon', waypoints: [{ bearing: 0, radiusMultiplier: 1.5 }, { bearing: 45, radiusMultiplier: 1.5 }, { bearing: 90, radiusMultiplier: 1.5 }, { bearing: 135, radiusMultiplier: 1.5 }, { bearing: 180, radiusMultiplier: 1.5 }, { bearing: 225, radiusMultiplier: 1.5 }, { bearing: 270, radiusMultiplier: 1.5 }, { bearing: 315, radiusMultiplier: 1.5 }] },
    { name: 'North-South Circuit', waypoints: [{ bearing: 0, radiusMultiplier: 1.4 }, { bearing: 60, radiusMultiplier: 0.8 }, { bearing: 120, radiusMultiplier: 0.8 }, { bearing: 180, radiusMultiplier: 1.4 }, { bearing: 240, radiusMultiplier: 0.8 }, { bearing: 300, radiusMultiplier: 0.8 }] },
    { name: 'East-West Circuit', waypoints: [{ bearing: 90, radiusMultiplier: 1.4 }, { bearing: 30, radiusMultiplier: 0.8 }, { bearing: 330, radiusMultiplier: 0.8 }, { bearing: 270, radiusMultiplier: 1.4 }, { bearing: 210, radiusMultiplier: 0.8 }, { bearing: 150, radiusMultiplier: 0.8 }] },
    { name: 'Cloverleaf', waypoints: [{ bearing: 0, radiusMultiplier: 1.5 }, { bearing: 45, radiusMultiplier: 0.6 }, { bearing: 90, radiusMultiplier: 1.5 }, { bearing: 135, radiusMultiplier: 0.6 }, { bearing: 180, radiusMultiplier: 1.5 }, { bearing: 225, radiusMultiplier: 0.6 }, { bearing: 270, radiusMultiplier: 1.5 }, { bearing: 315, radiusMultiplier: 0.6 }] },
    { name: 'Diamond Extended', waypoints: [{ bearing: 0, radiusMultiplier: 1.8 }, { bearing: 45, radiusMultiplier: 0.9 }, { bearing: 90, radiusMultiplier: 1.8 }, { bearing: 135, radiusMultiplier: 0.9 }, { bearing: 180, radiusMultiplier: 1.8 }, { bearing: 225, radiusMultiplier: 0.9 }, { bearing: 270, radiusMultiplier: 1.8 }, { bearing: 315, radiusMultiplier: 0.9 }] },
    { name: 'Wide North Arc', waypoints: [{ bearing: 315, radiusMultiplier: 2.0 }, { bearing: 0, radiusMultiplier: 2.2 }, { bearing: 45, radiusMultiplier: 2.0 }] },
    { name: 'Wide South Arc', waypoints: [{ bearing: 135, radiusMultiplier: 2.0 }, { bearing: 180, radiusMultiplier: 2.2 }, { bearing: 225, radiusMultiplier: 2.0 }] },
    { name: 'Wide East Arc', waypoints: [{ bearing: 45, radiusMultiplier: 2.0 }, { bearing: 90, radiusMultiplier: 2.2 }, { bearing: 135, radiusMultiplier: 2.0 }] },
    { name: 'Wide West Arc', waypoints: [{ bearing: 225, radiusMultiplier: 2.0 }, { bearing: 270, radiusMultiplier: 2.2 }, { bearing: 315, radiusMultiplier: 2.0 }] },
    { name: 'Expanded Square', waypoints: [{ bearing: 0, radiusMultiplier: 2.0 }, { bearing: 90, radiusMultiplier: 2.0 }, { bearing: 180, radiusMultiplier: 2.0 }, { bearing: 270, radiusMultiplier: 2.0 }] },
    { name: 'Large Pentagon', waypoints: [{ bearing: 0, radiusMultiplier: 1.8 }, { bearing: 72, radiusMultiplier: 1.8 }, { bearing: 144, radiusMultiplier: 1.8 }, { bearing: 216, radiusMultiplier: 1.8 }, { bearing: 288, radiusMultiplier: 1.8 }] },
    { name: 'Scenic Triangle', waypoints: [{ bearing: 30, radiusMultiplier: 2.2 }, { bearing: 150, radiusMultiplier: 2.2 }, { bearing: 270, radiusMultiplier: 2.2 }] },
    { name: 'Explorer Loop', waypoints: [{ bearing: 20, radiusMultiplier: 1.6 }, { bearing: 100, radiusMultiplier: 1.4 }, { bearing: 200, radiusMultiplier: 1.6 }, { bearing: 280, radiusMultiplier: 1.4 }] },
  ];
}

export function generateTemplateWaypoints(
  startLat: number,
  startLng: number,
  baseRadius: number,
  template: TemplatePattern
): LatLng[] {
  return template.waypoints.map(wp => 
    projectPoint(startLat, startLng, wp.bearing, baseRadius * wp.radiusMultiplier)
  );
}

async function fetchGoogleDirections(
  origin: LatLng,
  waypoints: LatLng[],
  optimize: boolean = true
): Promise<RouteResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    return { success: false, error: 'Google Maps API key not configured' };
  }
  
  try {
    const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    const optimizeParam = optimize ? 'optimize:true|' : '';
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}` +
      `&destination=${origin.lat},${origin.lng}` +
      `&waypoints=${optimizeParam}${waypointsStr}` +
      `&mode=walking` +
      `&avoid=highways` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return { success: false, error: data.status || 'No routes found' };
    }
    
    const route = data.routes[0];
    const legs = route.legs;
    
    let totalDistance = 0;
    let totalDuration = 0;
    const instructions: string[] = [];
    
    for (const leg of legs) {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      for (const step of leg.steps) {
        instructions.push(step.html_instructions.replace(/<[^>]*>/g, ''));
      }
    }
    
    return {
      success: true,
      distance: totalDistance / 1000,
      duration: Math.round(totalDuration / 60),
      polyline: route.overview_polyline.points,
      instructions,
    };
  } catch (error: any) {
    console.error('Google Directions API error:', error);
    return { success: false, error: error.message };
  }
}

async function calibrateRoute(
  startLat: number,
  startLng: number,
  baseWaypoints: LatLng[],
  targetDistance: number,
  optimize: boolean = false
): Promise<CalibratedRoute | null> {
  let scale = 1.0;
  let minScale = 0.1;  // Allow smaller routes
  let maxScale = 5.0;  // Cap maximum expansion
  
  let bestResult: CalibratedRoute | null = null;
  let bestError = Infinity;
  let apiErrors: string[] = [];
  let successfulCalls = 0;
  
  const origin = { lat: startLat, lng: startLng };
  
  // More iterations for better convergence
  for (let i = 0; i < 10; i++) {
    const scaledWaypoints = baseWaypoints.map(wp => ({
      lat: startLat + (wp.lat - startLat) * scale,
      lng: startLng + (wp.lng - startLng) * scale,
    }));
    
    const result = await fetchGoogleDirections(origin, scaledWaypoints, optimize);
    
    if (!result.success || !result.distance) {
      if (result.error) apiErrors.push(`${result.error} (scale=${scale.toFixed(2)})`);
      // On failure, try to reduce scale (routes might be too spread out)
      maxScale = scale;
      scale = (minScale + maxScale) / 2;
      continue;
    }
    
    successfulCalls++;
    const error = Math.abs(result.distance - targetDistance) / targetDistance;
    
    if (error < bestError) {
      bestError = error;
      bestResult = { waypoints: scaledWaypoints, result };
    }
    
    // Early exit if within 15% tolerance
    if (error < 0.15) {
      return { waypoints: scaledWaypoints, result };
    }
    
    // Binary search adjustment
    if (result.distance < targetDistance) {
      minScale = scale;
    } else {
      maxScale = scale;
    }
    scale = (minScale + maxScale) / 2;
  }
  
  // Accept if within 25% tolerance (was 50%)
  const MAX_ERROR_TOLERANCE = 0.25;
  
  if (!bestResult) {
    console.log(`[RouteGen] Calibration failed: ${successfulCalls}/10 API calls succeeded. Errors: ${apiErrors.slice(0, 3).join('; ')}`);
  } else if (bestError >= MAX_ERROR_TOLERANCE) {
    console.log(`[RouteGen] Calibration failed: best error ${(bestError * 100).toFixed(1)}% exceeds ${(MAX_ERROR_TOLERANCE * 100).toFixed(0)}% threshold (dist=${bestResult.result.distance?.toFixed(2)}km, target=${targetDistance}km)`);
  }
  
  return (bestResult && bestError < MAX_ERROR_TOLERANCE) ? bestResult : null;
}

async function fetchElevationForRoute(encodedPolyline: string): Promise<ElevationData> {
  if (!GOOGLE_MAPS_API_KEY) return { gain: 0, loss: 0 };
  
  try {
    const points = decodePolyline(encodedPolyline);
    if (points.length < 2) return { gain: 0, loss: 0 };
    
    const samplePoints = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 50)) === 0);
    const path = samplePoints.map(p => `${p.lat},${p.lng}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/elevation/json?path=${encodeURIComponent(path)}&samples=${samplePoints.length}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results) return { gain: 0, loss: 0 };
    
    let totalGain = 0;
    let totalLoss = 0;
    for (let i = 1; i < data.results.length; i++) {
      const diff = data.results[i].elevation - data.results[i - 1].elevation;
      if (diff > 0) {
        totalGain += diff;
      } else {
        totalLoss += Math.abs(diff);
      }
    }
    
    return { gain: Math.round(totalGain), loss: Math.round(totalLoss) };
  } catch (error) {
    console.error('Elevation API error:', error);
    return { gain: 0, loss: 0 };
  }
}

interface CandidateRoute {
  template: TemplatePattern;
  calibrated: CalibratedRoute;
  backtrackRatio: number;
  angularSpread: number;
}

export async function generateRouteOptions(
  startLat: number,
  startLng: number,
  targetDistanceKm: number,
  activityType: string = 'run'
): Promise<GeneratedRoute[]> {
  console.log(`[RouteGen] Starting route generation for ${targetDistanceKm}km ${activityType}`);
  
  // Reduce baseRadius significantly - Google routes meander so actual distance is 2-3x straight line
  const baseRadius = targetDistanceKm / 4.0;
  const templates = getGeometricTemplates();
  const shuffledTemplates = templates.sort(() => Math.random() - 0.5);
  
  const MIN_ROUTES = 3;
  const MAX_ROUTES = 5;
  const maxOverlap = 0.40;
  
  const candidates: CandidateRoute[] = [];
  
  console.log(`[RouteGen] Evaluating ${shuffledTemplates.length} templates...`);
  
  for (const template of shuffledTemplates) {
    try {
      console.log(`[RouteGen] Trying template: ${template.name}`);
      const baseWaypoints = generateTemplateWaypoints(startLat, startLng, baseRadius, template);
      const calibrated = await calibrateRoute(startLat, startLng, baseWaypoints, targetDistanceKm);
      
      if (!calibrated) {
        console.log(`[RouteGen] ${template.name}: calibration returned null`);
        continue;
      }
      if (!calibrated.result.polyline) {
        console.log(`[RouteGen] ${template.name}: no polyline in result`);
        continue;
      }
      
      const { backtrackRatio, angularSpread } = isGenuineCircuit(
        calibrated.result.polyline,
        startLat,
        startLng
      );
      
      candidates.push({
        template,
        calibrated,
        backtrackRatio,
        angularSpread,
      });
      
      console.log(`[RouteGen] Candidate ${template.name}: backtrack=${(backtrackRatio * 100).toFixed(1)}%, angular=${angularSpread}°`);
      
    } catch (error) {
      console.error(`[RouteGen] Error with template ${template.name}:`, error);
    }
  }
  
  candidates.sort((a, b) => a.backtrackRatio - b.backtrackRatio);
  
  console.log(`[RouteGen] Found ${candidates.length} candidates, selecting best ${MIN_ROUTES}-${MAX_ROUTES} routes...`);
  
  const validRoutes: GeneratedRoute[] = [];
  const usedTemplates = new Set<string>();
  
  for (const candidate of candidates) {
    if (validRoutes.length >= MAX_ROUTES) break;
    
    if (usedTemplates.has(candidate.template.name)) continue;
    
    let isTooSimilar = false;
    for (const existing of validRoutes) {
      const overlap = calculateRouteOverlap(candidate.calibrated.result.polyline!, existing.polyline);
      if (overlap > maxOverlap) {
        isTooSimilar = true;
        break;
      }
    }
    
    if (isTooSimilar) {
      console.log(`[RouteGen] ${candidate.template.name} rejected: too similar to existing route`);
      continue;
    }
    
    const instructions = candidate.calibrated.result.instructions || [];
    const hasMajorRoads = containsMajorRoads(instructions);
    const elevation = await fetchElevationForRoute(candidate.calibrated.result.polyline!);
    const difficulty = assignDifficulty(candidate.backtrackRatio, hasMajorRoads, elevation.gain);
    
    const route: GeneratedRoute = {
      id: `route_${Date.now()}_${validRoutes.length}`,
      name: `${candidate.template.name} Route`,
      distance: candidate.calibrated.result.distance!,
      duration: candidate.calibrated.result.duration!,
      polyline: candidate.calibrated.result.polyline!,
      waypoints: candidate.calibrated.waypoints,
      difficulty,
      elevationGain: elevation.gain,
      elevationLoss: elevation.loss,
      instructions,
      backtrackRatio: candidate.backtrackRatio,
      angularSpread: candidate.angularSpread,
      templateName: candidate.template.name,
    };
    
    validRoutes.push(route);
    usedTemplates.add(candidate.template.name);
    console.log(`[RouteGen] Selected ${candidate.template.name}: ${route.distance.toFixed(2)}km, backtrack=${(candidate.backtrackRatio * 100).toFixed(1)}%, climb=${elevation.gain}m`);
  }
  
  console.log(`[RouteGen] Generated ${validRoutes.length} routes (target: ${MIN_ROUTES}-${MAX_ROUTES})`);
  
  return validRoutes.slice(0, MAX_ROUTES);
}
