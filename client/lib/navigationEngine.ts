import { speechQueue } from './speechQueue';
import { getApiUrl } from './query-client';

export interface RouteWaypoint {
  lat: number;
  lng: number;
  instruction: string;
  direction?: 'left' | 'right' | 'straight' | 'u-turn' | 'destination';
  distanceFromStart: number;
  isProtected?: boolean;
}

export interface NavigationState {
  currentWaypointIndex: number;
  distanceToNextTurn: number;
  nextInstruction: string;
  isOffRoute: boolean;
  hasAnnounced90m: boolean;
  hasAnnounced35m: boolean;
  passedTurn: boolean;
}

const TURN_GROUPING_DISTANCE = 150;
const APPROACH_DISTANCE_90M = 90;
const APPROACH_DISTANCE_35M = 35;
const WAYPOINT_REACHED_DISTANCE = 25;
const OFF_ROUTE_THRESHOLD = 50;
const PROTECTED_WAYPOINT_THRESHOLD = 0.6;

class NavigationEngine {
  private waypoints: RouteWaypoint[] = [];
  private state: NavigationState = this.getInitialState();
  private routeTotalDistance = 0;
  private onStateChange: ((state: NavigationState) => void) | null = null;

  private getInitialState(): NavigationState {
    return {
      currentWaypointIndex: 0,
      distanceToNextTurn: 0,
      nextInstruction: '',
      isOffRoute: false,
      hasAnnounced90m: false,
      hasAnnounced35m: false,
      passedTurn: false,
    };
  }

  initialize(
    waypoints: RouteWaypoint[],
    totalDistance: number,
    onStateChange?: (state: NavigationState) => void
  ) {
    this.waypoints = this.processWaypoints(waypoints, totalDistance);
    this.routeTotalDistance = totalDistance;
    this.state = this.getInitialState();
    this.onStateChange = onStateChange || null;

    if (this.waypoints.length > 0) {
      this.state.nextInstruction = this.waypoints[0].instruction;
    }
  }

  private processWaypoints(
    waypoints: RouteWaypoint[],
    totalDistance: number
  ): RouteWaypoint[] {
    const processed: RouteWaypoint[] = [];
    let lastAddedIndex = -1;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];

      if (
        lastAddedIndex >= 0 &&
        this.calculateDistance(
          processed[lastAddedIndex].lat,
          processed[lastAddedIndex].lng,
          wp.lat,
          wp.lng
        ) < TURN_GROUPING_DISTANCE
      ) {
        continue;
      }

      const progressRatio = wp.distanceFromStart / totalDistance;
      const isProtected = progressRatio >= PROTECTED_WAYPOINT_THRESHOLD;

