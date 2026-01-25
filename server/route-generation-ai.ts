import OpenAI from 'openai';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

interface LatLng {
  lat: number;
  lng: number;
}

interface AIGeneratedRoute {
  id: string;
  name: string;
  waypoints: LatLng[];
  reasoning: string;
  estimatedDistance: number;
  circuitType: string;
}

interface EnhancedRoute {
  id: string;
  name: string;
  distance: number;
  duration: number;
  polyline: string;
  waypoints: LatLng[];
  difficulty: string;
  elevationGain: number;
  elevationLoss: number;
  maxGradientPercent: number;
  maxGradientDegrees: number;
  instructions: string[];
  turnInstructions: any[];
  circuitQuality: {
    backtrackRatio: number;
    angularSpread: number;
    loopQuality: number;
  };
  aiReasoning: string;
}

/**
 * Use OpenAI to intelligently design circuit routes with proper loops
 * This solves the Google Directions API limitation of creating out-and-back routes
 */
export async function generateAIRoutesWithGoogle(
  startLat: number,
  startLng: number,
  targetDistanceKm: number,
  activityType: string = 'run'
): Promise<EnhancedRoute[]> {
  console.log(`[AI Route Gen] 🤖 Using OpenAI to design ${targetDistanceKm}km circuits`);
  
  // Step 1: Get nearby features from Google Places
  const nearbyFeatures = await discoverNearbyFeatures(startLat, startLng, targetDistanceKm);
  
  // Step 2: Use OpenAI to design 5 intelligent circuit routes
  const aiRoutes = await designCircuitsWithAI(startLat, startLng, targetDistanceKm, nearbyFeatures);
  
  console.log(`[AI Route Gen] 🎨 OpenAI designed ${aiRoutes.length} circuit routes`);
  
  // Step 3: Use Google Directions to get actual routing, elevation, navigation
  const enhancedRoutes: EnhancedRoute[] = [];
  
  for (const aiRoute of aiRoutes) {
    try {
      const googleRoute = await executeRouteWithGoogle(
        { lat: startLat, lng: startLng },
        aiRoute.waypoints
      );
      
      if (googleRoute && googleRoute.success) {
        // Verify it's actually a decent circuit
        const loopQuality = calculateLoopQuality({ lat: startLat, lng: startLng }, googleRoute.polyline!);
        const backtrackRatio = calculateBacktrackRatio(googleRoute.polyline!);
        const distanceError = Math.abs(googleRoute.distance! - targetDistanceKm) / targetDistanceKm;
        
        // Less strict filtering since AI designed it intelligently
        if (distanceError < 0.40 && backtrackRatio < 0.50 && loopQuality > 0.5) {
          const elevation = await fetchElevation(googleRoute.polyline!);
          
          enhancedRoutes.push({
            id: aiRoute.id,
            name: aiRoute.name,
            distance: googleRoute.distance!,
            duration: googleRoute.duration!,
            polyline: googleRoute.polyline!,
            waypoints: aiRoute.waypoints,
            difficulty: determineDifficulty(elevation.gain, backtrackRatio),
            elevationGain: elevation.gain,
            elevationLoss: elevation.loss,
            maxGradientPercent: elevation.maxGradientPercent,
            maxGradientDegrees: elevation.maxGradientDegrees,
            instructions: googleRoute.instructions || [],
            turnInstructions: googleRoute.turnInstructions || [],
            circuitQuality: {
              backtrackRatio,
              angularSpread: calculateAngularSpread(googleRoute.polyline!, startLat, startLng),
              loopQuality,
            },
            aiReasoning: aiRoute.reasoning,
          });
          
          console.log(`[AI Route Gen] ✅ ${aiRoute.name}: ${googleRoute.distance!.toFixed(1)}km, loop=${loopQuality.toFixed(2)}, backtrack=${(backtrackRatio * 100).toFixed(0)}%`);
        } else {
          console.log(`[AI Route Gen] ❌ ${aiRoute.name}: Filtered (distance=${distanceError.toFixed(2)}, backtrack=${backtrackRatio.toFixed(2)}, loop=${loopQuality.toFixed(2)})`);
        }
      }
    } catch (error) {
      console.error(`[AI Route Gen] Error processing ${aiRoute.name}:`, error);
    }
  }
  
  console.log(`[AI Route Gen] 📊 Generated ${enhancedRoutes.length} valid routes, selecting top 5 with difficulty variety...`);
  
  // Filter to top 5 with variety in difficulty (easy, moderate, hard)
  const selectedRoutes = selectTopRoutesWithVariety(enhancedRoutes);
  
  console.log(`[AI Route Gen] 🎉 Returning ${selectedRoutes.length} high-quality AI-designed circuits`);
  
  return selectedRoutes;
}

