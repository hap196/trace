import MapboxMap from "@/components/MapboxMap";
import TracePanel from "@/components/TracePanel";

export default function Home() {
  const mapboxAccessToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  const mapboxStyleUrl = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL;

  return (
    <div className="relative w-full h-screen">
      <MapboxMap accessToken={mapboxAccessToken} styleUrl={mapboxStyleUrl} />
      <TracePanel />
    </div>
  );
}
