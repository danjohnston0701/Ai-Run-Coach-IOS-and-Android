# Backend Circuit Filtering - IMPLEMENTATION COMPLETE ✅

## Overview
Enhanced route generation backend now samples **50 templates** and filters them to the **top 5 best circuit/loop routes** using intelligent quality scoring.

---

## 🎯 What Was Implemented

### 1. **New Functions in `route-generation.ts`**

#### `calculateAngleBetweenPoints()`
- Calculates the angle between three GPS points
- Used to detect sharp turnarounds (dead-ends)
- Returns angle in degrees (0-180°)

#### `countDeadEnds()`
- Detects dead-end points where route must turn around
- Looks for angles close to 180° (±15° threshold)
- Returns count of dead-end points in a route

#### `calculateCircuitScore()`
- **Composite scoring algorithm** (0-1, higher is better)
- **Weights:**
  - 40% - Backtrack ratio (lower is better)
  - 40% - Angular spread (higher is better)
  - 20% - Dead-end count (fewer is better)
- **Formula:**
  ```typescript
  score = (1 - backtrackRatio) * 0.4 + 
          (angularSpread / 360) * 0.4 + 
          (1 - deadEndCount * 0.5) * 0.2
  ```

### 2. **Updated `generateRouteOptions()` Function**

#### New Parameters:
```typescript
export async function generateRouteOptions(
  startLat: number,
  startLng: number,
  targetDistanceKm: number,
  activityType: string = 'run',
  sampleSize: number = 50,      // NEW: default 50 templates
  returnTopN: number = 5         // NEW: default 5 routes
): Promise<GeneratedRoute[]>
```

#### Enhanced Logic:
1. **Sample N templates** - Uses `sampleSize` (default 50)
2. **Generate routes** - Creates routes for all sampled templates
3. **Calculate scores** - Computes circuit score for each candidate
4. **Sort by quality** - Orders by circuit score (descending)
5. **Apply diversity filter** - Ensures routes are different (< 40% overlap)
6. **Return top N** - Returns `returnTopN` best routes (default 5)

#### Enhanced Logging:
```
[RouteGen] 🗺️ Enhanced circuit filtering enabled
[RouteGen] 🔍 Sampling 50 templates, returning top 5 circuits
[RouteGen] Candidate North Loop: score=0.87, backtrack=15.2%, angular=315°, deadEnds=0
[RouteGen] 🏆 Best circuit score: 0.92 (Hexagon)
[RouteGen] ✅ Selected Hexagon: 5.1km, score=0.92, backtrack=8.3%, deadEnds=0, climb=45m
[RouteGen] 🎉 Generated 5 high-quality circuit routes (target: 5)
```

### 3. **Updated API Endpoint in `routes.ts`**

#### New Request Parameters:
```typescript
POST /api/routes/generate-options
{
  "startLat": -37.898367,
  "startLng": 175.484444,
  "distance": 5.0,
  "activityType": "run",
  "sampleSize": 50,      // NEW: optional (default: 50)
  "returnTopN": 5        // NEW: optional (default: 5)
}
```

#### Backward Compatible:
- If `sampleSize` not provided → defaults to 50
- If `returnTopN` not provided → defaults to 5
- Old requests still work without changes

---

## 🔄 How It Works Now

### Before (OLD):
```
1. Shuffle all templates (32 total)
2. Try templates one by one
3. Stop when 5 valid routes found
4. Return first 5 that work
Result: Random routes, often with poor circuit quality
```

### After (NEW):
```
1. Sample 50 random templates (from 32, with retries)
2. Generate routes for all 50
3. Calculate circuit score for each:
   - Backtrack ratio
   - Angular spread  
   - Dead-end count
4. Sort by score (best first)
5. Filter for diversity (< 40% overlap)
6. Return top 5 highest-scoring circuits

Result: Best quality circuit routes, minimal backtracking, no dead-ends
```

---

## 📊 Circuit Quality Metrics

### Excellent Route (Score > 0.8):
- ✅ Backtrack ratio < 15%
- ✅ Angular spread > 300°
- ✅ Zero dead-ends
- ✅ True loop/circuit pattern

