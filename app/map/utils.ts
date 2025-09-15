"use client";
import { createClient } from "@/lib/supabase/client";

export const supabase = createClient();

/**
 * 提交地图信息到 Supabase
 * @param params { lat: string, lng: string, message: string, userId: string }
 */
export async function submitMapInfo({
  lat,
  lng,
  message,
}: {
  lat: string;
  lng: string;
  message: string;
}) {
  const { data, error } = await supabase.from("upload_data").insert([
    {
      lat,
      lng,
      message,
    },
  ]);
  if (error) throw error;
  return data;
}

/**
 * 获取所有地图上传数据
 */
export async function fetchAllMapData() {
  const { data, error } = await supabase.from("upload_data").select("*");
  if (error) throw error;
  return data;
}
