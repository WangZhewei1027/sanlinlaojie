"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvent,
} from "react-leaflet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer";
import React, { useState, useEffect } from "react";
import { submitMapInfo, fetchAllMapData } from "./utils";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import L from "leaflet";

const DefaultIcon = L.icon({
  iconUrl: typeof icon === "string" ? icon : icon.src,
  shadowUrl: typeof iconShadow === "string" ? iconShadow : iconShadow.src,
  iconAnchor: [12, 41], // 底部中间对齐，标准Leaflet marker尺寸为 25x41
  popupAnchor: [0, -41],
  tooltipAnchor: [12, -28],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapLeafletProps {
  position: LatLngExpression;
}

export default function MapLeaflet({ position }: MapLeafletProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState<[number, number] | null>(
    null
  );
  const [form, setForm] = useState({
    lat: "",
    lng: "",
    message: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allMarkers, setAllMarkers] = useState<Array<any>>([]);

  useEffect(() => {
    fetchAllMapData()
      .then((data) => {
        setAllMarkers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("获取地图数据失败", err);
      });
  }, []);

  function MapClickHandler() {
    useMapEvent("click", (e) => {
      console.log(e.latlng);
      setClickedLatLng([e.latlng.lat, e.latlng.lng]);
      setForm({
        lat: e.latlng.lat.toString(),
        lng: e.latlng.lng.toString(),
        message: "",
      });
      setDrawerOpen(true);
    });
    return null;
  }

  return (
    <>
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100%" }}
      >
        <MapClickHandler />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={8}
        />
        {/* 展示所有点 */}
        {allMarkers.map((item, idx) => (
          <Marker
            key={item.id || idx}
            position={[parseFloat(item.lat), parseFloat(item.lng)]}
          >
            <Popup>
              <div>
                <div>
                  <b>信息:</b> {item.message}
                </div>
                <div>
                  <b>用户:</b> {item.user_id}
                </div>
                <div>
                  <b>时间:</b> {item.created_at}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Portal the Drawer to the end of the DOM for stacking above map */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        }}
      >
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction="right"
        >
          <DrawerContent className="z-[10000]">
            <DrawerHeader>
              <DrawerTitle>提交坐标和信息</DrawerTitle>
              <DrawerDescription>
                {clickedLatLng
                  ? `你点击了: 纬度 ${clickedLatLng[0]}, 经度 ${clickedLatLng[1]}`
                  : "点击地图任意位置提交信息。"}
              </DrawerDescription>
            </DrawerHeader>
            <form
              className="flex flex-col gap-4 p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await submitMapInfo({
                    lat: form.lat,
                    lng: form.lng,
                    message: form.message,
                  });
                  alert("提交成功！");
                  setDrawerOpen(false);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                  alert("提交失败: " + (err.message || err));
                }
              }}
            >
              <label className="flex flex-col">
                纬度
                <input
                  type="text"
                  value={form.lat}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lat: e.target.value }))
                  }
                  className="border rounded px-2 py-1"
                  required
                />
              </label>
              <label className="flex flex-col">
                经度
                <input
                  type="text"
                  value={form.lng}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lng: e.target.value }))
                  }
                  className="border rounded px-2 py-1"
                  required
                />
              </label>
              <label className="flex flex-col">
                信息
                <textarea
                  value={form.message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, message: e.target.value }))
                  }
                  className="border rounded px-2 py-1"
                  rows={3}
                  required
                />
              </label>
              <button
                type="submit"
                className="bg-primary text-white rounded px-4 py-2"
              >
                提交
              </button>
            </form>
            <DrawerFooter>
              <DrawerClose className="w-full">关闭</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
