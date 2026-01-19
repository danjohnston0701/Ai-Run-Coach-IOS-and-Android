import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface CoachingContext {
  distance?: number;
  duration?: number;
  pace?: string;
  heartRate?: number;
  elevation?: number;
  elevationChange?: string;
  weather?: any;
  phase?: string;
  isStruggling?: boolean;
  cadence?: number;
  activityType?: string;
  userFitnessLevel?: string;
  coachTone?: string;
  coachAccent?: string;
}

export async function getCoachingResponse(message: string, context: CoachingContext): Promise<string> {
  const systemPrompt = buildCoachingSystemPrompt(context);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ],
    max_tokens: 150,
    temperature: 0.7,
  });

  return completion.choices[0].message.content || "Keep going, you're doing great!";
}

export async function generatePreRunCoaching(params: {
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  difficulty: string;
  activityType: string;
  weather: any;
  coachName: string;
  coachTone: string;
}): Promise<string> {
  const { distance, elevationGain, elevationLoss, difficulty, activityType, weather, coachName, coachTone } = params;
  
  const weatherInfo = weather 
    ? `Weather: ${weather.temp || 'N/A'}°C, ${weather.condition || 'clear'}, wind ${weather.windSpeed || 0} km/h.`
    : 'Weather data unavailable.';
  
  const prompt = `You are ${coachName}, an AI running coach. Your coaching style is ${coachTone}.

Generate a brief pre-run briefing (2-3 sentences max) for this upcoming ${activityType}:
- Distance: ${distance?.toFixed(1) || '?'}km
- Difficulty: ${difficulty}
- Elevation gain: ${Math.round(elevationGain || 0)}m, loss: ${Math.round(elevationLoss || 0)}m
- ${weatherInfo}

Be encouraging, specific to the conditions, and give one actionable tip. Speak naturally as if talking directly to the runner.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are ${coachName}, a ${coachTone} running coach. Keep responses brief, encouraging, and actionable.` },
      { role: "user", content: prompt }
    ],
    max_tokens: 120,
    temperature: 0.8,
  });

  return completion.choices[0].message.content || "Take it easy at the start and find your rhythm. Good luck!";
}

