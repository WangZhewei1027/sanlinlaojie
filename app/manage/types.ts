export interface LocationData {
  longitude: number;
  latitude: number;
  height: number;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
}

export interface Asset {
  id: string;
  file_type: string;
  file_url: string | null;
  text_content?: string | null; // 文本类型的内容
  metadata: {
    longitude?: number;
    latitude?: number;
    height?: number;
    gps_source?: string;
  };
}

// iframe 通信消息类型
export type ViewerMessageType =
  | "SET_WORKSPACE"
  | "SET_ASSETS"
  | "LOCATION_CLICKED"
  | "ASSETS_UPDATE"
  | "VIEWER_READY"
  | "FOCUS_ASSET"
  | "CAMERA_POSITION";

export interface ViewerMessage {
  type: ViewerMessageType;
  payload: unknown;
  source?: string;
  version?: number;
}
