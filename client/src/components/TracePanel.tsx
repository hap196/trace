"use client";

import { useState, useEffect } from "react";
import { IoArrowBack } from "react-icons/io5";
import { IoCloudOutline } from "react-icons/io5";
import { IoWaterOutline } from "react-icons/io5";
import { IoFlaskOutline } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { IoLogIn, IoLogOut, IoLocationOutline } from "react-icons/io5";
import {
  calculateTotalEmissions,
  type RouteEmissions,
  type TotalEmissions,
  type WaterSources,
} from "@/utils/emissionCalculations";

type CarbonData = {
  co2: number;
  microplastics: number;
  waterUsage: number;
};

type TracePanelProps = {
  onDistributorChange?: (distributor: any) => void;
  onShowDistributorPopup?: (show: boolean) => void;
  onUserLocationChange?: (
    location: { lat: number; lng: number } | null
  ) => void;
  routeEmissions?: RouteEmissions;
  waterSources?: WaterSources | null;
};

export default function TracePanel({
  onDistributorChange,
  onShowDistributorPopup,
  onUserLocationChange,
  routeEmissions,
  waterSources,
}: TracePanelProps) {
  const [brand, setBrand] = useState("dasani");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<CarbonData | null>(null);
  const [totalEmissions, setTotalEmissions] = useState<TotalEmissions | null>(
    null
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [distributor, setDistributor] = useState<any>(null);
  const [distributorLoading, setDistributorLoading] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/auth-status", {
          credentials: "include",
        });
        const data = await response.json();
        setIsAuthenticated(data.authenticated || false);
      } catch (error) {
        console.error("Failed to check auth status:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();

    const handleFocus = () => {
      checkAuthStatus();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuthStatus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(checkAuthStatus, 2000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (results && routeEmissions) {
      const hasRouteData =
        routeEmissions.lastMile ||
        routeEmissions.distribution ||
        routeEmissions.manufacturing ||
        routeEmissions.waterSource ||
        routeEmissions.waterTreatment;

      if (hasRouteData) {
        const total = calculateTotalEmissions(results, routeEmissions);
        setTotalEmissions(total);
        setShowResults(true);
      }
    }
  }, [results, routeEmissions]);

  const handleAuth = () => {
    if (isAuthenticated) {
      window.location.href = "http://localhost:3001/logout";
    } else {
      window.location.href = "http://localhost:3001/login";
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
    setIsManualLocation(true);
    if (onUserLocationChange) {
      onUserLocationChange(null);
    }
  };

  const getCurrentLocation = async () => {
    setIsLocationLoading(true);
    setIsManualLocation(false);

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      setIsLocationLoading(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // Update the user location for the map
      if (onUserLocationChange) {
        onUserLocationChange({ lat: latitude, lng: longitude });
      }

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,postcode`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const place = data.features[0];
          const address = place.place_name || place.text;
          setLocation(address);
        } else {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      } else {
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      alert("Unable to get your location. Please enter it manually.");
    } finally {
      setIsLocationLoading(false);
    }
  };

  const lookupDistributor = async (zipcode: string) => {
    setDistributorLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/distributor/${zipcode}`
      );
      const data = await response.json();

      if (data.success) {
        setDistributor(data.distributor);
        if (onDistributorChange) {
          onDistributorChange(data.distributor);
        }
      } else {
        setDistributor(null);
        if (onDistributorChange) {
          onDistributorChange(null);
        }
      }
    } catch (error) {
      console.error("Error looking up distributor:", error);
      setDistributor(null);
      if (onDistributorChange) {
        onDistributorChange(null);
      }
    } finally {
      setDistributorLoading(false);
    }
  };

  const calculateFootprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculating(true);

    if (isManualLocation && location.trim()) {
      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            location
          )}.json?access_token=${mapboxToken}&limit=1`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [lng, lat] = feature.center;
            if (onUserLocationChange) {
              onUserLocationChange({ lat, lng });
            }
          }
        }
      } catch (error) {
        console.error("Error geocoding manual location:", error);
      }
    }

    const zipMatch = location.match(/\b(\d{5})\b/);
    if (zipMatch) {
      await lookupDistributor(zipMatch[1]);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const baseFootprint = {
      dasani: { co2: 0.33, microplastics: 5.2, waterUsage: 1.9 },
      smartwater: { co2: 0.35, microplastics: 4.8, waterUsage: 2.1 },
      aquafina: { co2: 0.31, microplastics: 5.0, waterUsage: 1.8 },
    };

    const footprint = baseFootprint[brand as keyof typeof baseFootprint] || {
      co2: 0.35,
      microplastics: 5.0,
      waterUsage: 2.0,
    };

    setResults(footprint);
    setIsCalculating(false);

    setTimeout(() => {
      if (onShowDistributorPopup) {
        onShowDistributorPopup(true);
      }
    }, 500);
  };

  const goBackToInput = () => {
    setShowResults(false);
    if (onShowDistributorPopup) {
      onShowDistributorPopup(false);
    }
  };

  return (
    <div className="absolute top-6 left-6 bg-white/15 backdrop-blur-xl shadow-2xl rounded-2xl p-8 w-96 h-[380px] z-10 border border-white/20 flex flex-col">
      {!showResults ? (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/water.png"
                  alt="Water bottle icon"
                  className="w-6 h-6"
                />
                <h2 className="text-2xl font-bold text-ultra-violet mb-1">
                  trace
                </h2>
              </div>
              <button
                onClick={handleAuth}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 hover:border-white/50 transition-all duration-200 text-ultra-violet font-medium text-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" />
                ) : isAuthenticated ? (
                  <>
                    <IoLogOut className="w-4 h-4" />
                    <span>logout</span>
                  </>
                ) : (
                  <>
                    <IoLogIn className="w-4 h-4" />
                    <span>login</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={calculateFootprint} className="space-y-5 flex-1">
            <div>
              <label
                htmlFor="brand"
                className="block text-sm font-semibold text-ultra-violet mb-3"
              >
                water brand
              </label>
              <select
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-3 border border-white/25 rounded-xl focus:ring-2 focus:ring-cambridge-blue focus:border-transparent bg-white/30 backdrop-blur-sm text-ultra-violet font-medium shadow-sm transition-all"
              >
                <option value="dasani" className="text-ultra-violet bg-white">
                  dasani
                </option>
                <option
                  value="smartwater"
                  className="text-ultra-violet bg-white"
                >
                  smartwater
                </option>
                <option value="aquafina" className="text-ultra-violet bg-white">
                  aquafina
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-semibold text-ultra-violet mb-3"
              >
                location
              </label>
              <div className="relative">
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={handleLocationChange}
                  placeholder={
                    isLocationLoading
                      ? "Getting location..."
                      : "Enter address or click location button"
                  }
                  className="w-full p-3 pr-12 border border-white/25 rounded-xl focus:ring-2 focus:ring-cambridge-blue focus:border-transparent bg-white/30 backdrop-blur-sm text-ultra-violet placeholder-slate-gray font-medium shadow-sm transition-all"
                />
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isLocationLoading}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg hover:bg-white/20 transition-all duration-200 disabled:opacity-50"
                  title="Get current location"
                >
                  {isLocationLoading ? (
                    <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin text-ultra-violet" />
                  ) : (
                    <IoLocationOutline className="w-4 h-4 text-ultra-violet" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isCalculating}
              className="w-full bg-gradient-to-r from-cambridge-blue to-slate-gray text-ultra-violet py-3 px-6 rounded-xl hover:from-slate-gray hover:to-cambridge-blue hover:scale-105 hover:shadow-xl hover:border-white/50 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 border-2 border-white/30"
            >
              {isCalculating ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin h-5 w-5 text-ultra-violet" />
                  <span>calculating...</span>
                </>
              ) : (
                <span>calculate impact</span>
              )}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-ultra-violet mb-1">
              environmental impact
            </h2>
          </div>
          {results && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3">
                <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-cambridge-blue/20 rounded-full flex items-center justify-center">
                        <IoCloudOutline className="w-4 h-4 text-cambridge-blue" />
                      </div>
                      <span className="text-sm font-medium text-ultra-violet">
                        co₂ emissions
                      </span>
                    </div>
                    <p className="text-lg font-bold text-ultra-violet">
                      {totalEmissions ? totalEmissions.total.co2 : results.co2}{" "}
                      kg
                    </p>
                  </div>
                </div>

                {totalEmissions && (
                  <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-ultra-violet mb-2">
                        Breakdown
                      </h4>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-gray">
                          Product manufacturing:
                        </span>
                        <span className="text-ultra-violet font-medium">
                          {totalEmissions.baseProduct.co2} kg
                        </span>
                      </div>

                      {routeEmissions?.lastMile && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-gray">
                            Last mile ({routeEmissions.lastMile.distance} km):
                          </span>
                          <span className="text-ultra-violet font-medium">
                            {routeEmissions.lastMile.co2Emissions} kg
                          </span>
                        </div>
                      )}

                      {routeEmissions?.distribution && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-gray">
                            Distribution ({routeEmissions.distribution.distance}{" "}
                            km):
                          </span>
                          <span className="text-ultra-violet font-medium">
                            {routeEmissions.distribution.co2Emissions} kg
                          </span>
                        </div>
                      )}

                      {routeEmissions?.manufacturing && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-gray">
                            Manufacturing (
                            {routeEmissions.manufacturing.distance} km):
                          </span>
                          <span className="text-ultra-violet font-medium">
                            {routeEmissions.manufacturing.co2Emissions} kg
                          </span>
                        </div>
                      )}

                      {routeEmissions?.waterSource && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-gray">
                            Water source ({routeEmissions.waterSource.distance}{" "}
                            km):
                          </span>
                          <span className="text-ultra-violet font-medium">
                            {routeEmissions.waterSource.co2Emissions} kg
                          </span>
                        </div>
                      )}

                      {routeEmissions?.waterTreatment && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-gray">
                            Water treatment (
                            {routeEmissions.waterTreatment.distance} km):
                          </span>
                          <span className="text-ultra-violet font-medium">
                            {routeEmissions.waterTreatment.co2Emissions} kg
                          </span>
                        </div>
                      )}

                      <div className="border-t border-white/30 pt-2 flex justify-between items-center">
                        <span className="text-ultra-violet font-semibold">
                          Total CO₂:
                        </span>
                        <span className="text-ultra-violet font-bold">
                          {totalEmissions.total.co2} kg
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {waterSources && (
                  <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                    <div className="mb-2">
                      <h4 className="text-sm font-semibold text-ultra-violet mb-1">
                        Water Sources
                      </h4>
                    </div>
                    <div className="space-y-3 text-xs">
                      {waterSources.municipalWaterSource && (
                        <div>
                          <h5 className="text-xs font-medium text-ultra-violet mb-1">
                            Municipal Water Source
                          </h5>
                          <p className="text-slate-gray mb-1">
                            {waterSources.municipalWaterSource.name}
                          </p>
                          <p className="text-ash-gray text-xs">
                            {waterSources.municipalWaterSource.address}
                          </p>
                          <p className="text-cambridge-blue text-xs font-medium">
                            {waterSources.municipalWaterSource.distance}
                          </p>
                        </div>
                      )}

                      {waterSources.waterTreatmentCenter && (
                        <div>
                          <h5 className="text-xs font-medium text-ultra-violet mb-1">
                            Water Treatment Center
                          </h5>
                          <p className="text-slate-gray mb-1">
                            {waterSources.waterTreatmentCenter.name}
                          </p>
                          <p className="text-ash-gray text-xs">
                            {waterSources.waterTreatmentCenter.address}
                          </p>
                          <p className="text-cambridge-blue text-xs font-medium">
                            {waterSources.waterTreatmentCenter.distance}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={goBackToInput}
                  className="flex items-center gap-2 p-2 text-slate-gray hover:text-ultra-violet hover:bg-white/10 rounded-lg transition-all"
                >
                  <IoArrowBack className="w-5 h-5" />
                  <span className="text-sm font-medium">back</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
