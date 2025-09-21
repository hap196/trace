export type TransportType = "truck" | "rail" | "ship" | "last-mile";

export type TransportFootprint = {
  distance: number;
  co2Emissions: number;
  transportType: TransportType;
};

export type WaterSource = {
  name: string;
  address: string;
  distance: string;
  coordinates: { lat: number; lng: number };
};

export type WaterSources = {
  municipalWaterSource: WaterSource;
  waterTreatmentCenter: WaterSource;
};

export type RouteEmissions = {
  lastMile: TransportFootprint | null;
  distribution: TransportFootprint | null;
  manufacturing: TransportFootprint | null;
  waterSource: TransportFootprint | null;
  waterTreatment: TransportFootprint | null;
};

export type TotalEmissions = {
  baseProduct: {
    co2: number;
    microplastics: number;
    waterUsage: number;
  };
  transportation: {
    co2: number;
    totalDistance: number;
  };
  total: {
    co2: number;
    microplastics: number;
    waterUsage: number;
  };
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateTransportationFootprint = (
  distance: number,
  transportType: TransportType
): TransportFootprint => {
  const emissionsFactors = {
    truck: 0.15,
    rail: 0.03,
    ship: 0.01,
    "last-mile": 0.25,
  };

  const bottleWeight = 0.025;
  const co2PerKm = emissionsFactors[transportType] * bottleWeight;

  return {
    distance: Math.round(distance * 10) / 10,
    co2Emissions: Math.round(distance * co2PerKm * 1000) / 1000,
    transportType,
  };
};

export const calculateTotalEmissions = (
  baseProductFootprint: {
    co2: number;
    microplastics: number;
    waterUsage: number;
  },
  routeEmissions: RouteEmissions
): TotalEmissions => {
  let totalTransportationCO2 = 0;
  let totalDistance = 0;

  if (routeEmissions.lastMile) {
    totalTransportationCO2 += routeEmissions.lastMile.co2Emissions;
    totalDistance += routeEmissions.lastMile.distance;
  }

  if (routeEmissions.distribution) {
    totalTransportationCO2 += routeEmissions.distribution.co2Emissions;
    totalDistance += routeEmissions.distribution.distance;
  }

  if (routeEmissions.manufacturing) {
    totalTransportationCO2 += routeEmissions.manufacturing.co2Emissions;
    totalDistance += routeEmissions.manufacturing.distance;
  }

  if (routeEmissions.waterSource) {
    totalTransportationCO2 += routeEmissions.waterSource.co2Emissions;
    totalDistance += routeEmissions.waterSource.distance;
  }

  if (routeEmissions.waterTreatment) {
    totalTransportationCO2 += routeEmissions.waterTreatment.co2Emissions;
    totalDistance += routeEmissions.waterTreatment.distance;
  }

  const totalCO2 = baseProductFootprint.co2 + totalTransportationCO2;

  return {
    baseProduct: baseProductFootprint,
    transportation: {
      co2: Math.round(totalTransportationCO2 * 1000) / 1000,
      totalDistance: Math.round(totalDistance * 10) / 10,
    },
    total: {
      co2: Math.round(totalCO2 * 1000) / 1000,
      microplastics: baseProductFootprint.microplastics,
      waterUsage: baseProductFootprint.waterUsage,
    },
  };
};
