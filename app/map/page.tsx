"use client";
import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";

const position: LatLngExpression = [31.1417539449555, 481.4964079856873]; // Example coordinates (London)

const MapComponent = dynamic(() => import("./MapLeaflet"), { ssr: false });

export default function Map() {
  return <MapComponent position={position} />;
}