export async function generatePaceUpdate(params: {
  distance: number;
  targetDistance: number;
  currentPace: string;
  elapsedTime: number;
  coachName: string;
  coachTone: string;
  isSplit: boolean;
  splitKm?: number;
  splitPace?: string;
}): Promise<string> {
  const { distance, targetDistance, currentPace, elapsedTime, coachName, coachTone, isSplit, splitKm, splitPace } = params;
  
  const progress = Math.round((distance / targetDistance) * 100);
  const timeMin = Math.floor(elapsedTime / 60);
  
  let prompt: string;
  if (isSplit && splitKm && splitPace) {
    prompt = `You are ${coachName}, an AI running coach with a ${coachTone} style.
    
The runner just completed kilometer ${splitKm} with a split pace of ${splitPace}/km. They're at ${progress}% of their ${targetDistance}km run.

Give a brief (1 sentence) split update. Mention their pace and give quick encouragement or pacing advice.`;
  } else {
    prompt = `You are ${coachName}, an AI running coach with a ${coachTone} style.
    
500m pace check: Runner is at ${distance.toFixed(2)}km, pace ${currentPace}/km, ${timeMin} minutes in.

Give a very brief (1 sentence) pace update with encouragement.`;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are ${coachName}, a ${coachTone} running coach. Keep pace updates to 1 brief sentence.` },
      { role: "user", content: prompt }
    ],
    max_tokens: 50,
    temperature: 0.7,
  });

  return completion.choices[0].message.content || (isSplit ? `Kilometer ${splitKm} done at ${splitPace}. Keep it up!` : "Looking good, keep this pace!");
}

export async function generateRunSummary(runData: any): Promise<any> {
  const prompt = `Analyze this run and provide a brief summary with highlights, struggles, and tips:
Run Data:
- Distance: ${runData.distance}km
- Duration: ${runData.duration} minutes
- Average Pace: ${runData.avgPace}
- Elevation Gain: ${runData.elevationGain || 0}m
- Activity Type: ${runData.activityType || 'run'}
- Weather: ${JSON.stringify(runData.weather || {})}

Provide response as JSON with fields: highlights (array), struggles (array), tips (array), overallScore (1-10), summary (string)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert running coach providing post-run analysis. Respond only with valid JSON." },
      { role: "user", content: prompt }
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  try {
    const content = completion.choices[0].message.content || "{}";
    return JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
  } catch {
    return {
      highlights: ["Completed your run!"],
      struggles: [],
      tips: ["Keep up the great work!"],
      overallScore: 7,
      summary: "Great effort on your run today!"
    };
  }
}

export async function generatePreRunSummary(routeData: any, weatherData: any): Promise<any> {
  const prompt = `Generate a pre-run coaching summary for this route:
Route:
- Distance: ${routeData.distance}km
- Elevation Gain: ${routeData.elevationGain || 0}m
- Difficulty: ${routeData.difficulty}
- Terrain: ${routeData.terrainType || 'mixed'}

Weather:
- Temperature: ${weatherData?.current?.temperature || 'N/A'}°C
- Conditions: ${weatherData?.current?.condition || 'N/A'}
- Wind: ${weatherData?.current?.windSpeed || 0} km/h

Provide response as JSON with: tips (array of 3-4 coaching tips), warnings (array of any concerns), suggestedPace (string), hydrationAdvice (string), warmupSuggestion (string)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert running coach providing pre-run advice. Respond only with valid JSON." },
      { role: "user", content: prompt }
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  try {
    const content = completion.choices[0].message.content || "{}";
    return JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
  } catch {
    return {
      tips: ["Start at an easy pace", "Focus on your breathing", "Enjoy the run!"],
      warnings: [],
      suggestedPace: "comfortable",
      hydrationAdvice: "Stay hydrated",
      warmupSuggestion: "5 minutes of light jogging"
    };
  }
}

export async function getElevationCoaching(elevationData: { change: string; grade: number; upcoming?: string }): Promise<string> {
  const prompt = `As a running coach, give a brief (1-2 sentences) tip for this terrain:
- Current: ${elevationData.change} (${Math.abs(elevationData.grade)}% grade)
- Upcoming: ${elevationData.upcoming || 'similar terrain'}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an encouraging running coach. Keep responses brief and actionable." },
      { role: "user", content: prompt }
    ],
    max_tokens: 60,
    temperature: 0.8,
  });

  return completion.choices[0].message.content || "Adjust your effort for the terrain!";
}

export async function generateTTS(text: string, voice: string = "alloy"): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as any,
    input: text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

function buildCoachingSystemPrompt(context: CoachingContext): string {
  let prompt = `You are an AI running coach. Be encouraging, brief (1-2 sentences max), and specific to the runner's current situation.`;
  
  if (context.coachTone) {
    prompt += ` Your tone should be ${context.coachTone}.`;
  }
  
  if (context.phase) {
    const phaseAdvice: Record<string, string> = {
      'warmup': 'The runner is warming up. Encourage easy pace and proper form.',
      'mid': 'The runner is in the middle of their run. Provide steady encouragement.',
      'late': 'The runner is in the later stages. Help them push through.',
      'final': 'The runner is finishing. Celebrate their effort and encourage a strong finish.'
    };
    prompt += ` ${phaseAdvice[context.phase] || ''}`;
  }
  
  if (context.elevationChange) {
    prompt += ` The runner is currently on ${context.elevationChange} terrain.`;
  }
  
  if (context.isStruggling) {
    prompt += ' The runner appears to be struggling. Be extra supportive.';
  }
  
  if (context.weather?.current?.temperature) {
    prompt += ` Current temperature: ${context.weather.current.temperature}°C.`;
  }
  
  return prompt;
}

