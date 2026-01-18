import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const PRODUCTION_API = "https://airuncoach.live";

async function proxyRequest(req: Request, res: Response, endpoint: string) {
  try {
    const url = `${PRODUCTION_API}${endpoint}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
      console.log(`Request body:`, JSON.stringify(req.body).slice(0, 200));
    }

    console.log(`Proxying ${req.method} request to: ${url}`);

    const response = await fetch(url, fetchOptions);
    
    console.log(`Response status: ${response.status}`);
    
    const contentType = response.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      console.log(`Response data:`, JSON.stringify(data).slice(0, 200));
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      console.log(`Response text:`, text.slice(0, 200));
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error("Proxy error:", error.message);
    res.status(500).json({ 
      message: "Failed to connect to API server",
      error: error.message 
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Proxy routes to production API
  
  // Route generation
  app.post("/api/routes/generate-options", async (req, res) => {
    await proxyRequest(req, res, "/api/routes/generate-options");
  });

  // Save route
  app.post("/api/routes", async (req, res) => {
    await proxyRequest(req, res, "/api/routes");
  });

  // Get user routes
  app.get("/api/routes/user/:userId", async (req, res) => {
    await proxyRequest(req, res, `/api/routes/user/${req.params.userId}`);
  });

  // Get single route
  app.get("/api/routes/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/routes/${req.params.id}`);
  });

  // Runs
  app.post("/api/runs", async (req, res) => {
    await proxyRequest(req, res, "/api/runs");
  });

  app.post("/api/runs/sync-progress", async (req, res) => {
    await proxyRequest(req, res, "/api/runs/sync-progress");
  });

  app.get("/api/runs/user/:userId", async (req, res) => {
    await proxyRequest(req, res, `/api/runs/user/${req.params.userId}`);
  });

  app.get("/api/runs/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/runs/${req.params.id}`);
  });

  app.post("/api/runs/:id/ai-insights", async (req, res) => {
    await proxyRequest(req, res, `/api/runs/${req.params.id}/ai-insights`);
  });

  // Auth
  app.post("/api/auth/register", async (req, res) => {
    await proxyRequest(req, res, "/api/auth/register");
  });

  app.post("/api/auth/login", async (req, res) => {
    await proxyRequest(req, res, "/api/auth/login");
  });

  // Users
  app.get("/api/users/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/users/${req.params.id}`);
  });

  app.put("/api/users/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/users/${req.params.id}`);
  });

  // AI Coaching
  app.post("/api/ai/coach", async (req, res) => {
    await proxyRequest(req, res, "/api/ai/coach");
  });

  app.post("/api/ai/tts", async (req, res) => {
    await proxyRequest(req, res, "/api/ai/tts");
  });

  // Coaching logs
  app.post("/api/coaching-logs/:sessionKey", async (req, res) => {
    await proxyRequest(req, res, `/api/coaching-logs/${req.params.sessionKey}`);
  });

  // Events
  app.get("/api/events/grouped", async (req, res) => {
    await proxyRequest(req, res, "/api/events/grouped");
  });

  app.post("/api/events/from-run/:runId", async (req, res) => {
    await proxyRequest(req, res, `/api/events/from-run/${req.params.runId}`);
  });

  // Goals
  app.get("/api/goals", async (req, res) => {
    const userId = req.query.userId;
    await proxyRequest(req, res, `/api/goals${userId ? `?userId=${userId}` : ''}`);
  });

  app.post("/api/goals", async (req, res) => {
    await proxyRequest(req, res, "/api/goals");
  });

  app.put("/api/goals/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/goals/${req.params.id}`);
  });

  app.delete("/api/goals/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/goals/${req.params.id}`);
  });

  // Talk to Coach - User question during run
  app.post("/api/ai/coaching", async (req, res) => {
    await proxyRequest(req, res, "/api/ai/coaching");
  });

  // Friends
  app.get("/api/friends", async (req, res) => {
    const userId = req.query.userId;
    await proxyRequest(req, res, `/api/friends${userId ? `?userId=${userId}` : ''}`);
  });

  // Live Sessions
  app.put("/api/live-sessions/sync", async (req, res) => {
    await proxyRequest(req, res, "/api/live-sessions/sync");
  });

  app.post("/api/live-sessions/:sessionId/invite-observer", async (req, res) => {
    await proxyRequest(req, res, `/api/live-sessions/${req.params.sessionId}/invite-observer`);
  });

  app.post("/api/live-sessions/:sessionId/observer-joined", async (req, res) => {
    await proxyRequest(req, res, `/api/live-sessions/${req.params.sessionId}/observer-joined`);
  });

  app.get("/api/live-sessions/:sessionId", async (req, res) => {
    await proxyRequest(req, res, `/api/live-sessions/${req.params.sessionId}`);
  });

  app.get("/api/users/:userId/live-session", async (req, res) => {
    await proxyRequest(req, res, `/api/users/${req.params.userId}/live-session`);
  });

  app.post("/api/live-sessions/end-by-key", async (req, res) => {
    await proxyRequest(req, res, "/api/live-sessions/end-by-key");
  });

  // Notification Preferences
  app.get("/api/notification-preferences/:userId", async (req, res) => {
    await proxyRequest(req, res, `/api/notification-preferences/${req.params.userId}`);
  });

  app.put("/api/notification-preferences/:userId", async (req, res) => {
    await proxyRequest(req, res, `/api/notification-preferences/${req.params.userId}`);
  });

  // Weather
  app.get("/api/weather/current", async (req, res) => {
    const { lat, lng } = req.query;
    await proxyRequest(req, res, `/api/weather/current?lat=${lat}&lng=${lng}`);
  });

  app.get("/api/weather/full", async (req, res) => {
    const { lat, lng } = req.query;
    await proxyRequest(req, res, `/api/weather/full?lat=${lat}&lng=${lng}`);
  });

  // Geocoding
  app.get("/api/geocode/reverse", async (req, res) => {
    const { lat, lng } = req.query;
    await proxyRequest(req, res, `/api/geocode/reverse?lat=${lat}&lng=${lng}`);
  });

  // Pre-run summary
  app.post("/api/ai/run-summary", async (req, res) => {
    await proxyRequest(req, res, "/api/ai/run-summary");
  });

  // Run analysis
  app.get("/api/runs/:id/analysis", async (req, res) => {
    await proxyRequest(req, res, `/api/runs/${req.params.id}/analysis`);
  });

  app.post("/api/runs/:id/analysis", async (req, res) => {
    await proxyRequest(req, res, `/api/runs/${req.params.id}/analysis`);
  });

  // Group Runs
  app.get("/api/group-runs", async (req, res) => {
    await proxyRequest(req, res, "/api/group-runs");
  });

  app.post("/api/group-runs", async (req, res) => {
    await proxyRequest(req, res, "/api/group-runs");
  });

  app.get("/api/group-runs/:id", async (req, res) => {
    await proxyRequest(req, res, `/api/group-runs/${req.params.id}`);
  });

  app.post("/api/group-runs/:id/join", async (req, res) => {
    await proxyRequest(req, res, `/api/group-runs/${req.params.id}/join`);
  });

  app.post("/api/group-runs/:id/start", async (req, res) => {
    await proxyRequest(req, res, `/api/group-runs/${req.params.id}/start`);
  });

  // Friend Requests
  app.post("/api/friend-requests", async (req, res) => {
    await proxyRequest(req, res, "/api/friend-requests");
  });

  app.post("/api/friend-requests/:id/accept", async (req, res) => {
    await proxyRequest(req, res, `/api/friend-requests/${req.params.id}/accept`);
  });

  app.post("/api/friend-requests/:id/decline", async (req, res) => {
    await proxyRequest(req, res, `/api/friend-requests/${req.params.id}/decline`);
  });

  // User Search
  app.get("/api/users/search", async (req, res) => {
    const { q } = req.query;
    await proxyRequest(req, res, `/api/users/search?q=${encodeURIComponent(String(q || ''))}`);
  });

  // Subscriptions
  app.get("/api/subscriptions/status", async (req, res) => {
    await proxyRequest(req, res, "/api/subscriptions/status");
  });

  app.post("/api/subscriptions/create-checkout", async (req, res) => {
    await proxyRequest(req, res, "/api/subscriptions/create-checkout");
  });

  // Coupons
  app.post("/api/coupons/redeem", async (req, res) => {
    await proxyRequest(req, res, "/api/coupons/redeem");
  });

  // Push Subscriptions
  app.post("/api/push-subscriptions", async (req, res) => {
    await proxyRequest(req, res, "/api/push-subscriptions");
  });

  app.delete("/api/push-subscriptions", async (req, res) => {
    await proxyRequest(req, res, "/api/push-subscriptions");
  });

  const httpServer = createServer(app);

  return httpServer;
}
