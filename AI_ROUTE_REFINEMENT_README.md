# AI-Powered Route Refinement System

## Overview
This system uses OpenAI GPT-4 to analyze and improve running routes, eliminating dead-ends and creating better circuits.

## How It Works

### 1. **Route Generation**
- Google Maps Directions API generates routes from template waypoints
- Routes undergo strict validation (angular spread, backtrack ratio, dead-end detection)

### 2. **AI Analysis** (Optional, enabled by default)
When a route is generated, GPT-4 analyzes:
- **Dead-ends**: Roads that require 180° turnarounds
- **Linearity**: Out-and-back patterns
- **Circuit quality**: How well the route forms a proper loop

### 3. **AI Refinement**
If a route is rated "poor quality", GPT-4 suggests improved waypoints that:
- Form smooth loops
- Avoid backtracking
- Create directional variety
- Follow real streets (no water, private property, impossible routes)

### 4. **Regeneration**
- AI-improved waypoints are sent back to Google Maps Directions API
- New route is validated
- If better, the AI-optimized version is used
- Original name tagged with " (AI-Optimized)"

## Files

### Backend
- **`ai-route-refinement.ts`**: Core AI logic for route analysis and improvement
- **`route-generation.ts`**: Route generation, validation, dead-end detection
- **`routes.ts`**: API endpoint integration (line 435+)

### Android
- **`RouteMapPreview.kt`**: Blue→Green gradient polyline rendering (fixed gaps)

## Configuration

### Enable/Disable AI Refinement
```typescript
// In API request body:
{
  "enableAiRefinement": true // default: true
}
```

### Environment Variables Required
```
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_API_KEY=AIza...
```

## API Cost Management

**Cost per route refinement**: ~$0.01-0.03 (GPT-4 Turbo)

To reduce costs:
1. AI refinement only runs on routes that pass initial validation
2. AI only suggests improvements for "poor quality" routes
3. Can be disabled per-request with `enableAiRefinement: false`
4. Limited to processing a few routes at a time (not all templates)

## Validation Criteria

Routes are rejected if they fail any of these:

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| Angular Spread | >= 240° | Ensures proper circuit (not just 2-way) |
| Backtrack Ratio | <= 15% | Prevents out-and-back routes |
| Dead-ends | None | Detects sharp U-turns (cul-de-sacs) |

## Monitoring

Backend logs show:
```
[AI Route Refinement] Analysis: { hasDeadEnds: true, isLinear: false, quality: 'poor' }
[AI Route Refinement] Using AI-improved waypoints
[API] Regenerating route "North Loop" with AI-improved waypoints
[RouteValidation] REJECTED - Angular: 165.3°, Backtrack: 28.5%, DeadEnds: true
```

## Testing

1. **Generate routes** in Cambridge, NZ
2. **Check backend logs** for AI refinement activity
3. **Routes marked "(AI-Optimized)"** used AI improvements
4. **Compare** before/after route quality

## Future Improvements

- [ ] Cache AI analyses for similar routes
- [ ] Use GPT-3.5 for cost savings
- [ ] Batch process multiple routes in single API call
- [ ] Learn from user preferences (which routes they select)
- [ ] Integration with user feedback system
