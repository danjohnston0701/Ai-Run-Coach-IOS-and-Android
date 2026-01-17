import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

let MapViewNative: any = null;
let PolylineNative: any = null;
let MarkerNative: any = null;
let PROVIDER_DEFAULT_NATIVE: any = null;

if (!isWeb) {
  const Maps = require('react-native-maps');
  MapViewNative = Maps.default;
  PolylineNative = Maps.Polyline;
  MarkerNative = Maps.Marker;
  PROVIDER_DEFAULT_NATIVE = Maps.PROVIDER_DEFAULT;
}

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
  if (isWeb) {
    return (
      <View style={[styles.webFallback, style]}>
        <View style={styles.webContent}>
          <Text style={styles.webTitle}>Map View</Text>
          <Text style={styles.webSubtitle}>
            Maps are available in Expo Go on your mobile device
          </Text>
          <Text style={styles.webHint}>
            Scan the QR code to run this app on your phone
          </Text>
        </View>
      </View>
    );
  }

  return (
    <MapViewNative
      ref={mapRef}
      style={style}
      provider={PROVIDER_DEFAULT_NATIVE}
      {...props}
    >
      {children}
    </MapViewNative>
  );
}

interface PolylineProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  lineCap?: string;
  lineJoin?: string;
}

export function PolylineCompat(props: PolylineProps) {
  if (isWeb || !PolylineNative) return null;
  return <PolylineNative {...props} />;
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  children?: React.ReactNode;
}

export function MarkerCompat(props: MarkerProps) {
  if (isWeb || !MarkerNative) return null;
  return <MarkerNative {...props} />;
}

const styles = StyleSheet.create({
  webFallback: {
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  webContent: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  webTitle: {
    ...Typography.h2,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  webSubtitle: {
    ...Typography.body,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  webHint: {
    ...Typography.caption,
    color: Colors.dark.primary,
    textAlign: 'center',
  },
});
