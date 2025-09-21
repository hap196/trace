"use client";

import { useState, useEffect } from "react";
import { IoArrowBack } from "react-icons/io5";
import { IoCloudOutline } from "react-icons/io5";
import { IoWaterOutline } from "react-icons/io5";
import { IoFlaskOutline } from "react-icons/io5";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { IoLogIn, IoLogOut } from "react-icons/io5";

type CarbonData = {
  co2: number;
  microplastics: number;
  waterUsage: number;
};

export default function TracePanel() {
  const [brand, setBrand] = useState("coca-cola");
  const [drink, setDrink] = useState("water");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<CarbonData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

    // Check for auth changes every 2 seconds when component is mounted
    const interval = setInterval(checkAuthStatus, 2000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const handleAuth = () => {
    if (isAuthenticated) {
      window.location.href = "http://localhost:3001/logout";
    } else {
      window.location.href = "http://localhost:3001/login";
    }
  };

  const calculateFootprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculating(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const baseFootprint = {
      "coca-cola": {
        water: { co2: 0.33, microplastics: 5.2, waterUsage: 1.9 },
        coke: { co2: 0.42, microplastics: 5.2, waterUsage: 2.5 },
      },
    };

    const brandData = baseFootprint[brand as keyof typeof baseFootprint];
    const footprint = brandData?.[drink as keyof typeof brandData] || {
      co2: 0.35,
      microplastics: 5.0,
      waterUsage: 2.0,
    };

    setResults(footprint);
    setIsCalculating(false);
    setShowResults(true);
  };

  const goBackToInput = () => {
    setShowResults(false);
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="brand"
                  className="block text-sm font-semibold text-ultra-violet mb-3"
                >
                  bottle brand
                </label>
                <select
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full p-3 border border-white/25 rounded-xl focus:ring-2 focus:ring-cambridge-blue focus:border-transparent bg-white/30 backdrop-blur-sm text-ultra-violet font-medium shadow-sm transition-all"
                >
                  <option
                    value="coca-cola"
                    className="text-ultra-violet bg-white"
                  >
                    coca-cola
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="drink"
                  className="block text-sm font-semibold text-ultra-violet mb-3"
                >
                  drink type
                </label>
                <select
                  id="drink"
                  value={drink}
                  onChange={(e) => setDrink(e.target.value)}
                  className="w-full p-3 border border-white/25 rounded-xl focus:ring-2 focus:ring-cambridge-blue focus:border-transparent bg-white/30 backdrop-blur-sm text-ultra-violet font-medium shadow-sm transition-all"
                >
                  <option value="water" className="text-ultra-violet bg-white">
                    water
                  </option>
                  <option value="coke" className="text-ultra-violet bg-white">
                    coke
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-semibold text-ultra-violet mb-3"
              >
                location (optional)
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., new york, ny"
                className="w-full p-3 border border-white/25 rounded-xl focus:ring-2 focus:ring-cambridge-blue focus:border-transparent bg-white/30 backdrop-blur-sm text-ultra-violet placeholder-slate-gray font-medium shadow-sm transition-all"
              />
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
                      {results.co2} kg
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-gray/20 rounded-full flex items-center justify-center">
                        <IoFlaskOutline className="w-4 h-4 text-slate-gray" />
                      </div>
                      <span className="text-sm font-medium text-ultra-violet">
                        microplastics
                      </span>
                    </div>
                    <p className="text-lg font-bold text-ultra-violet">
                      {results.microplastics} μg
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-ash-gray/20 rounded-full flex items-center justify-center">
                        <IoWaterOutline className="w-4 h-4 text-ash-gray" />
                      </div>
                      <span className="text-sm font-medium text-ultra-violet">
                        water usage
                      </span>
                    </div>
                    <p className="text-lg font-bold text-ultra-violet">
                      {results.waterUsage} L
                    </p>
                  </div>
                </div>
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