/**
 * Select top 5 routes ensuring variety in difficulty levels
 */
function selectTopRoutesWithVariety(routes: EnhancedRoute[]): EnhancedRoute[] {
  if (routes.length <= 5) return routes;
  
  // Group by difficulty
  const easy = routes.filter(r => r.difficulty === 'easy');
  const moderate = routes.filter(r => r.difficulty === 'moderate');
  const hard = routes.filter(r => r.difficulty === 'hard');
  
  // Sort each by distance (low to high) as secondary sort
  const sortByDistance = (a: EnhancedRoute, b: EnhancedRoute) => 
    a.distance - b.distance;
  
  easy.sort(sortByDistance);
  moderate.sort(sortByDistance);
  hard.sort(sortByDistance);
  
  const selected: EnhancedRoute[] = [];
  
  // Aim for: 2 easy, 2 moderate, 1 hard (adjust based on availability)
  selected.push(...easy.slice(0, 2));
  selected.push(...moderate.slice(0, 2));
  selected.push(...hard.slice(0, 1));
  
  // If we don't have 5, fill with best remaining (sorted by distance)
  if (selected.length < 5) {
    const remaining = routes
      .filter(r => !selected.includes(r))
      .sort(sortByDistance);
    selected.push(...remaining.slice(0, 5 - selected.length));
  }
  
  console.log(`[AI Route Gen] ✨ Selected: ${selected.filter(r => r.difficulty === 'easy').length} easy, ${selected.filter(r => r.difficulty === 'moderate').length} moderate, ${selected.filter(r => r.difficulty === 'hard').length} hard`);
  
  // Final sort: Easy first, then Moderate, then Hard (each group already sorted by distance)
  const finalOrder = [
    ...selected.filter(r => r.difficulty === 'easy'),
    ...selected.filter(r => r.difficulty === 'moderate'),
    ...selected.filter(r => r.difficulty === 'hard')
  ];
  
  return finalOrder.slice(0, 5);
}

/**
 * Discover nearby features to give AI context about the area
 */
async function discoverNearbyFeatures(lat: number, lng: number, distance: number) {
  if (!GOOGLE_MAPS_API_KEY) return [];
  
  const searchRadius = distance * 1000 * 0.4; // 40% of distance
  
  try {
    const types = ['park', 'point_of_interest', 'natural_feature'];
    const allFeatures: any[] = [];
    
    for (const type of types) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `location=${lat},${lng}&radius=${searchRadius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results) {
        allFeatures.push(...data.results.map((place: any) => ({
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          type: place.types[0],
          rating: place.rating,
        })));
      }
    }
    
    console.log(`[AI Route Gen] 📍 Found ${allFeatures.length} nearby features for AI context`);
    return allFeatures.slice(0, 20); // Top 20 features
  } catch (error) {
    console.error('[AI Route Gen] Error fetching features:', error);
    return [];
  }
}

/**
 * Use OpenAI to design intelligent circuit routes
 */
async function designCircuitsWithAI(
  startLat: number,
  startLng: number,
  targetDistance: number,
  nearbyFeatures: any[]
): Promise<AIGeneratedRoute[]> {
  
  const featuresContext = nearbyFeatures.length > 0
    ? nearbyFeatures.map(f => `- ${f.name} (${f.type}) at ${f.lat},${f.lng}`).join('\n')
    : 'No specific features found - design routes using street grid patterns';
  
  const prompt = `You are an expert route designer for runners. Design 10 DIVERSE circuit routes that form TRUE LOOPS (returning to start point).

LOCATION: ${startLat}, ${startLng}
TARGET DISTANCE: ${targetDistance}km
NEARBY FEATURES:
${featuresContext}

CRITICAL REQUIREMENTS:
1. Each route MUST be a CIRCUIT/LOOP - the last waypoint should be close to the start (within 200m)
2. Waypoints should form a LARGE circular pattern with good radius coverage - NOT small tight loops
3. Space waypoints approximately ${(targetDistance * 0.18).toFixed(2)}km apart (Google adds 2-3x distance for street routing)
4. Each route should use 4-6 waypoints to form the loop
5. Make routes DIVERSE - different directions, VARIED SIZES (some large, some medium), different patterns
6. IMPORTANT: Waypoints should spread out from the start point - use the full search radius available
7. Consider terrain variety - parks, trails, waterfront if available
8. Avoid tight/small loops - routes should explore the area broadly

ROUTE PATTERNS TO USE (WITH VARIED SIZES):
- Clockwise loops (VARY radius: some large 70-80%, some medium 50-60%)
- Counter-clockwise loops (VARY radius to create diversity)
- Figure-8 patterns (two distinct loops)
- Elongated ovals (north-south or east-west, LARGE coverage)
- Square/pentagon patterns (corners in different compass directions)
- Routes through parks/green spaces if available

CRITICAL: Make 4-5 routes with LARGE radius (waypoints 60-80% of search distance from start)
         Make 3-4 routes with MEDIUM radius (waypoints 40-60% of search distance)
         Make 2-3 routes with VARIED patterns (different shapes)

Return a JSON array of exactly 10 routes with VARIED SIZES and difficulties:
[
  {
    "name": "Descriptive route name",
    "waypoints": [
      {"lat": number, "lng": number},
      {"lat": number, "lng": number},
      ... 4-6 waypoints total forming a circuit
    ],
    "reasoning": "Why this route forms a good circuit",
    "estimatedDistance": ${targetDistance},
    "circuitType": "clockwise-loop" or "figure-8" or "oval" etc
  }
]

IMPORTANT: Ensure waypoints form actual circles/loops, not straight lines!`;

  try {
    console.log(`[AI Route Gen] 🤖 Asking OpenAI to design 5 intelligent circuits...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert running route designer specializing in creating circular loop routes. You understand geography, street patterns, and how to create safe, interesting running circuits.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Higher creativity for route variety
    });
    
    const responseText = completion.choices[0].message.content;
    const parsed = JSON.parse(responseText || '{}');
    const routes = parsed.routes || [];
    
    console.log(`[AI Route Gen] ✨ OpenAI designed ${routes.length} routes`);
    
    return routes.map((route: any, idx: number) => ({
      id: `ai_route_${Date.now()}_${idx}`,
      name: route.name || `AI Circuit ${idx + 1}`,
      waypoints: route.waypoints || [],
      reasoning: route.reasoning || 'AI-designed circuit',
      estimatedDistance: route.estimatedDistance || targetDistance,
      circuitType: route.circuitType || 'loop',
    }));
    
  } catch (error) {
    console.error('[AI Route Gen] OpenAI error:', error);
    // Fallback to geometric patterns if AI fails
    return generateFallbackCircuits(startLat, startLng, targetDistance);
  }
}

