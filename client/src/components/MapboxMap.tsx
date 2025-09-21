"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapboxMapProps = {
  accessToken: string;
  styleUrl?: string;
};

export default function MapboxMap({ accessToken, styleUrl }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return;

    mapboxgl.accessToken = accessToken;

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl || "mapbox://styles/mapbox/streets-v12",
        center: [-75.191028, 39.951698],
        zoom: 9,
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [accessToken, styleUrl]);

  return <div ref={mapContainer} className="w-full h-screen" />;
}
