import OpenAI from "openai";
import { COACHING_PHASE_PROMPT, determinePhase, type CoachingPhase } from "../shared/coaching-statements";

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
  phase?: CoachingPhase;
  isStruggling?: boolean;
  cadence?: number;
  activityType?: string;
  userFitnessLevel?: string;
  coachTone?: string;
  coachAccent?: string;
  totalDistance?: number;
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
  
  const currentPhase = context.phase || (context.distance !== undefined 
    ? determinePhase(context.distance, context.totalDistance || null)
    : 'generic');
  
  prompt += `\n\n${COACHING_PHASE_PROMPT}`;
  prompt += `\n\nCURRENT PHASE: ${currentPhase.toUpperCase()}`;
  
  if (context.distance !== undefined) {
    prompt += ` (Runner is at ${context.distance.toFixed(2)}km`;
    if (context.totalDistance) {
      const percent = (context.distance / context.totalDistance) * 100;
      prompt += ` of ${context.totalDistance.toFixed(1)}km total, ${percent.toFixed(0)}% complete`;
    }
    prompt += ')';
  }
  
  if (context.elevationChange) {
    prompt += ` The runner is currently on ${context.elevationChange} terrain.`;
  }
  
  if (context.isStruggling && currentPhase === 'late') {
    prompt += ' The runner appears to be struggling. Be extra supportive with fatigue-appropriate advice.';
  } else if (context.isStruggling) {
    prompt += ' The runner appears to be struggling. Be supportive but remember phase-appropriate advice only.';
  }
  
  if (context.weather?.current?.temperature) {
    prompt += ` Current temperature: ${context.weather.current.temperature}°C.`;
  }
  
  if (context.heartRate) {
    const maxHR = 190;
    const hrPercent = (context.heartRate / maxHR) * 100;
    let zone = 'Zone 1 (Recovery)';
    let zoneAdvice = 'easy effort';
    
    if (hrPercent >= 90) {
      zone = 'Zone 5 (Maximum)';
      zoneAdvice = 'maximum effort - only sustainable briefly';
    } else if (hrPercent >= 80) {
      zone = 'Zone 4 (Threshold)';
      zoneAdvice = 'high intensity - building speed endurance';
    } else if (hrPercent >= 70) {
      zone = 'Zone 3 (Tempo)';
      zoneAdvice = 'moderate-hard effort - building aerobic capacity';
    } else if (hrPercent >= 60) {
      zone = 'Zone 2 (Aerobic)';
      zoneAdvice = 'comfortable effort - fat burning zone';
    }
    
    prompt += ` Current heart rate: ${context.heartRate} BPM (${zone}, ${zoneAdvice}).`;
    
    if (hrPercent >= 90) {
      prompt += ' The runner may need to slow down to recover.';
    } else if (hrPercent >= 85) {
      prompt += ' Heart rate is elevated - monitor effort level.';
    }
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

/**
 * Wellness-aware pre-run coaching that incorporates Garmin data
 */
export interface WellnessContext {
  sleepHours?: number;
  sleepQuality?: string;
  sleepScore?: number;
  bodyBattery?: number;
  stressLevel?: number;
  stressQualifier?: string;
  hrvStatus?: string;
  hrvFeedback?: string;
  restingHeartRate?: number;
  readinessScore?: number;
  readinessRecommendation?: string;
}

export async function generateWellnessAwarePreRunBriefing(params: {
  distance: number;
  elevationGain: number;
  difficulty: string;
  activityType: string;
  weather: any;
  coachName: string;
  coachTone: string;
  wellness: WellnessContext;
}): Promise<{
  briefing: string;
  intensityAdvice: string;
  warnings: string[];
  readinessInsight: string;
}> {
  const { distance, elevationGain, difficulty, activityType, weather, coachName, coachTone, wellness } = params;
  
  const weatherInfo = weather 
    ? `Weather: ${weather.temp || weather.temperature || 'N/A'}°C, ${weather.condition || 'clear'}, wind ${weather.windSpeed || 0} km/h.`
    : 'Weather data unavailable.';
  
  // Build wellness context string
  let wellnessContext = '';
  if (wellness.sleepHours !== undefined) {
    wellnessContext += `\n- Sleep: ${wellness.sleepHours.toFixed(1)} hours (${wellness.sleepQuality || 'N/A'})`;
    if (wellness.sleepScore) wellnessContext += `, score: ${wellness.sleepScore}/100`;
  }
  if (wellness.bodyBattery !== undefined) {
    wellnessContext += `\n- Body Battery: ${wellness.bodyBattery}/100`;
  }
  if (wellness.stressLevel !== undefined) {
    wellnessContext += `\n- Stress: ${wellness.stressQualifier || 'N/A'} (${wellness.stressLevel}/100)`;
  }
  if (wellness.hrvStatus) {
    wellnessContext += `\n- HRV Status: ${wellness.hrvStatus}`;
    if (wellness.hrvFeedback) wellnessContext += ` - ${wellness.hrvFeedback}`;
  }
  if (wellness.restingHeartRate) {
    wellnessContext += `\n- Resting HR: ${wellness.restingHeartRate} bpm`;
  }
  if (wellness.readinessScore !== undefined) {
    wellnessContext += `\n- Overall Readiness: ${wellness.readinessScore}/100`;
  }
  
  const prompt = `You are ${coachName}, an AI running coach. Your coaching style is ${coachTone}.

Generate a personalized pre-run briefing that considers the runner's current wellness state from their Garmin data.

ROUTE:
- Distance: ${distance?.toFixed(1) || '?'}km
- Difficulty: ${difficulty}
- Elevation gain: ${Math.round(elevationGain || 0)}m
- ${weatherInfo}

CURRENT WELLNESS STATUS (from Garmin):${wellnessContext || '\n- No wellness data available'}

Based on this data, provide:
1. A brief personalized briefing (2-3 sentences) that acknowledges their current state
2. Specific intensity advice based on their readiness/recovery
3. Any warnings if their wellness indicators suggest caution
4. A readiness insight explaining how their body data affects today's run

Respond as JSON with fields: briefing, intensityAdvice, warnings (array), readinessInsight`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are ${coachName}, a ${coachTone} running coach who uses biometric data for personalized coaching. Respond only with valid JSON.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    
    return {
      briefing: parsed.briefing || "Ready for your run! Let's get started.",
      intensityAdvice: parsed.intensityAdvice || "Listen to your body today.",
      warnings: parsed.warnings || [],
      readinessInsight: parsed.readinessInsight || "Your body is ready for this run.",
    };
  } catch (error) {
    console.error("Error generating wellness-aware briefing:", error);
    return {
      briefing: "Ready for your run! Take it easy at the start and find your rhythm.",
      intensityAdvice: "Start conservatively and adjust based on how you feel.",
      warnings: [],
      readinessInsight: "Listen to your body and adjust intensity as needed.",
    };
  }
}

