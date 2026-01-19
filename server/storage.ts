import { 
  users, friends, friendRequests, runs, routes, goals, 
  notifications, notificationPreferences, liveRunSessions,
  groupRuns, groupRunParticipants, events, routeRatings, runAnalyses,
  connectedDevices, deviceData, garminWellnessMetrics,
  type User, type InsertUser, type Run, type InsertRun,
  type Route, type InsertRoute, type Goal, type InsertGoal,
  type Friend, type FriendRequest, type Notification, type NotificationPreference,
  type LiveRunSession, type GroupRun, type GroupRunParticipant, type Event,
  type RouteRating, type RunAnalysis, type ConnectedDevice, type DeviceData,
  type GarminWellnessMetric
} from "@shared/schema";
import { db } from "./db";
import { eq, or, and, desc, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  searchUsers(query: string): Promise<User[]>;
  
  // Friends
  getFriends(userId: string): Promise<User[]>;
  addFriend(userId: string, friendId: string): Promise<Friend>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  
  // Friend Requests
  getFriendRequests(userId: string): Promise<FriendRequest[]>;
  createFriendRequest(requesterId: string, addresseeId: string, message?: string): Promise<FriendRequest>;
  acceptFriendRequest(id: string): Promise<void>;
  declineFriendRequest(id: string): Promise<void>;
  
  // Runs
  getRun(id: string): Promise<Run | undefined>;
  getUserRuns(userId: string): Promise<Run[]>;
  createRun(run: InsertRun): Promise<Run>;
  updateRun(id: string, data: Partial<Run>): Promise<Run | undefined>;
  
  // Routes
  getRoute(id: string): Promise<Route | undefined>;
  getUserRoutes(userId: string): Promise<Route[]>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, data: Partial<Route>): Promise<Route | undefined>;
  
  // Goals
  getGoal(id: string): Promise<Goal | undefined>;
  getUserGoals(userId: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, data: Partial<Goal>): Promise<Goal | undefined>;
  deleteGoal(id: string): Promise<void>;
  
  // Notifications
  getUserNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: any): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  
  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined>;
  updateNotificationPreferences(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference>;
  
  // Live Sessions
  getLiveSession(id: string): Promise<LiveRunSession | undefined>;
  getUserLiveSession(userId: string): Promise<LiveRunSession | undefined>;
  createLiveSession(session: any): Promise<LiveRunSession>;
  updateLiveSession(id: string, data: Partial<LiveRunSession>): Promise<LiveRunSession | undefined>;
  endLiveSession(sessionKey: string): Promise<void>;
  
  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  
  // Group Runs
  getGroupRuns(): Promise<GroupRun[]>;
  getGroupRun(id: string): Promise<GroupRun | undefined>;
  createGroupRun(groupRun: any): Promise<GroupRun>;
  joinGroupRun(groupRunId: string, userId: string): Promise<GroupRunParticipant>;
  
  // Route Ratings
  getRouteRatings(routeId: string): Promise<RouteRating[]>;
  createRouteRating(rating: any): Promise<RouteRating>;
  
  // Run Analysis
  getRunAnalysis(runId: string): Promise<RunAnalysis | undefined>;
  createRunAnalysis(runId: string, analysis: any): Promise<RunAnalysis>;
  
  // Connected Devices
  getConnectedDevices(userId: string): Promise<ConnectedDevice[]>;
  getConnectedDevice(id: string): Promise<ConnectedDevice | undefined>;
  createConnectedDevice(data: any): Promise<ConnectedDevice>;
  updateConnectedDevice(id: string, data: Partial<ConnectedDevice>): Promise<ConnectedDevice | undefined>;
  deleteConnectedDevice(id: string): Promise<void>;
  
  // Device Data
  getDeviceDataByRun(runId: string): Promise<DeviceData[]>;
  createDeviceData(data: any): Promise<DeviceData>;
  
  // Garmin Wellness
  getGarminWellnessByDate(userId: string, date: Date): Promise<GarminWellnessMetric | undefined>;
  createGarminWellness(data: any): Promise<GarminWellnessMetric>;
  updateGarminWellness(id: string, data: Partial<GarminWellnessMetric>): Promise<GarminWellnessMetric | undefined>;
  getAllActiveGarminDevices(): Promise<ConnectedDevice[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async searchUsers(query: string): Promise<User[]> {
    return db.select().from(users).where(
      or(
        ilike(users.name, `%${query}%`),
        ilike(users.email, `%${query}%`),
        ilike(users.userCode, `%${query}%`)
      )
    ).limit(20);
  }

  // Friends
  async getFriends(userId: string): Promise<User[]> {
    const friendships = await db.select().from(friends).where(
      and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, "accepted")
      )
    );
    
    const friendIds = friendships.map(f => f.userId === userId ? f.friendId : f.userId);
    if (friendIds.length === 0) return [];
    
    const friendUsers = await db.select().from(users).where(
      sql`${users.id} = ANY(${friendIds})`
    );
    return friendUsers;
  }

  async addFriend(userId: string, friendId: string): Promise<Friend> {
    const [friend] = await db.insert(friends).values({
      userId,
      friendId,
      status: "accepted"
    }).returning();
    return friend;
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await db.delete(friends).where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
        and(eq(friends.userId, friendId), eq(friends.friendId, userId))
      )
    );
  }

  // Friend Requests
  async getFriendRequests(userId: string): Promise<FriendRequest[]> {
    return db.select().from(friendRequests).where(
      and(
        eq(friendRequests.addresseeId, userId),
        eq(friendRequests.status, "pending")
      )
    );
  }

  async createFriendRequest(requesterId: string, addresseeId: string, message?: string): Promise<FriendRequest> {
    const [request] = await db.insert(friendRequests).values({
      requesterId,
      addresseeId,
      message,
      status: "pending"
    }).returning();
    return request;
  }

  async acceptFriendRequest(id: string): Promise<void> {
    const [request] = await db.select().from(friendRequests).where(eq(friendRequests.id, id));
    if (!request) return;
    
    await db.update(friendRequests).set({ 
      status: "accepted",
      respondedAt: new Date()
    }).where(eq(friendRequests.id, id));
    
    await this.addFriend(request.requesterId, request.addresseeId);
  }

  async declineFriendRequest(id: string): Promise<void> {
    await db.update(friendRequests).set({ 
      status: "declined",
      respondedAt: new Date()
    }).where(eq(friendRequests.id, id));
  }

  // Runs
  async getRun(id: string): Promise<Run | undefined> {
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    return run || undefined;
  }

  async getUserRuns(userId: string): Promise<Run[]> {
    return db.select().from(runs).where(eq(runs.userId, userId)).orderBy(desc(runs.completedAt));
  }

  async createRun(run: InsertRun): Promise<Run> {
    const [newRun] = await db.insert(runs).values(run).returning();
    return newRun;
  }

  async updateRun(id: string, data: Partial<Run>): Promise<Run | undefined> {
    const [run] = await db.update(runs).set(data).where(eq(runs.id, id)).returning();
    return run || undefined;
  }

  // Routes
  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route || undefined;
  }

  async getUserRoutes(userId: string): Promise<Route[]> {
    return db.select().from(routes).where(eq(routes.userId, userId)).orderBy(desc(routes.createdAt));
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(routes).values(route).returning();
    return newRoute;
  }

  async updateRoute(id: string, data: Partial<Route>): Promise<Route | undefined> {
    const [route] = await db.update(routes).set(data).where(eq(routes.id, id)).returning();
    return route || undefined;
  }

  // Goals
  async getGoal(id: string): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal || undefined;
  }

  async getUserGoals(userId: string): Promise<Goal[]> {
    return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async updateGoal(id: string, data: Partial<Goal>): Promise<Goal | undefined> {
    const [goal] = await db.update(goals).set({ ...data, updatedAt: new Date() }).where(eq(goals.id, id)).returning();
    return goal || undefined;
  }

  async deleteGoal(id: string): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  // Notifications
  async getUserNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: any): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // Notification Preferences
  async getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined> {
    const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return prefs || undefined;
  }

  async updateNotificationPreferences(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(notificationPreferences)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  // Live Sessions
  async getLiveSession(id: string): Promise<LiveRunSession | undefined> {
    const [session] = await db.select().from(liveRunSessions).where(eq(liveRunSessions.id, id));
    return session || undefined;
  }

  async getUserLiveSession(userId: string): Promise<LiveRunSession | undefined> {
    const [session] = await db.select().from(liveRunSessions).where(
      and(eq(liveRunSessions.userId, userId), eq(liveRunSessions.isActive, true))
    );
    return session || undefined;
  }

  async createLiveSession(session: any): Promise<LiveRunSession> {
    const [newSession] = await db.insert(liveRunSessions).values(session).returning();
    return newSession;
  }

  async updateLiveSession(id: string, data: Partial<LiveRunSession>): Promise<LiveRunSession | undefined> {
    const [session] = await db.update(liveRunSessions)
      .set({ ...data, lastSyncedAt: new Date() })
      .where(eq(liveRunSessions.id, id))
      .returning();
    return session || undefined;
  }

  async endLiveSession(sessionKey: string): Promise<void> {
    await db.update(liveRunSessions)
      .set({ isActive: false })
      .where(eq(liveRunSessions.sessionKey, sessionKey));
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return db.select().from(events).where(eq(events.isActive, true));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  // Group Runs
  async getGroupRuns(): Promise<GroupRun[]> {
    return db.select().from(groupRuns).orderBy(desc(groupRuns.createdAt));
  }

  async getGroupRun(id: string): Promise<GroupRun | undefined> {
    const [groupRun] = await db.select().from(groupRuns).where(eq(groupRuns.id, id));
    return groupRun || undefined;
  }

  async createGroupRun(groupRun: any): Promise<GroupRun> {
    const [newGroupRun] = await db.insert(groupRuns).values(groupRun).returning();
    return newGroupRun;
  }

  async joinGroupRun(groupRunId: string, userId: string): Promise<GroupRunParticipant> {
    const [participant] = await db.insert(groupRunParticipants).values({
      groupRunId,
      userId,
      role: "participant",
      invitationStatus: "accepted",
      joinedAt: new Date()
    }).returning();
    return participant;
  }

  // Route Ratings
  async getRouteRatings(routeId: string): Promise<RouteRating[]> {
    const route = await this.getRoute(routeId);
    if (!route) return [];
    return db.select().from(routeRatings).where(eq(routeRatings.startLat, route.startLat));
  }

  async createRouteRating(rating: any): Promise<RouteRating> {
    const [newRating] = await db.insert(routeRatings).values(rating).returning();
    return newRating;
  }

  // Run Analysis
  async getRunAnalysis(runId: string): Promise<RunAnalysis | undefined> {
    const [analysis] = await db.select().from(runAnalyses).where(eq(runAnalyses.runId, runId));
    return analysis || undefined;
  }

  async createRunAnalysis(runId: string, analysis: any): Promise<RunAnalysis> {
    const [newAnalysis] = await db.insert(runAnalyses).values({ runId, analysis }).returning();
    return newAnalysis;
  }

  // Connected Devices
  async getConnectedDevices(userId: string): Promise<ConnectedDevice[]> {
    return db.select().from(connectedDevices).where(eq(connectedDevices.userId, userId));
  }

  async getConnectedDevice(id: string): Promise<ConnectedDevice | undefined> {
    const [device] = await db.select().from(connectedDevices).where(eq(connectedDevices.id, id));
    return device || undefined;
  }

  async createConnectedDevice(data: any): Promise<ConnectedDevice> {
    const [device] = await db.insert(connectedDevices).values(data).returning();
    return device;
  }

  async updateConnectedDevice(id: string, data: Partial<ConnectedDevice>): Promise<ConnectedDevice | undefined> {
    const [device] = await db.update(connectedDevices).set(data).where(eq(connectedDevices.id, id)).returning();
    return device || undefined;
  }

  async deleteConnectedDevice(id: string): Promise<void> {
    await db.update(connectedDevices).set({ isActive: false }).where(eq(connectedDevices.id, id));
  }

  // Device Data
  async getDeviceDataByRun(runId: string): Promise<DeviceData[]> {
    return db.select().from(deviceData).where(eq(deviceData.runId, runId));
  }

  async createDeviceData(data: any): Promise<DeviceData> {
    const [deviceDataRow] = await db.insert(deviceData).values(data).returning();
    return deviceDataRow;
  }

  // Garmin Wellness
  async getGarminWellnessByDate(userId: string, date: Date): Promise<GarminWellnessMetric | undefined> {
    const dateStr = date.toISOString().split('T')[0];
    const [wellness] = await db.select().from(garminWellnessMetrics)
      .where(and(
        eq(garminWellnessMetrics.userId, userId),
        sql`DATE(${garminWellnessMetrics.date}) = ${dateStr}`
      ));
    return wellness || undefined;
  }

  async createGarminWellness(data: any): Promise<GarminWellnessMetric> {
    const [wellness] = await db.insert(garminWellnessMetrics).values(data).returning();
    return wellness;
  }

  async updateGarminWellness(id: string, data: Partial<GarminWellnessMetric>): Promise<GarminWellnessMetric | undefined> {
    const [wellness] = await db.update(garminWellnessMetrics).set(data).where(eq(garminWellnessMetrics.id, id)).returning();
    return wellness || undefined;
  }

  async getAllActiveGarminDevices(): Promise<ConnectedDevice[]> {
    return db.select().from(connectedDevices)
      .where(and(
        eq(connectedDevices.deviceType, 'garmin'),
        eq(connectedDevices.isActive, true)
      ));
  }
}

export const storage = new DatabaseStorage();
export type { ConnectedDevice };
