"use client";

import { Suspense, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment } from "@react-three/drei";
import * as THREE from "three";

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <Center>
      <primitive ref={ref} object={scene} />
    </Center>
  );
}

interface AssetModelPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetModelPreview({ fileUrl, fileName }: AssetModelPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.model")}
      </label>
      <div className="rounded-md overflow-hidden border bg-muted/20" style={{ height: 240 }}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Suspense
            fallback={
              // three.js canvas 内不能用 DOM，fallback 只影响 R3F tree
              null
            }
          >
            <Model url={fileUrl} />
            <Environment preset="city" />
          </Suspense>
          <OrbitControls enablePan={false} />
        </Canvas>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileName}</p>
    </div>
  );
}
