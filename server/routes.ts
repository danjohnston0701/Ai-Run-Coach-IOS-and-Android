import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { 
  generateToken, 
  hashPassword, 
  comparePassword, 
  authMiddleware, 
  optionalAuthMiddleware,
  type AuthenticatedRequest 
} from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ==================== AUTH ENDPOINTS ====================
  
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      const hashedPassword = await hashPassword(password);
      const userCode = `RC${Date.now().toString(36).toUpperCase()}`;
      
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        userCode,
      });
      
      const token = generateToken({ userId: user.id, email: user.email });
      
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = generateToken({ userId: user.id, email: user.email });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // ==================== USER ENDPOINTS ====================
  
  app.get("/api/users/search", async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "");
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query);
      const sanitized = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        profilePic: u.profilePic,
        userCode: u.userCode,
      }));
      res.json(sanitized);
    } catch (error: any) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.put("/api/users/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user?.userId !== req.params.id) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ==================== FRIENDS ENDPOINTS ====================
  
  app.get("/api/friends", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = String(req.query.userId || req.user?.userId);
      const friends = await storage.getFriends(userId);
      res.json(friends.map(f => ({
        id: f.id,
        name: f.name,
        email: f.email,
        profilePic: f.profilePic,
        userCode: f.userCode,
      })));
    } catch (error: any) {
      console.error("Get friends error:", error);
      res.status(500).json({ error: "Failed to get friends" });
    }
  });

  app.post("/api/friend-requests", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { addresseeId, message } = req.body;
      const requesterId = req.user!.userId;
      
      if (!addresseeId) {
        return res.status(400).json({ error: "Addressee ID is required" });
      }
      
      const request = await storage.createFriendRequest(requesterId, addresseeId, message);
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Create friend request error:", error);
      res.status(500).json({ error: "Failed to create friend request" });
    }
  });

  app.post("/api/friend-requests/:id/accept", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.acceptFriendRequest(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Accept friend request error:", error);
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  });

  app.post("/api/friend-requests/:id/decline", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.declineFriendRequest(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Decline friend request error:", error);
      res.status(500).json({ error: "Failed to decline friend request" });
    }
  });

  // ==================== RUNS ENDPOINTS ====================
  
  app.get("/api/runs/user/:userId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const runs = await storage.getUserRuns(req.params.userId);
      res.json(runs);
    } catch (error: any) {
      console.error("Get user runs error:", error);
      res.status(500).json({ error: "Failed to get runs" });
    }
  });

  app.get("/api/runs/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const run = await storage.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json(run);
    } catch (error: any) {
      console.error("Get run error:", error);
      res.status(500).json({ error: "Failed to get run" });
    }
  });

  app.post("/api/runs", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const run = await storage.createRun({
        ...req.body,
        userId: req.user!.userId,
      });
      res.status(201).json(run);
    } catch (error: any) {
      console.error("Create run error:", error);
      res.status(500).json({ error: "Failed to create run" });
    }
  });

  app.post("/api/runs/sync-progress", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { runId, ...data } = req.body;
      if (runId) {
        const run = await storage.updateRun(runId, data);
        res.json(run);
      } else {
        const run = await storage.createRun({
          ...data,
          userId: req.user!.userId,
        });
        res.json(run);
      }
    } catch (error: any) {
      console.error("Sync run progress error:", error);
      res.status(500).json({ error: "Failed to sync run progress" });
    }
  });

  app.get("/api/runs/:id/analysis", async (req: Request, res: Response) => {
    try {
      const analysis = await storage.getRunAnalysis(req.params.id);
      res.json(analysis || null);
    } catch (error: any) {
      console.error("Get run analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  app.post("/api/runs/:id/analysis", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const analysis = await storage.createRunAnalysis(req.params.id, req.body);
      res.status(201).json(analysis);
    } catch (error: any) {
      console.error("Create run analysis error:", error);
      res.status(500).json({ error: "Failed to create analysis" });
    }
  });

  // ==================== ROUTES ENDPOINTS ====================
  
  app.get("/api/routes/user/:userId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const routes = await storage.getUserRoutes(req.params.userId);
      res.json(routes);
    } catch (error: any) {
      console.error("Get user routes error:", error);
      res.status(500).json({ error: "Failed to get routes" });
    }
  });

  app.get("/api/routes/:id", async (req: Request, res: Response) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.json(route);
    } catch (error: any) {
      console.error("Get route error:", error);
      res.status(500).json({ error: "Failed to get route" });
    }
  });

  app.post("/api/routes", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.createRoute({
        ...req.body,
        userId: req.user!.userId,
      });
      res.status(201).json(route);
    } catch (error: any) {
      console.error("Create route error:", error);
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  app.post("/api/routes/generate-options", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startLat, startLng, distance, difficulty, activityType, terrainPreference, avoidHills } = req.body;
      
      console.log("[API] Generate routes request:", { startLat, startLng, distance, activityType });
      
      if (!startLat || !startLng || !distance) {
        return res.status(400).json({ error: "Missing required fields: startLat, startLng, distance" });
      }
      
      const routeGen = await import("./route-generation");
      const routes = await routeGen.generateRouteOptions(
        parseFloat(startLat),
        parseFloat(startLng),
        parseFloat(distance),
        activityType || 'run'
      );
      
      console.log("[API] Generated routes count:", routes.length);
      
      const formattedRoutes = routes.map((route, index) => ({
        id: route.id,
        name: route.name,
        distance: route.distance,
        estimatedTime: route.duration,
        elevationGain: route.elevationGain,
        elevationLoss: route.elevationLoss,
        difficulty: route.difficulty,
        polyline: route.polyline,
        waypoints: route.waypoints,
        description: `${route.templateName} - ${route.distance.toFixed(1)}km circuit with ${route.elevationGain}m climb / ${route.elevationLoss}m descent`,
        turnByTurn: route.instructions,
        circuitQuality: {
          backtrackRatio: route.backtrackRatio,
          angularSpread: route.angularSpread,
        }
      }));
      
      res.json({ routes: formattedRoutes });
    } catch (error: any) {
      console.error("Generate routes error:", error);
      res.status(500).json({ error: "Failed to generate routes" });
    }
  });

  app.get("/api/routes/:id/ratings", async (req: Request, res: Response) => {
    try {
      const ratings = await storage.getRouteRatings(req.params.id);
      res.json(ratings);
    } catch (error: any) {
      console.error("Get route ratings error:", error);
      res.status(500).json({ error: "Failed to get ratings" });
    }
  });

  app.post("/api/routes/:id/ratings", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rating = await storage.createRouteRating({
        ...req.body,
        userId: req.user!.userId,
      });
      res.status(201).json(rating);
    } catch (error: any) {
      console.error("Create route rating error:", error);
      res.status(500).json({ error: "Failed to create rating" });
    }
  });

  // ==================== GOALS ENDPOINTS ====================
  
  app.get("/api/goals", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = String(req.query.userId || req.user?.userId);
      const goals = await storage.getUserGoals(userId);
      res.json(goals);
    } catch (error: any) {
      console.error("Get goals error:", error);
      res.status(500).json({ error: "Failed to get goals" });
    }
  });

  app.post("/api/goals", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const goal = await storage.createGoal({
        ...req.body,
        userId: req.user!.userId,
      });
      res.status(201).json(goal);
    } catch (error: any) {
      console.error("Create goal error:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.put("/api/goals/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const goal = await storage.updateGoal(req.params.id, req.body);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json(goal);
    } catch (error: any) {
      console.error("Update goal error:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteGoal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete goal error:", error);
      res.status(500).json({ error: "Failed to delete goal" });
    }
  });

  // ==================== EVENTS ENDPOINTS ====================
  
  app.get("/api/events/grouped", async (req: Request, res: Response) => {
    try {
      const events = await storage.getEvents();
      // Group by country
      const grouped: Record<string, any[]> = {};
      events.forEach(event => {
        if (!grouped[event.country]) {
          grouped[event.country] = [];
        }
        grouped[event.country].push(event);
      });
      res.json(grouped);
    } catch (error: any) {
      console.error("Get events error:", error);
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  // ==================== NOTIFICATIONS ENDPOINTS ====================
  
  app.get("/api/notifications", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = String(req.query.userId || req.user?.userId);
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.put("/api/notifications/:id/read", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.markAllNotificationsRead(req.user!.userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ error: "Failed to mark all as read" });
    }
  });

  app.delete("/api/notifications/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ==================== NOTIFICATION PREFERENCES ====================
  
  app.get("/api/notification-preferences/:userId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prefs = await storage.getNotificationPreferences(req.params.userId);
      res.json(prefs || {});
    } catch (error: any) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({ error: "Failed to get preferences" });
    }
  });

  app.put("/api/notification-preferences/:userId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prefs = await storage.updateNotificationPreferences(req.params.userId, req.body);
      res.json(prefs);
    } catch (error: any) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // ==================== LIVE SESSIONS ====================
  
  app.get("/api/live-sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const session = await storage.getLiveSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      console.error("Get live session error:", error);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.get("/api/users/:userId/live-session", async (req: Request, res: Response) => {
    try {
      const session = await storage.getUserLiveSession(req.params.userId);
      res.json(session || null);
    } catch (error: any) {
      console.error("Get user live session error:", error);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.put("/api/live-sessions/sync", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, ...data } = req.body;
      if (sessionId) {
        const session = await storage.updateLiveSession(sessionId, data);
        res.json(session);
      } else {
        const session = await storage.createLiveSession({
          ...data,
          userId: req.user!.userId,
        });
        res.json(session);
      }
    } catch (error: any) {
      console.error("Sync live session error:", error);
      res.status(500).json({ error: "Failed to sync session" });
    }
  });

  app.post("/api/live-sessions/end-by-key", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionKey } = req.body;
      await storage.endLiveSession(sessionKey);
      res.json({ success: true });
    } catch (error: any) {
      console.error("End live session error:", error);
      res.status(500).json({ error: "Failed to end session" });
    }
  });

  // ==================== GROUP RUNS ====================
  
  app.get("/api/group-runs", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const groupRuns = await storage.getGroupRuns();
      res.json(groupRuns);
    } catch (error: any) {
      console.error("Get group runs error:", error);
      res.status(500).json({ error: "Failed to get group runs" });
    }
  });

  app.get("/api/group-runs/:id", async (req: Request, res: Response) => {
    try {
      const groupRun = await storage.getGroupRun(req.params.id);
      if (!groupRun) {
        return res.status(404).json({ error: "Group run not found" });
      }
      res.json(groupRun);
    } catch (error: any) {
      console.error("Get group run error:", error);
      res.status(500).json({ error: "Failed to get group run" });
    }
  });

  app.post("/api/group-runs", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inviteToken = `GR${Date.now().toString(36).toUpperCase()}`;
      const groupRun = await storage.createGroupRun({
        ...req.body,
        hostUserId: req.user!.userId,
        inviteToken,
      });
      res.status(201).json(groupRun);
    } catch (error: any) {
      console.error("Create group run error:", error);
      res.status(500).json({ error: "Failed to create group run" });
    }
  });

  app.post("/api/group-runs/:id/join", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const participant = await storage.joinGroupRun(req.params.id, req.user!.userId);
      res.status(201).json(participant);
    } catch (error: any) {
      console.error("Join group run error:", error);
      res.status(500).json({ error: "Failed to join group run" });
    }
  });

  // ==================== AI ENDPOINTS (Direct OpenAI) ====================
  
  app.post("/api/ai/coach", async (req: Request, res: Response) => {
    try {
      const { message, context } = req.body;
      const aiService = await import("./ai-service");
      const response = await aiService.getCoachingResponse(message, context || {});
      res.json({ message: response });
    } catch (error: any) {
      console.error("AI coach error:", error);
      res.status(500).json({ error: "Failed to get AI coaching" });
    }
  });

  app.post("/api/ai/tts", async (req: Request, res: Response) => {
    try {
      const { text, voice } = req.body;
      const aiService = await import("./ai-service");
      const audioBuffer = await aiService.generateTTS(text, voice || "alloy");
      res.set("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("AI TTS error:", error);
      res.status(500).json({ error: "Failed to generate TTS" });
    }
  });

  app.post("/api/ai/coaching", async (req: Request, res: Response) => {
    try {
      const { message, context } = req.body;
      const aiService = await import("./ai-service");
      const response = await aiService.getCoachingResponse(message, context || {});
      res.json({ message: response });
    } catch (error: any) {
      console.error("AI coaching error:", error);
      res.status(500).json({ error: "Failed to get coaching response" });
    }
  });

  app.post("/api/ai/run-summary", async (req: Request, res: Response) => {
    try {
      const aiService = await import("./ai-service");
      const summary = await aiService.generateRunSummary(req.body);
      res.json(summary);
    } catch (error: any) {
      console.error("AI run summary error:", error);
      res.status(500).json({ error: "Failed to get run summary" });
    }
  });

  app.post("/api/ai/pre-run-summary", async (req: Request, res: Response) => {
    try {
      const { route, weather } = req.body;
      const aiService = await import("./ai-service");
      const summary = await aiService.generatePreRunSummary(route, weather);
      res.json(summary);
    } catch (error: any) {
      console.error("AI pre-run summary error:", error);
      res.status(500).json({ error: "Failed to get pre-run summary" });
    }
  });

  app.post("/api/ai/elevation-coaching", async (req: Request, res: Response) => {
    try {
      const aiService = await import("./ai-service");
      const tip = await aiService.getElevationCoaching(req.body);
      res.json({ message: tip });
    } catch (error: any) {
      console.error("AI elevation coaching error:", error);
      res.status(500).json({ error: "Failed to get elevation coaching" });
    }
  });

  app.post("/api/runs/:id/ai-insights", async (req: Request, res: Response) => {
    try {
      const run = await storage.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      const aiService = await import("./ai-service");
      const insights = await aiService.generateRunSummary({
        ...run,
        ...req.body
      });
      await storage.updateRun(req.params.id, { aiAnalysis: insights });
      res.json(insights);
    } catch (error: any) {
      console.error("AI insights error:", error);
      res.status(500).json({ error: "Failed to get AI insights" });
    }
  });

  // ==================== WEATHER ENDPOINTS (Proxy) ====================
  
  app.get("/api/weather/current", async (req: Request, res: Response) => {
    try {
      const { lat, lng } = req.query;
      const response = await fetch(`https://airuncoach.live/api/weather/current?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Weather error:", error);
      res.status(500).json({ error: "Failed to get weather" });
    }
  });

  app.get("/api/weather/full", async (req: Request, res: Response) => {
    try {
      const { lat, lng } = req.query;
      const response = await fetch(`https://airuncoach.live/api/weather/full?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Weather error:", error);
      res.status(500).json({ error: "Failed to get weather" });
    }
  });

  // ==================== GEOCODING (Proxy) ====================
  
  app.get("/api/geocode/reverse", async (req: Request, res: Response) => {
    try {
      const { lat, lng } = req.query;
      const response = await fetch(`https://airuncoach.live/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Geocode error:", error);
      res.status(500).json({ error: "Failed to geocode" });
    }
  });

  // ==================== SUBSCRIPTIONS (Placeholder) ====================
  
  app.get("/api/subscriptions/status", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      res.json({
        tier: user?.subscriptionTier || "free",
        status: user?.subscriptionStatus || "inactive",
        entitlementType: user?.entitlementType,
        expiresAt: user?.entitlementExpiresAt,
      });
    } catch (error: any) {
      console.error("Get subscription status error:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  // ==================== PUSH SUBSCRIPTIONS ====================
  
  app.post("/api/push-subscriptions", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Implementation would store push subscription
      res.json({ success: true });
    } catch (error: any) {
      console.error("Push subscription error:", error);
      res.status(500).json({ error: "Failed to save push subscription" });
    }
  });

  // ==================== COACHING LOGS ====================
  
  app.post("/api/coaching-logs/:sessionKey", async (req: Request, res: Response) => {
    try {
      // Implementation would store coaching logs
      res.json({ success: true });
    } catch (error: any) {
      console.error("Coaching log error:", error);
      res.status(500).json({ error: "Failed to save coaching log" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
