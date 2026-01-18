import React from 'react';

interface MapViewCompatProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  children?: React.ReactNode;
  onMapReady?: () => void;
  mapRef?: React.RefObject<any>;
}

export function MapViewCompat(props: MapViewCompatProps): React.ReactElement | null;

interface PolylineProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export function PolylineCompat(props: PolylineProps): React.ReactElement | null;

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  children?: React.ReactNode;
}

export function MarkerCompat(props: MarkerProps): React.ReactElement | null;