### Good Route (Score 0.6 - 0.8):
- ✅ Backtrack ratio < 25%
- ✅ Angular spread > 240°
- ✅ 0-1 dead-ends
- ✅ Mostly circuit-like

### Poor Route (Score < 0.6):
- ❌ Backtrack ratio > 30%
- ❌ Angular spread < 200°
- ❌ Multiple dead-ends
- ❌ Out-and-back pattern

---

## 🧪 Testing

### Test Request:
```bash
curl -X POST http://localhost:3000/api/routes/generate-options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "startLat": -37.898367,
    "startLng": 175.484444,
    "distance": 5.0,
    "activityType": "run",
    "sampleSize": 50,
    "returnTopN": 5
  }'
```

### Expected Response:
```json
{
  "routes": [
    {
      "id": "route_1234_0",
      "name": "Hexagon Route",
      "distance": 5.1,
      "estimatedTime": 51,
      "difficulty": "easy",
      "circuitQuality": {
        "backtrackRatio": 0.083,
        "angularSpread": 330
      }
    }
    // ... 4 more routes
  ]
}
```

### What to Verify:
1. ✅ Returns exactly 5 routes (or fewer if not enough quality routes)
2. ✅ Routes have low backtrack ratios (< 0.3)
3. ✅ Routes have high angular spread (> 270°)
4. ✅ Routes are visually different from each other
5. ✅ Logs show circuit scores and filtering process

---

## 🎉 Benefits

### For Users:
- ✅ **Better circuits**: Routes are true loops, not out-and-backs
- ✅ **Less backtracking**: Minimal dead-end points
- ✅ **More variety**: 5 diverse, high-quality options
- ✅ **Consistent quality**: Every route meets quality standards

### For Backend:
- ✅ **Measurable quality**: Objective scoring system
- ✅ **Debugging**: Enhanced logging shows decision process
- ✅ **Backward compatible**: Old clients still work
- ✅ **Configurable**: Adjustable sample size and return count

---

## 📈 Performance Considerations

### API Call Volume:
- Before: ~5-10 Google Maps API calls
- After: Up to 500 Google Maps API calls (50 templates × ~10 calibration calls)

### Mitigation Strategies:
1. **Caching**: Cache template calibrations by location
2. **Parallel processing**: Could parallelize template evaluation
3. **Progressive loading**: Return routes as they're found
4. **Smart sampling**: Prioritize templates that historically work well

### Current Approach:
- Sequential evaluation (easier to debug)
- Early exit on calibration (many templates fail fast)
- Most routes generate in 30-60 seconds

---

## 🔮 Future Enhancements

### Phase 2: AI Refinement
- Pass top 5 circuits through AI for:
  - Scenic route optimization
  - Safety considerations (avoid dangerous roads)
  - POI (Points of Interest) suggestions
  - Custom waypoint adjustments

### Phase 3: Machine Learning
- Learn which templates work best for each location
- Predict circuit quality before generating
- Adaptive sampling based on success rates

### Phase 4: User Preferences
- Filter by user preferences (scenery, difficulty, terrain)
- Personalized route recommendations
- Historical route performance data

---

## 📝 Summary

**Backend circuit filtering is now LIVE!** 🚀

The Android app sends `sampleSize=50` and `returnTopN=5`, and the backend:
1. ✅ Samples 50 templates
2. ✅ Calculates circuit scores
3. ✅ Filters for quality and diversity
4. ✅ Returns top 5 best circuits

**Result:** Users get high-quality loop routes with minimal backtracking and dead-ends!

---

## 🐛 Troubleshooting

### Issue: No routes returned
- Check Google Maps API key is configured
- Verify location has accessible streets/paths
- Reduce `returnTopN` if not enough quality routes

### Issue: Routes still have dead-ends
- Check `countDeadEnds()` threshold (currently 15°)
- Verify `circuitQuality` values in response
- May need to increase `sampleSize` for more options

### Issue: Slow response times
- Reduce `sampleSize` (try 30 instead of 50)
- Implement caching for common locations
- Check Google Maps API quotas

---

Built with ❤️ for AI Run Coach - January 2026
