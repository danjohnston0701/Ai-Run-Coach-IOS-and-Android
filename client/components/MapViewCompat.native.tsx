import React from 'react';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';

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

export function MapViewCompat({ 
  style, 
  children, 
  mapRef,
  ...props 
}: MapViewCompatProps) {
  return (
    <MapView
      ref={mapRef}
      style={style}
      provider={PROVIDER_DEFAULT}
      {...props}
    >
      {children}
    </MapView>
  );
}

interface PolylineProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export function PolylineCompat(props: PolylineProps) {
  return <Polyline {...props} />;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  children?: React.ReactNode;
}

export function MarkerCompat(props: MarkerProps) {
  return <Marker {...props} />;
}