/**
 * Fallback geometric circuits if OpenAI fails
 */
function generateFallbackCircuits(startLat: number, startLng: number, distance: number): AIGeneratedRoute[] {
  const radius = distance * 0.15; // Conservative radius
  
  const patterns = [
    { name: 'Square Loop', angles: [0, 90, 180, 270], type: 'square' },
    { name: 'Pentagon Circuit', angles: [0, 72, 144, 216, 288], type: 'pentagon' },
    { name: 'Hexagon Loop', angles: [0, 60, 120, 180, 240, 300], type: 'hexagon' },
    { name: 'North-South Oval', angles: [0, 45, 135, 180, 225, 315], type: 'oval' },
    { name: 'East-West Oval', angles: [90, 135, 225, 270, 315, 45], type: 'oval' },
  ];
  
  return patterns.map((pattern, idx) => ({
    id: `fallback_${Date.now()}_${idx}`,
    name: pattern.name,
    waypoints: pattern.angles.map(angle => projectPoint(startLat, startLng, angle, radius)),
    reasoning: `Geometric ${pattern.type} pattern as fallback`,
    estimatedDistance: distance,
    circuitType: pattern.type,
  }));
}

function projectPoint(lat: number, lng: number, bearingDegrees: number, distanceKm: number): LatLng {
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

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

/**
 * Execute AI-designed route with Google Directions
 */
async function executeRouteWithGoogle(start: LatLng, waypoints: LatLng[]) {
  if (!GOOGLE_MAPS_API_KEY) {
    return { success: false, error: 'No API key' };
  }
  
  try {
    const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${start.lat},${start.lng}` +
      `&destination=${start.lat},${start.lng}` +
      `&waypoints=${waypointsStr}` +
      `&mode=walking` +
      `&alternatives=true` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return { success: false, error: data.status };
    }
    
    // Pick best alternative (most varied)
    const route = data.routes[0];
    const legs = route.legs;
    
    let totalDistance = 0;
    let totalDuration = 0;
    const instructions: string[] = [];
    const turnInstructions: any[] = [];
    
    for (const leg of legs) {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      for (const step of leg.steps) {
        const inst = step.html_instructions.replace(/<[^>]*>/g, '');
        instructions.push(inst);
        turnInstructions.push({
          instruction: inst,
          lat: step.start_location.lat,
          lng: step.start_location.lng,
          distance: totalDistance,
        });
      }
    }
    
    return {
      success: true,
      distance: totalDistance / 1000,
      duration: Math.round(totalDuration / 60),
      polyline: route.overview_polyline.points,
      instructions,
      turnInstructions,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function fetchElevation(encodedPolyline: string) {
  if (!GOOGLE_MAPS_API_KEY) {
    return { gain: 0, loss: 0, maxGradientPercent: 0, maxGradientDegrees: 0 };
  }
  
  try {
    const points = decodePolyline(encodedPolyline);
    if (points.length < 2) {
      return { gain: 0, loss: 0, maxGradientPercent: 0, maxGradientDegrees: 0 };
    }
    
    // Sample points for elevation (max 50 samples for API efficiency)
    const samplePoints = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 50)) === 0);
    const path = samplePoints.map(p => `${p.lat},${p.lng}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/elevation/json?path=${encodeURIComponent(path)}&samples=${samplePoints.length}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results) {
      return { gain: 0, loss: 0, maxGradientPercent: 0, maxGradientDegrees: 0 };
    }
    
    let totalGain = 0;
    let totalLoss = 0;
    let maxGradientPercent = 0;
    
    for (let i = 1; i < data.results.length; i++) {
      const elevDiff = data.results[i].elevation - data.results[i - 1].elevation;
      if (elevDiff > 0) {
        totalGain += elevDiff;
      } else {
        totalLoss += Math.abs(elevDiff);
      }
      
      // Calculate gradient
      const horizontalDistance = getDistanceKm(samplePoints[i - 1], samplePoints[i]) * 1000; // meters
      if (horizontalDistance > 5) {
        const gradientPercent = Math.abs(elevDiff / horizontalDistance) * 100;
        if (gradientPercent > maxGradientPercent) {
          maxGradientPercent = gradientPercent;
        }
      }
    }
    
    const maxGradientDegrees = Math.atan(maxGradientPercent / 100) * (180 / Math.PI);
    
    return {
      gain: Math.round(totalGain),
      loss: Math.round(totalLoss),
      maxGradientPercent: Math.round(maxGradientPercent * 10) / 10,
      maxGradientDegrees: Math.round(maxGradientDegrees * 10) / 10,
    };
  } catch (error) {
    console.error('[AI Route Gen] Elevation error:', error);
    return { gain: 0, loss: 0, maxGradientPercent: 0, maxGradientDegrees: 0 };
  }
}