      processed.push({
        ...wp,
        isProtected,
        direction: this.inferDirection(wp.instruction),
      });
      lastAddedIndex = processed.length - 1;
    }

    return processed;
  }

  private inferDirection(
    instruction: string
  ): 'left' | 'right' | 'straight' | 'u-turn' | 'destination' {
    const lower = instruction.toLowerCase();
    if (lower.includes('destination') || lower.includes('finish') || lower.includes('arrived')) {
      return 'destination';
    }
    if (lower.includes('u-turn') || lower.includes('make a u')) {
      return 'u-turn';
    }
    if (lower.includes('left')) {
      return 'left';
    }
    if (lower.includes('right')) {
      return 'right';
    }
    return 'straight';
  }

  updatePosition(lat: number, lng: number, currentDistance: number): NavigationState {
    if (this.waypoints.length === 0) {
      return this.state;
    }

    const currentWaypoint = this.waypoints[this.state.currentWaypointIndex];
    if (!currentWaypoint) {
      return this.state;
    }

    const distanceToWaypoint = this.calculateDistance(
      lat,
      lng,
      currentWaypoint.lat,
      currentWaypoint.lng
    );

    this.state.distanceToNextTurn = distanceToWaypoint;

    if (distanceToWaypoint <= APPROACH_DISTANCE_90M && !this.state.hasAnnounced90m) {
      this.announce90m(currentWaypoint, distanceToWaypoint);
      this.state.hasAnnounced90m = true;
    }

    if (distanceToWaypoint <= APPROACH_DISTANCE_35M && !this.state.hasAnnounced35m) {
      this.announce35m(currentWaypoint);
      this.state.hasAnnounced35m = true;
    }

    if (distanceToWaypoint <= WAYPOINT_REACHED_DISTANCE) {
      if (this.validateWaypointReached(currentWaypoint, lat, lng)) {
        this.advanceToNextWaypoint();
      }
    } else if (this.state.hasAnnounced35m && distanceToWaypoint > APPROACH_DISTANCE_35M + 20) {
      if (!currentWaypoint.isProtected) {
        this.handlePassedTurn(currentWaypoint);
      }
    }

    this.checkOffRoute(lat, lng, currentDistance);

    this.onStateChange?.(this.state);
    return this.state;
  }

  private validateWaypointReached(
    waypoint: RouteWaypoint,
    lat: number,
    lng: number
  ): boolean {
    const distance = this.calculateDistance(lat, lng, waypoint.lat, waypoint.lng);
    
    if (distance > WAYPOINT_REACHED_DISTANCE) {
      return false;
    }

    return true;
  }

  private advanceToNextWaypoint() {
    this.state.currentWaypointIndex++;
    this.state.hasAnnounced90m = false;
    this.state.hasAnnounced35m = false;
    this.state.passedTurn = false;

    if (this.state.currentWaypointIndex < this.waypoints.length) {
      const nextWaypoint = this.waypoints[this.state.currentWaypointIndex];
      this.state.nextInstruction = nextWaypoint.instruction;
    } else {
      this.state.nextInstruction = 'You have reached your destination';
      speechQueue.enqueueNavigation('You have reached your destination. Great job!');
    }
  }

  private handlePassedTurn(waypoint: RouteWaypoint) {
    if (this.state.passedTurn) return;

    this.state.passedTurn = true;
    speechQueue.enqueueNavigation(
      `You may have passed your turn. ${waypoint.instruction}`
    );
  }

  private announce90m(waypoint: RouteWaypoint, distance: number) {
    const roundedDistance = Math.round(distance / 10) * 10;
    const directionText = this.getDirectionText(waypoint.direction);
    speechQueue.enqueueNavigation(
      `In ${roundedDistance} meters, ${directionText}`
    );
  }

  private announce35m(waypoint: RouteWaypoint) {
    const directionText = this.getDirectionText(waypoint.direction);
    speechQueue.enqueueNavigation(directionText);
  }

  private getDirectionText(direction?: string): string {
    switch (direction) {
      case 'left':
        return 'turn left';
      case 'right':
        return 'turn right';
      case 'u-turn':
        return 'make a U-turn';
      case 'destination':
        return 'your destination is ahead';
      case 'straight':
      default:
        return 'continue straight';
    }
  }

  private checkOffRoute(lat: number, lng: number, currentDistance: number) {
    const minDistanceToRoute = this.findMinDistanceToRoute(lat, lng);
    
    if (minDistanceToRoute > OFF_ROUTE_THRESHOLD) {
      if (!this.state.isOffRoute) {
        this.state.isOffRoute = true;
        speechQueue.enqueueNavigation('You appear to be off route. Recalculating.');
        this.recalibrateToNearestPoint(lat, lng, currentDistance);
      }
    } else {
      this.state.isOffRoute = false;
    }
  }

  private findMinDistanceToRoute(lat: number, lng: number): number {
    let minDistance = Infinity;

    for (const waypoint of this.waypoints) {
      const distance = this.calculateDistance(lat, lng, waypoint.lat, waypoint.lng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  private recalibrateToNearestPoint(lat: number, lng: number, currentDistance: number) {
    let nearestIndex = this.state.currentWaypointIndex;
    let minDistance = Infinity;

    for (let i = this.state.currentWaypointIndex; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];
      const distance = this.calculateDistance(lat, lng, wp.lat, wp.lng);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    if (nearestIndex !== this.state.currentWaypointIndex) {
      this.state.currentWaypointIndex = nearestIndex;
      this.state.hasAnnounced90m = false;
      this.state.hasAnnounced35m = false;
      this.state.passedTurn = false;
      this.state.nextInstruction = this.waypoints[nearestIndex].instruction;
    }
  }

  async fetchStreetName(lat: number, lng: number): Promise<string | null> {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}/api/geocode/reverse?lat=${lat}&lng=${lng}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        return data.street || data.road || null;
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
    return null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getState(): NavigationState {
    return { ...this.state };
  }

  getCurrentInstruction(): string {
    return this.state.nextInstruction;
  }

  getDistanceToNextTurn(): number {
    return this.state.distanceToNextTurn;
  }

  isOffRoute(): boolean {
    return this.state.isOffRoute;
  }

  getRemainingWaypoints(): number {
    return this.waypoints.length - this.state.currentWaypointIndex;
  }

  reset() {
    this.waypoints = [];
    this.state = this.getInitialState();
    this.routeTotalDistance = 0;
  }
}

export const navigationEngine = new NavigationEngine();
