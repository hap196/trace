"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapboxMapProps = {
  accessToken: string;
  styleUrl?: string;
};

type Location = {
  _id: string;
  name: string;
  address: string;
  type: "sales" | "production" | "manufacturing";
  coordinates?: {
    lng: number;
    lat: number;
  };
};

export default function MapboxMap({ accessToken, styleUrl }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const geocodeAddress = async (address: string) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          address
        )}.json?access_token=${accessToken}&limit=1`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lng, lat };
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  // Fetch locations from API
  const fetchLocations = async () => {
    try {
      console.log("Fetching locations from API...");
      const response = await fetch("http://localhost:3001/api/locations");
      if (response.ok) {
        const data = await response.json();
        console.log("Locations fetched:", data.count, "locations");
        setLocations(data.locations);
      } else {
        console.error("Failed to fetch locations, status:", response.status);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMarkerColor = (type: string) => {
    if (type === "sales") return "#545775";
    if (type === "production") return "#90B494";
    return "#DBCFB0";
  };

  const addLocationMarkers = async () => {
    if (!map.current || locations.length === 0) {
      return;
    }

    markers.forEach((marker) => marker.remove());

    const newMarkers: mapboxgl.Marker[] = [];

    for (const location of locations) {
      const coords = await geocodeAddress(location.address);

      if (coords) {
        const marker = new mapboxgl.Marker({
          color: getMarkerColor(location.type),
        })
          .setLngLat([coords.lng, coords.lat])
          .setPopup(
            new mapboxgl.Popup({
              offset: 25,
              className: "frosted-popup",
            }).setHTML(`
                <div style="
                  padding: 16px;
                  background: rgba(255, 255, 255, 0.85);
                  backdrop-filter: blur(12px);
                  -webkit-backdrop-filter: blur(12px);
                  border-radius: 12px;
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                  min-width: 200px;
                ">
                  <h3 style="
                    margin: 0 0 8px 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #2c3e50;
                    line-height: 1.3;
                  ">${location.name}</h3>
                  <p style="
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    color: #5a6c7d;
                    line-height: 1.4;
                  ">${location.address}</p>
                  <p style="
                    margin: 0;
                    font-size: 12px;
                    font-weight: 500;
                    color: ${getMarkerColor(location.type)};
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">${
                    location.type === "sales"
                      ? "Sales Center"
                      : location.type === "production"
                      ? "Production Center"
                      : "Manufacturing Center"
                  }</p>
                </div>
              `)
          )
          .addTo(map.current);

        newMarkers.push(marker);
      }
    }

    setMarkers(newMarkers);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (locations.length > 0 && map.current) {
      addLocationMarkers();
    }
  }, [locations, accessToken]);

  useEffect(() => {
    if (map.current) return;

    if (!accessToken) {
      console.error("No Mapbox access token provided");
      return;
    }

    mapboxgl.accessToken = accessToken;

    if (mapContainer.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: styleUrl || "mapbox://styles/mapbox/streets-v12",
          center: [-75.191028, 39.951698],
          zoom: 6,
        });

        map.current.on("load", () => {
          console.log(
            "Map loaded successfully, locations available:",
            locations.length
          );
          if (locations.length > 0) {
            addLocationMarkers();
          }
        });

        map.current.on("error", (e) => {
          console.error("Map error:", e);
        });
      } catch (error) {
        console.error("Error creating map:", error);
      }
    }

    return () => {
      if (map.current) {
        markers.forEach((marker) => marker.remove());
        map.current.remove();
        map.current = null;
      }
    };
  }, [accessToken, styleUrl]);

  return (
    <div className="w-full h-screen relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading locations...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
