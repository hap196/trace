"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  calculateDistance,
  calculateTransportationFootprint,
  type RouteEmissions,
  type TransportFootprint,
  type WaterSources,
} from "@/utils/emissionCalculations";

type MapboxMapProps = {
  accessToken: string;
  styleUrl?: string;
  distributor?: any;
  showDistributorPopup?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onEmissionsCalculated?: (emissions: RouteEmissions) => void;
  onWaterSourcesFound?: (waterSources: WaterSources) => void;
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

export default function MapboxMap({
  accessToken,
  styleUrl,
  distributor,
  showDistributorPopup,
  userLocation,
  onEmissionsCalculated,
  onWaterSourcesFound,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [distributorMarker, setDistributorMarker] =
    useState<mapboxgl.Marker | null>(null);
  const [distributorPopup, setDistributorPopup] =
    useState<mapboxgl.Popup | null>(null);
  const [userMarker, setUserMarker] = useState<mapboxgl.Marker | null>(null);
  const [productionMarker, setProductionMarker] =
    useState<mapboxgl.Marker | null>(null);
  const [manufacturingMarker, setManufacturingMarker] =
    useState<mapboxgl.Marker | null>(null);
  const [routeSource, setRouteSource] = useState<mapboxgl.GeoJSONSource | null>(
    null
  );
  const [productionRouteSource, setProductionRouteSource] =
    useState<mapboxgl.GeoJSONSource | null>(null);
  const [manufacturingRouteSource, setManufacturingRouteSource] =
    useState<mapboxgl.GeoJSONSource | null>(null);
  const [waterSourceRouteSource, setWaterSourceRouteSource] =
    useState<mapboxgl.GeoJSONSource | null>(null);
  const [waterTreatmentRouteSource, setWaterTreatmentRouteSource] =
    useState<mapboxgl.GeoJSONSource | null>(null);
  const currentUserLocation = useRef<{ lat: number; lng: number } | null>(null);
  const currentDistributor = useRef<any>(null);
  const currentProductionCenter = useRef<Location | null>(null);
  const currentManufacturingCenter = useRef<Location | null>(null);
  const [routeEmissions, setRouteEmissions] = useState<RouteEmissions>({
    lastMile: null,
    distribution: null,
    manufacturing: null,
    waterSource: null,
    waterTreatment: null,
  });
  const [waterSources, setWaterSources] = useState<WaterSources | null>(null);
  const [waterSourceMarkers, setWaterSourceMarkers] = useState<
    mapboxgl.Marker[]
  >([]);

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
    if (type === "sales") return "#718F94";
    if (type === "production") return "#90B494";
    return "#DBCFB0";
  };

  const lookupWaterSources = async (
    productionCenter: Location & { coordinates: { lat: number; lng: number } }
  ) => {
    try {
      const locationQuery = `${productionCenter.coordinates.lat},${productionCenter.coordinates.lng}`;
      const response = await fetch(
        `http://localhost:3001/api/water-sources/${encodeURIComponent(
          locationQuery
        )}`
      );
      const data = await response.json();

      if (data.success && data.waterSources) {
        setWaterSources(data.waterSources);
        if (onWaterSourcesFound) {
          onWaterSourcesFound(data.waterSources);
        }
        addWaterSourceMarkers(data.waterSources);

        setTimeout(() => {
          addWaterTransportRoutes(data.waterSources, productionCenter);
        }, 1000);
      }
    } catch (error) {
      console.error("Error looking up water sources:", error);
    }
  };

  const addWaterSourceMarkers = (waterSources: WaterSources) => {
    if (!map.current) return;

    waterSourceMarkers.forEach((marker) => marker.remove());
    const newMarkers: mapboxgl.Marker[] = [];

    if (waterSources.municipalWaterSource) {
      const marker = new mapboxgl.Marker({
        color: "#90B494",
        scale: 1.0,
      })
        .setLngLat([
          waterSources.municipalWaterSource.coordinates.lng,
          waterSources.municipalWaterSource.coordinates.lat,
        ])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          }).setHTML(`
            <div style="
              padding: 16px;
              background: rgba(255, 255, 255, 0.85);
              backdrop-filter: blur(12px);
              border-radius: 12px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              min-width: 200px;
            ">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2c3e50;">
                ${waterSources.municipalWaterSource.name}
              </h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                ${waterSources.municipalWaterSource.address}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #90B494; font-weight: 500;">
                Municipal Water Source • ${waterSources.municipalWaterSource.distance}
              </p>
            </div>
          `)
        )
        .addTo(map.current);
      newMarkers.push(marker);
    }
    if (waterSources.waterTreatmentCenter) {
      const marker = new mapboxgl.Marker({
        color: "#BFC8AD",
        scale: 1.0,
      })
        .setLngLat([
          waterSources.waterTreatmentCenter.coordinates.lng,
          waterSources.waterTreatmentCenter.coordinates.lat,
        ])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          }).setHTML(`
            <div style="
              padding: 16px;
              background: rgba(255, 255, 255, 0.85);
              backdrop-filter: blur(12px);
              border-radius: 12px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              min-width: 200px;
            ">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2c3e50;">
                ${waterSources.waterTreatmentCenter.name}
              </h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                ${waterSources.waterTreatmentCenter.address}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #BFC8AD; font-weight: 500;">
                Water Treatment Center • ${waterSources.waterTreatmentCenter.distance}
              </p>
            </div>
          `)
        )
        .addTo(map.current);
      newMarkers.push(marker);
    }

    setWaterSourceMarkers(newMarkers);
  };

  const addWaterTransportRoutes = async (
    waterSources: WaterSources,
    productionCenter: Location & { coordinates: { lat: number; lng: number } }
  ) => {
    if (!map.current) return;

    if (
      waterSources.municipalWaterSource &&
      waterSources.waterTreatmentCenter
    ) {
      await addWaterSourceRoute(
        waterSources.municipalWaterSource.coordinates,
        waterSources.waterTreatmentCenter.coordinates
      );
    }

    if (waterSources.waterTreatmentCenter) {
      await addWaterTreatmentRoute(
        waterSources.waterTreatmentCenter.coordinates,
        productionCenter.coordinates
      );
    }
  };

  const addWaterSourceRoute = async (
    waterSourceLocation: { lat: number; lng: number },
    treatmentLocation: { lat: number; lng: number }
  ) => {
    if (!map.current) return;

    if (!map.current.isStyleLoaded()) {
      setTimeout(
        () => addWaterSourceRoute(waterSourceLocation, treatmentLocation),
        500
      );
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waterSourceLocation.lng},${waterSourceLocation.lat};${treatmentLocation.lng},${treatmentLocation.lat}?geometries=geojson&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = calculateDistance(
          waterSourceLocation.lat,
          waterSourceLocation.lng,
          treatmentLocation.lat,
          treatmentLocation.lng
        );
        const footprint = calculateTransportationFootprint(distance, "truck");

        setRouteEmissions((prev) => ({
          ...prev,
          waterSource: footprint,
        }));

        if (map.current.getSource("water-source-route")) {
          if (map.current.getLayer("water-source-route")) {
            map.current.removeLayer("water-source-route");
          }
          map.current.removeSource("water-source-route");
        }

        map.current.addSource("water-source-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              distance: footprint.distance,
              co2Emissions: footprint.co2Emissions,
              transportType: footprint.transportType,
            },
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: "water-source-route",
          type: "line",
          source: "water-source-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#545775",
            "line-width": 3,
          },
        });

        map.current.on("mouseenter", "water-source-route", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";
          const coords = e.lngLat;
          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          })
            .setLngLat(coords)
            .setHTML(
              `
              <div style="
                padding: 16px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(12px);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                min-width: 200px;
              ">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2c3e50;">
                  Water Source → Treatment
                </h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                  <strong>Distance:</strong> ${footprint.distance} km
                </p>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                  <strong>CO₂ Emissions:</strong> ${footprint.co2Emissions}kg per bottle
                </p>
                <p style="margin: 0; font-size: 12px; font-weight: 500; color: #545775; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${footprint.transportType} transport
                </p>
              </div>
            `
            )
            .addTo(map.current!);
        });

        map.current.on("mouseleave", "water-source-route", () => {
          map.current!.getCanvas().style.cursor = "";
          document.querySelector(".mapboxgl-popup")?.remove();
        });

        setWaterSourceRouteSource(
          map.current.getSource("water-source-route") as mapboxgl.GeoJSONSource
        );
      }
    } catch (error) {
      console.error("Error fetching water source route:", error);
    }
  };

  const addWaterTreatmentRoute = async (
    treatmentLocation: { lat: number; lng: number },
    productionLocation: { lat: number; lng: number }
  ) => {
    if (!map.current) return;

    if (!map.current.isStyleLoaded()) {
      setTimeout(
        () => addWaterTreatmentRoute(treatmentLocation, productionLocation),
        500
      );
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${treatmentLocation.lng},${treatmentLocation.lat};${productionLocation.lng},${productionLocation.lat}?geometries=geojson&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distance = calculateDistance(
          treatmentLocation.lat,
          treatmentLocation.lng,
          productionLocation.lat,
          productionLocation.lng
        );
        const footprint = calculateTransportationFootprint(distance, "truck");

        setRouteEmissions((prev) => ({
          ...prev,
          waterTreatment: footprint,
        }));

        if (map.current.getSource("water-treatment-route")) {
          if (map.current.getLayer("water-treatment-route")) {
            map.current.removeLayer("water-treatment-route");
          }
          map.current.removeSource("water-treatment-route");
        }

        map.current.addSource("water-treatment-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              distance: footprint.distance,
              co2Emissions: footprint.co2Emissions,
              transportType: footprint.transportType,
            },
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: "water-treatment-route",
          type: "line",
          source: "water-treatment-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#545775", // ultra-violet
            "line-width": 3,
          },
        });

        map.current.on("mouseenter", "water-treatment-route", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";
          const coords = e.lngLat;
          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          })
            .setLngLat(coords)
            .setHTML(
              `
              <div style="
                padding: 16px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(12px);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                min-width: 200px;
              ">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2c3e50;">
                  Treatment → Bottling
                </h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                  <strong>Distance:</strong> ${footprint.distance} km
                </p>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d;">
                  <strong>CO₂ Emissions:</strong> ${footprint.co2Emissions}kg per bottle
                </p>
                <p style="margin: 0; font-size: 12px; font-weight: 500; color: #545775; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${footprint.transportType} transport
                </p>
              </div>
            `
            )
            .addTo(map.current!);
        });

        map.current.on("mouseleave", "water-treatment-route", () => {
          map.current!.getCanvas().style.cursor = "";
          document.querySelector(".mapboxgl-popup")?.remove();
        });

        setWaterTreatmentRouteSource(
          map.current.getSource(
            "water-treatment-route"
          ) as mapboxgl.GeoJSONSource
        );
      }
    } catch (error) {
      console.error("Error fetching water treatment route:", error);
    }
  };

  const findClosestProductionCenter = async (distributorLocation: {
    lat: number;
    lng: number;
  }) => {
    if (!locations.length) return null;

    let closestCenter = null;
    let minDistance = Infinity;

    for (const location of locations) {
      if (location.type === "production") {
        const coords = await geocodeAddress(location.address);
        if (coords) {
          const distance = calculateDistance(
            distributorLocation.lat,
            distributorLocation.lng,
            coords.lat,
            coords.lng
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestCenter = { ...location, coordinates: coords };
          }
        }
      }
    }

    return closestCenter;
  };

  const findClosestManufacturingCenter = async (productionLocation: {
    lat: number;
    lng: number;
  }) => {
    if (!locations.length) return null;

    let closestCenter = null;
    let minDistance = Infinity;

    for (const location of locations) {
      if (location.type === "manufacturing") {
        const coords = await geocodeAddress(location.address);
        if (coords) {
          const distance = calculateDistance(
            productionLocation.lat,
            productionLocation.lng,
            coords.lat,
            coords.lng
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestCenter = { ...location, coordinates: coords };
          }
        }
      }
    }

    return closestCenter;
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
                      ? "Distribution Center"
                      : location.type === "production"
                      ? "Bottling Center"
                      : "Bottle Manufacturing Center"
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

  const addDistributorMarker = (
    distributor: any,
    showPopup: boolean = false
  ) => {
    if (!map.current || !distributor || !distributor.coordinates) {
      return;
    }

    if (distributorMarker) {
      distributorMarker.remove();
    }

    const marker = new mapboxgl.Marker({
      color: "#718F94",
      scale: 1.2,
    })
      .setLngLat([distributor.coordinates.lng, distributor.coordinates.lat])
      .addTo(map.current);

    const popup = new mapboxgl.Popup({
      offset: 25,
      className: "frosted-popup",
    }).setHTML(`
      <div class="distributor-popup">
        <h3>Your Local Distributor</h3>
        <p>${distributor.bottlerOwner}</p>
        <p>${distributor.fullAddress || distributor.salesCenter}</p>
        <p>${distributor.phone}</p>
        <p>Distribution Center</p>
      </div>
    `);

    marker.setPopup(popup);
    if (showPopup) {
      marker.togglePopup();
      if (currentUserLocation.current) {
        setTimeout(() => {
          addDrivingRoute(
            currentUserLocation.current!,
            distributor.coordinates
          );
        }, 1000);
      }

      setTimeout(async () => {
        const closestProduction = await findClosestProductionCenter(
          distributor.coordinates
        );
        if (closestProduction) {
          currentProductionCenter.current = closestProduction;
          addProductionCenterMarker(closestProduction);
          addProductionRoute(
            closestProduction.coordinates,
            distributor.coordinates
          );

          lookupWaterSources(closestProduction);

          const closestManufacturing = await findClosestManufacturingCenter(
            closestProduction.coordinates
          );
          if (closestManufacturing) {
            currentManufacturingCenter.current = closestManufacturing;
            addManufacturingCenterMarker(closestManufacturing);
            addManufacturingRoute(
              closestManufacturing.coordinates,
              closestProduction.coordinates
            );
          }
        }
      }, 1500);
    }

    setDistributorMarker(marker);
    setDistributorPopup(popup);
  };

  const addUserLocationMarker = (location: { lat: number; lng: number }) => {
    if (!map.current) {
      return;
    }

    if (userMarker) {
      userMarker.remove();
    }

    const marker = new mapboxgl.Marker({
      color: "#90B494",
      scale: 1.0,
    })
      .setLngLat([location.lng, location.lat])
      .addTo(map.current);

    setUserMarker(marker);
  };

  const addProductionCenterMarker = (
    productionCenter: Location & { coordinates: { lat: number; lng: number } }
  ) => {
    if (!map.current) {
      return;
    }

    if (productionMarker) {
      productionMarker.remove();
    }

    const marker = new mapboxgl.Marker({
      color: "#90B494",
      scale: 1.1,
    })
      .setLngLat([
        productionCenter.coordinates.lng,
        productionCenter.coordinates.lat,
      ])
      .addTo(map.current);

    const popup = new mapboxgl.Popup({
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
        ">${productionCenter.name}</h3>
        <p style="
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #5a6c7d;
          line-height: 1.4;
        ">${productionCenter.address}</p>
        <p style="
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 500;
          color: #90B494;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">Bottling Center</p>
      </div>
    `);

    marker.setPopup(popup);
    setProductionMarker(marker);
  };

  const addManufacturingCenterMarker = (
    manufacturingCenter: Location & {
      coordinates: { lat: number; lng: number };
    }
  ) => {
    if (!map.current) {
      return;
    }

    if (manufacturingMarker) {
      manufacturingMarker.remove();
    }

    const marker = new mapboxgl.Marker({
      color: "#DBCFB0",
      scale: 1.1,
    })
      .setLngLat([
        manufacturingCenter.coordinates.lng,
        manufacturingCenter.coordinates.lat,
      ])
      .addTo(map.current);

    const popup = new mapboxgl.Popup({
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
        ">${manufacturingCenter.name}</h3>
        <p style="
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #5a6c7d;
          line-height: 1.4;
        ">${manufacturingCenter.address}</p>
        <p style="
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 500;
          color: #DBCFB0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">Bottle Manufacturing Center</p>
      </div>
    `);

    marker.setPopup(popup);
    setManufacturingMarker(marker);
  };

  const addDrivingRoute = async (
    userLocation: { lat: number; lng: number },
    distributorLocation: { lat: number; lng: number }
  ) => {
    if (!map.current) {
      return;
    }

    if (!map.current.isStyleLoaded()) {
      setTimeout(() => addDrivingRoute(userLocation, distributorLocation), 500);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${userLocation.lng},${userLocation.lat};${distributorLocation.lng},${distributorLocation.lat}?geometries=geojson&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          distributorLocation.lat,
          distributorLocation.lng
        );
        const footprint = calculateTransportationFootprint(
          distance,
          "last-mile"
        );

        // Update route emissions
        setRouteEmissions((prev) => ({
          ...prev,
          lastMile: footprint,
        }));

        if (map.current.getSource("route")) {
          if (map.current.getLayer("route")) {
            map.current.removeLayer("route");
          }
          map.current.removeSource("route");
        }

        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              distance: footprint.distance,
              co2Emissions: footprint.co2Emissions,
              transportType: footprint.transportType,
            },
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#545775",
            "line-width": 4,
          },
        });

        map.current.on("mouseenter", "route", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";

          const coords = e.lngLat;
          const distance = footprint.distance;
          const co2Emissions = footprint.co2Emissions;
          const transportType = footprint.transportType;

          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          })
            .setLngLat(coords)
            .setHTML(
              `
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
                ">Distribution → Your Location</h3>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>Distance:</strong> ${distance} km</p>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>CO₂ Emissions:</strong> ${co2Emissions}g per bottle</p>
                <p style="
                  margin: 0;
                  font-size: 12px;
                  font-weight: 500;
                  color: #545775;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">${transportType} transport</p>
              </div>
            `
            )
            .addTo(map.current!);
        });

        map.current.on("mouseleave", "route", () => {
          map.current!.getCanvas().style.cursor = "";
          document.querySelector(".mapboxgl-popup")?.remove();
        });

        setRouteSource(
          map.current.getSource("route") as mapboxgl.GeoJSONSource
        );
      }
    } catch (error) {
      console.error("Error fetching driving route:", error);
    }
  };

  const addManufacturingRoute = async (
    manufacturingLocation: { lat: number; lng: number },
    distributorLocation: { lat: number; lng: number }
  ) => {
    if (!map.current) {
      return;
    }

    if (!map.current.isStyleLoaded()) {
      setTimeout(
        () => addManufacturingRoute(manufacturingLocation, distributorLocation),
        500
      );
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${manufacturingLocation.lng},${manufacturingLocation.lat};${distributorLocation.lng},${distributorLocation.lat}?geometries=geojson&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        const distance = calculateDistance(
          manufacturingLocation.lat,
          manufacturingLocation.lng,
          distributorLocation.lat,
          distributorLocation.lng
        );
        const footprint = calculateTransportationFootprint(distance, "truck");

        setRouteEmissions((prev) => ({
          ...prev,
          manufacturing: footprint,
        }));

        if (map.current.getSource("manufacturing-route")) {
          if (map.current.getLayer("manufacturing-route")) {
            map.current.removeLayer("manufacturing-route");
          }
          map.current.removeSource("manufacturing-route");
        }

        map.current.addSource("manufacturing-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              distance: footprint.distance,
              co2Emissions: footprint.co2Emissions,
              transportType: footprint.transportType,
            },
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: "manufacturing-route",
          type: "line",
          source: "manufacturing-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#545775",
            "line-width": 3,
          },
        });

        map.current.on("mouseenter", "manufacturing-route", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";

          const coords = e.lngLat;
          const distance = footprint.distance;
          const co2Emissions = footprint.co2Emissions;
          const transportType = footprint.transportType;

          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          })
            .setLngLat(coords)
            .setHTML(
              `
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
                ">Manufacturing → Bottling</h3>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>Distance:</strong> ${distance} km</p>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>CO₂ Emissions:</strong> ${co2Emissions}g per bottle</p>
                <p style="
                  margin: 0;
                  font-size: 12px;
                  font-weight: 500;
                  color: #545775;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">${transportType} transport</p>
              </div>
            `
            )
            .addTo(map.current!);
        });

        map.current.on("mouseleave", "manufacturing-route", () => {
          map.current!.getCanvas().style.cursor = "";
          document.querySelector(".mapboxgl-popup")?.remove();
        });

        setManufacturingRouteSource(
          map.current.getSource("manufacturing-route") as mapboxgl.GeoJSONSource
        );
      }
    } catch (error) {
      console.error("Error fetching manufacturing route:", error);
    }
  };

  const addProductionRoute = async (
    productionLocation: { lat: number; lng: number },
    distributorLocation: { lat: number; lng: number }
  ) => {
    if (!map.current) {
      return;
    }

    if (!map.current.isStyleLoaded()) {
      setTimeout(
        () => addProductionRoute(productionLocation, distributorLocation),
        500
      );
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${productionLocation.lng},${productionLocation.lat};${distributorLocation.lng},${distributorLocation.lat}?geometries=geojson&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        const distance = calculateDistance(
          productionLocation.lat,
          productionLocation.lng,
          distributorLocation.lat,
          distributorLocation.lng
        );
        const footprint = calculateTransportationFootprint(distance, "truck");

        setRouteEmissions((prev) => ({
          ...prev,
          distribution: footprint,
        }));

        if (map.current.getSource("production-route")) {
          if (map.current.getLayer("production-route")) {
            map.current.removeLayer("production-route");
          }
          map.current.removeSource("production-route");
        }

        map.current.addSource("production-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              distance: footprint.distance,
              co2Emissions: footprint.co2Emissions,
              transportType: footprint.transportType,
            },
            geometry: route.geometry,
          },
        });

        map.current.addLayer({
          id: "production-route",
          type: "line",
          source: "production-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#545775",
            "line-width": 3,
          },
        });

        map.current.on("mouseenter", "production-route", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";

          const coords = e.lngLat;
          const distance = footprint.distance;
          const co2Emissions = footprint.co2Emissions;
          const transportType = footprint.transportType;

          new mapboxgl.Popup({
            offset: 25,
            className: "frosted-popup",
          })
            .setLngLat(coords)
            .setHTML(
              `
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
                ">Bottling → Distribution</h3>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>Distance:</strong> ${distance} km</p>
                <p style="
                  margin: 0 0 8px 0;
                  font-size: 14px;
                  color: #5a6c7d;
                  line-height: 1.4;
                "><strong>CO₂ Emissions:</strong> ${co2Emissions}g per bottle</p>
                <p style="
                  margin: 0;
                  font-size: 12px;
                  font-weight: 500;
                  color: #545775;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">${transportType} transport</p>
              </div>
            `
            )
            .addTo(map.current!);
        });

        map.current.on("mouseleave", "production-route", () => {
          map.current!.getCanvas().style.cursor = "";
          document.querySelector(".mapboxgl-popup")?.remove();
        });

        setProductionRouteSource(
          map.current.getSource("production-route") as mapboxgl.GeoJSONSource
        );
      }
    } catch (error) {
      console.error("Error fetching production route:", error);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (onEmissionsCalculated) {
      onEmissionsCalculated(routeEmissions);
    }
  }, [routeEmissions, onEmissionsCalculated]);

  useEffect(() => {
    if (distributor && map.current) {
      currentDistributor.current = distributor;
      addDistributorMarker(distributor, false);
    }
  }, [distributor]);

  useEffect(() => {
    if (
      showDistributorPopup &&
      currentDistributor.current &&
      currentDistributor.current.coordinates
    ) {
      addDistributorMarker(currentDistributor.current, true);
    }
  }, [showDistributorPopup]);

  useEffect(() => {
    if (userLocation && map.current) {
      currentUserLocation.current = userLocation;
      addUserLocationMarker(userLocation);
    }
  }, [userLocation]);

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

        map.current.on("load", () => {});

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
        if (distributorMarker) {
          distributorMarker.remove();
        }
        if (userMarker) {
          userMarker.remove();
        }
        if (productionMarker) {
          productionMarker.remove();
        }
        if (manufacturingMarker) {
          manufacturingMarker.remove();
        }
        waterSourceMarkers.forEach((marker) => marker.remove());
        if (map.current.getSource("route")) {
          map.current.removeLayer("route");
          map.current.removeSource("route");
        }
        if (map.current.getSource("production-route")) {
          map.current.removeLayer("production-route");
          map.current.removeSource("production-route");
        }
        if (map.current.getSource("manufacturing-route")) {
          map.current.removeLayer("manufacturing-route");
          map.current.removeSource("manufacturing-route");
        }
        if (map.current.getSource("water-source-route")) {
          map.current.removeLayer("water-source-route");
          map.current.removeSource("water-source-route");
        }
        if (map.current.getSource("water-treatment-route")) {
          map.current.removeLayer("water-treatment-route");
          map.current.removeSource("water-treatment-route");
        }
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