/**
 * Enhanced coaching context that includes wellness data
 */
export interface EnhancedCoachingContext extends CoachingContext {
  wellness?: WellnessContext;
  targetHeartRateZone?: number;
}

export async function getWellnessAwareCoachingResponse(
  message: string, 
  context: EnhancedCoachingContext
): Promise<string> {
  const systemPrompt = buildEnhancedCoachingSystemPrompt(context);
  
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

function buildEnhancedCoachingSystemPrompt(context: EnhancedCoachingContext): string {
  let prompt = buildCoachingSystemPrompt(context);
  
  // Add wellness context if available
  if (context.wellness) {
    const w = context.wellness;
    let wellnessInfo = '\n\nRUNNER WELLNESS CONTEXT (from Garmin):';
    
    if (w.readinessScore !== undefined) {
      wellnessInfo += `\n- Today's readiness: ${w.readinessScore}/100`;
    }
    if (w.bodyBattery !== undefined) {
      wellnessInfo += `\n- Body Battery: ${w.bodyBattery}/100`;
    }
    if (w.sleepQuality) {
      wellnessInfo += `\n- Last night's sleep: ${w.sleepQuality}`;
    }
    if (w.stressQualifier) {
      wellnessInfo += `\n- Current stress: ${w.stressQualifier}`;
    }
    if (w.hrvStatus) {
      wellnessInfo += `\n- HRV status: ${w.hrvStatus}`;
    }
    
    prompt += wellnessInfo;
    prompt += '\n\nUse this wellness data to personalize your coaching. If readiness is low, encourage an easier effort. If Body Battery is high, they may be able to push harder.';
  }
  
  // Add heart rate zone guidance if available
  if (context.targetHeartRateZone) {
    prompt += `\n\nTARGET HR ZONE: Zone ${context.targetHeartRateZone}. `;
    switch (context.targetHeartRateZone) {
      case 1: prompt += 'Recovery zone - keep it very easy.'; break;
      case 2: prompt += 'Aerobic zone - conversational pace.'; break;
      case 3: prompt += 'Tempo zone - comfortably hard.'; break;
      case 4: prompt += 'Threshold zone - hard but sustainable.'; break;
      case 5: prompt += 'Maximum zone - very hard, short intervals.'; break;
    }
    
    if (context.heartRate) {
      const currentZone = getHeartRateZone(context.heartRate, 220 - 30); // Assume age 30 for now
      if (currentZone > context.targetHeartRateZone) {
        prompt += ' Runner is ABOVE target zone - encourage them to slow down.';
      } else if (currentZone < context.targetHeartRateZone) {
        prompt += ' Runner is BELOW target zone - they can push a bit harder if they feel good.';
      }
    }
  }
  
  return prompt;
}

function getHeartRateZone(hr: number, maxHr: number): number {
  const percent = (hr / maxHr) * 100;
  if (percent < 60) return 1;
  if (percent < 70) return 2;
  if (percent < 80) return 3;
  if (percent < 90) return 4;
  return 5;
}

/**
 * Generate real-time coaching message based on current HR and wellness context
 */
export async function generateHeartRateCoaching(params: {
  currentHR: number;
  avgHR: number;
  maxHR: number;
  targetZone?: number;
  elapsedMinutes: number;
  coachName: string;
  coachTone: string;
  wellness?: WellnessContext;
}): Promise<string> {
  const { currentHR, avgHR, maxHR, targetZone, elapsedMinutes, coachName, coachTone, wellness } = params;
  
  const currentZone = getHeartRateZone(currentHR, maxHR);
  const percentMax = Math.round((currentHR / maxHR) * 100);
  
  const zoneNames = ['', 'Recovery', 'Aerobic', 'Tempo', 'Threshold', 'Maximum'];
  
  let wellnessContext = '';
  if (wellness) {
    if (wellness.bodyBattery !== undefined && wellness.bodyBattery < 30) {
      wellnessContext = 'Their Body Battery is low today. ';
    }
    if (wellness.sleepQuality === 'Poor' || wellness.sleepQuality === 'Very Poor') {
      wellnessContext += 'They had poor sleep last night. ';
    }
    if (wellness.hrvStatus === 'LOW') {
      wellnessContext += 'HRV is below baseline. ';
    }
  }
  
  const prompt = `You are ${coachName}, a ${coachTone} running coach giving real-time heart rate guidance.

Current stats (${elapsedMinutes} minutes into run):
- Heart Rate: ${currentHR} bpm (${percentMax}% of max)
- Current Zone: Zone ${currentZone} (${zoneNames[currentZone]})
- Average HR: ${avgHR} bpm
${targetZone ? `- Target Zone: Zone ${targetZone} (${zoneNames[targetZone]})` : ''}
${wellnessContext ? `\nWellness context: ${wellnessContext}` : ''}

Give a brief (1-2 sentences) heart rate coaching tip. ${
  targetZone && currentZone !== targetZone 
    ? currentZone > targetZone 
      ? 'They need to slow down to hit their target zone.' 
      : 'They can pick up the pace if feeling good.'
    : ''
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are ${coachName}, giving brief real-time HR coaching. Keep it to 1-2 short sentences.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || `Heart rate at ${currentHR}, Zone ${currentZone}. Keep it steady!`;
  } catch {
    return `Heart rate at ${currentHR} bpm, Zone ${currentZone}. ${currentZone > 3 ? 'Consider easing up.' : 'Looking good!'}`;
  }
}