export interface RouteGenerationParams {
  startLat: number;
  startLng: number;
  distance: number;
  difficulty: string;
  activityType?: string;
  terrainPreference?: string;
  avoidHills?: boolean;
}

export interface GeneratedRoute {
  id: string;
  name: string;
  distance: number;
  difficulty: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  waypoints: { lat: number; lng: number }[];
  elevation: number;
  elevationGain: number;
  estimatedTime: number;
  terrainType: string;
  polyline: string;
  description: string;
}

export async function generateRouteOptions(params: RouteGenerationParams): Promise<GeneratedRoute[]> {
  const { startLat, startLng, distance, difficulty, activityType = 'run' } = params;
  
  // Generate 2-3 route options using AI to suggest waypoints
  const prompt = `Generate 3 different running route options starting from coordinates (${startLat}, ${startLng}).
Target distance: ${distance}km
Difficulty: ${difficulty}
Activity: ${activityType}

For each route, provide:
1. A creative name
2. 3-5 waypoint coordinates that create a loop back to start
3. Estimated elevation gain (in meters)
4. Terrain description (trail, road, mixed, park)
5. Brief description

Respond in JSON format:
{
  "routes": [
    {
      "name": "Route Name",
      "waypoints": [{"lat": 51.5, "lng": -0.1}, ...],
      "elevationGain": 50,
      "terrainType": "mixed",
      "description": "Brief description"
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a running route planner. Generate realistic waypoints near the starting location that create approximately the requested distance as a loop. Respond only with valid JSON." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.8,
    });

    const content = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    
    const generatedRoutes: GeneratedRoute[] = [];
    
    for (let i = 0; i < (parsed.routes || []).length; i++) {
      const route = parsed.routes[i];
      const waypoints = route.waypoints || [];
      
      // Get directions from Google Maps to get actual polyline and distance
      const directionsData = await getGoogleDirections(startLat, startLng, waypoints);
      
      const routeId = `route_${Date.now()}_${i}`;
      generatedRoutes.push({
        id: routeId,
        name: route.name || `Route ${i + 1}`,
        distance: directionsData.distance || distance,
        difficulty: difficulty,
        startLat: startLat,
        startLng: startLng,
        endLat: startLat,
        endLng: startLng,
        waypoints: waypoints,
        elevation: route.elevationGain || 0,
        elevationGain: route.elevationGain || 0,
        estimatedTime: Math.round((directionsData.distance || distance) * (activityType === 'walk' ? 12 : 6)),
        terrainType: route.terrainType || 'mixed',
        polyline: directionsData.polyline || '',
        description: route.description || ''
      });
    }
    
    return generatedRoutes;
  } catch (error) {
    console.error("Route generation error:", error);
    // Return a simple fallback route
    return [{
      id: `route_${Date.now()}`,
      name: "Quick Route",
      distance: distance,
      difficulty: difficulty,
      startLat: startLat,
      startLng: startLng,
      endLat: startLat,
      endLng: startLng,
      waypoints: [],
      elevation: 0,
      elevationGain: 0,
      estimatedTime: Math.round(distance * 6),
      terrainType: "road",
      polyline: "",
      description: "A simple out-and-back route"
    }];
  }
}

async function getGoogleDirections(startLat: number, startLng: number, waypoints: { lat: number; lng: number }[]): Promise<{ distance: number; polyline: string }> {
  if (!GOOGLE_MAPS_API_KEY || waypoints.length === 0) {
    return { distance: 0, polyline: '' };
  }

  try {
    const origin = `${startLat},${startLng}`;
    const destination = origin; // Loop back
    const waypointStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypointStr}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const totalDistance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000;
      return {
        distance: Math.round(totalDistance * 10) / 10,
        polyline: route.overview_polyline?.points || ''
      };
    }
  } catch (error) {
    console.error("Google Directions API error:", error);
  }
  
  return { distance: 0, polyline: '' };
}
