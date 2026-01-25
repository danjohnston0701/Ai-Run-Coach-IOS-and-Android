import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteAnalysis {
  hasDeadEnds: boolean;
  isLinear: boolean;
  circuitQuality: 'excellent' | 'good' | 'poor';
  issues: string[];
  suggestedWaypoints?: LatLng[];
}

/**
 * Uses OpenAI to analyze a route and suggest improvements
 * to eliminate dead-ends and create better circuits
 */
export async function refineRouteWithAI(
  startPoint: LatLng,
  waypoints: LatLng[],
  routePolyline: string,
  targetDistance: number
): Promise<RouteAnalysis> {
  try {
    const prompt = `You are a running route optimization expert. Analyze this running route and suggest improvements to eliminate dead-ends and create a proper circuit/loop.

START POINT: ${startPoint.lat}, ${startPoint.lng}
CURRENT WAYPOINTS: ${JSON.stringify(waypoints)}
TARGET DISTANCE: ${targetDistance}km

REQUIREMENTS:
- Routes MUST form proper circuits/loops (not out-and-back)
- NO dead-ends or cul-de-sacs (roads that require 180° turnarounds)
- Waypoints should create a flowing path that returns to start naturally
- Maintain approximately the same distance (±15%)
- Use real streets/paths (don't suggest water, private property, or impossible routes)

Analyze the current waypoints and determine:
1. Does this route have dead-ends? (streets that end, requiring turnarounds)
2. Is it too linear? (out-and-back pattern)
3. Overall circuit quality (excellent/good/poor)
4. Specific issues you notice

If the route quality is "poor", suggest 3-5 improved waypoint coordinates that would create a better circuit. The waypoints should:
- Form a smooth loop
- Avoid backtracking
- Create variety in direction (not just straight lines)
- Consider the natural street grid of the area

Respond in JSON format:
{
  "hasDeadEnds": boolean,
  "isLinear": boolean,
  "circuitQuality": "excellent" | "good" | "poor",
  "issues": ["issue1", "issue2", ...],
  "suggestedWaypoints": [
    {"lat": number, "lng": number},
    ...
  ]
}

Only include "suggestedWaypoints" if circuitQuality is "poor".`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing and optimizing running routes. You understand street patterns, circuit design, and how to create engaging running routes that avoid dead-ends and backtracking.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const analysis: RouteAnalysis = JSON.parse(content);
    
    console.log('[AI Route Refinement] Analysis:', {
      hasDeadEnds: analysis.hasDeadEnds,
      isLinear: analysis.isLinear,
      quality: analysis.circuitQuality,
      issuesCount: analysis.issues.length,
      suggestedWaypoints: analysis.suggestedWaypoints ? 'YES' : 'NO'
    });

    return analysis;
  } catch (error: any) {
    console.error('[AI Route Refinement] Error:', error.message);
    // Return a safe default - assume route is okay
    return {
      hasDeadEnds: false,
      isLinear: false,
      circuitQuality: 'good',
      issues: [],
    };
  }
}

/**
 * Post-process a generated route by having AI check and improve it
 */
export async function shouldUseRefinedRoute(
  startPoint: LatLng,
  waypoints: LatLng[],
  routePolyline: string,
  targetDistance: number
): Promise<{ useOriginal: boolean; refinedWaypoints?: LatLng[] }> {
  const analysis = await refineRouteWithAI(startPoint, waypoints, routePolyline, targetDistance);
  
  // Only use AI-refined waypoints if original route is poor quality
  if (analysis.circuitQuality === 'poor' && analysis.suggestedWaypoints && analysis.suggestedWaypoints.length >= 3) {
    console.log('[AI Route Refinement] Using AI-improved waypoints');
    return {
      useOriginal: false,
      refinedWaypoints: analysis.suggestedWaypoints
    };
  }
  
  console.log('[AI Route Refinement] Original route quality acceptable');
  return { useOriginal: true };
}
