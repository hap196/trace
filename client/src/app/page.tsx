"use client";

import { useState } from "react";
import MapboxMap from "@/components/MapboxMap";
import TracePanel from "@/components/TracePanel";

export default function Home() {
  const mapboxAccessToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  const mapboxStyleUrl = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL;
  const [distributor, setDistributor] = useState<any>(null);
  const [showDistributorPopup, setShowDistributorPopup] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="relative w-full h-screen">
      <MapboxMap 
        accessToken={mapboxAccessToken} 
        styleUrl={mapboxStyleUrl} 
        distributor={distributor}
        showDistributorPopup={showDistributorPopup}
        userLocation={userLocation}
      />
      <TracePanel 
        onDistributorChange={setDistributor}
        onShowDistributorPopup={setShowDistributorPopup}
        onUserLocationChange={setUserLocation}
      />
    </div>
  );
}
