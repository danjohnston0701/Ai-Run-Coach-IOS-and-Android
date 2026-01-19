import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
