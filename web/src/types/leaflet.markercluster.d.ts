import type { DivIcon, FeatureGroup, Marker, MarkerOptions } from "leaflet";
import type { FarmMapPoint } from "@/lib/data/farm-geo-summary";

declare module "leaflet" {
  export type MarkerClusterGroupOptions = {
    maxClusterRadius?: number;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    disableClusteringAtZoom?: number;
    zoomToBoundsOnClick?: boolean;
    iconCreateFunction?: (cluster: {
      getChildCount: () => number;
      getAllChildMarkers: () => Marker[];
    }) => DivIcon;
  };

  export interface MarkerClusterGroup extends FeatureGroup {
    clearLayers(): this;
  }

  export type ClusterLayer = {
    getAllChildMarkers: () => Marker[];
    bindTooltip: (
      content: string,
      options?: object
    ) => { openTooltip: () => void };
    closeTooltip: () => void;
    unbindTooltip: () => void;
    bindPopup: (
      content: string,
      options?: object
    ) => { openPopup: () => void };
  };

  interface MarkerOptions {
    farmPoint?: FarmMapPoint;
  }

  export function markerClusterGroup(
    options?: MarkerClusterGroupOptions
  ): MarkerClusterGroup;
}

export {};
