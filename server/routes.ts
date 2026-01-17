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

  const httpServer = createServer(app);

  return httpServer;
}