function calculateLoopQuality(start: LatLng, polylineStr: string): number {
  const points = decodePolyline(polylineStr);
  if (points.length < 2) return 0;
  
  const endPoint = points[points.length - 1];
  const distanceKm = getDistanceKm(start, endPoint);
  
  return Math.max(0, 1 - (distanceKm / 0.5));
}

function calculateBacktrackRatio(polylineStr: string): number {
  const points = decodePolyline(polylineStr);
  if (points.length < 10) return 0;
  
  const gridSize = 0.0003;
  const segments: string[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const g1 = `${Math.round(points[i].lat / gridSize)},${Math.round(points[i].lng / gridSize)}`;
    const g2 = `${Math.round(points[i + 1].lat / gridSize)},${Math.round(points[i + 1].lng / gridSize)}`;
    if (g1 !== g2) {
      segments.push(`${g1}->${g2}`);
    }
  }
  
  const segmentSet = new Set(segments);
  let backtrackCount = 0;
  
  for (const seg of segments) {
    const parts = seg.split('->');
    const reverse = `${parts[1]}->${parts[0]}`;
    if (segmentSet.has(reverse)) {
      backtrackCount++;
    }
  }
  
  return backtrackCount / segments.length;
}

function calculateAngularSpread(polylineStr: string, startLat: number, startLng: number): number {
  const points = decodePolyline(polylineStr);
  if (points.length < 5) return 0;
  
  const bearings: number[] = [];
  for (const point of points) {
    const dLat = point.lat - startLat;
    const dLng = point.lng - startLng;
    if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) continue;
    
    const bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
    bearings.push(((bearing % 360) + 360) % 360);
  }
  
  const sectors = new Set(bearings.map(b => Math.floor(b / 30)));
  return sectors.size * 30;
}

function decodePolyline(encoded: string): LatLng[] {
  try {
    const decoded = polyline.decode(encoded);
    return decoded.map(([lat, lng]: [number, number]) => ({ lat, lng }));
  } catch (e) {
    return [];
  }
}

function getDistanceKm(p1: LatLng, p2: LatLng): number {
  const R = 6371;
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(p1.lat)) * Math.cos(toRadians(p2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function determineDifficulty(elevationGain: number, backtrackRatio: number): string {
  if (elevationGain > 150 || backtrackRatio > 0.3) return 'hard';
  if (elevationGain > 75 || backtrackRatio > 0.2) return 'moderate';
  return 'easy';
}
