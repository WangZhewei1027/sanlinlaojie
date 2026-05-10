"use client";

import { Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  useAnimations,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const { scene, animations } = useGLTF(url);
  const { camera, controls } = useThree();
  const ref = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, ref);

  // Play all animations on loop
  useEffect(() => {
    if (animations.length === 0) return;
    Object.values(actions).forEach((action) => {
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
    });
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions, animations.length]);

  // Fit camera to bounding box whenever the model (url) changes
  useEffect(() => {
    if (!ref.current) return;

    const box = new THREE.Box3().setFromObject(ref.current);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.position.set(center.x, center.y, center.z + distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    // Update OrbitControls target to model center
    if (controls) {
      (
        controls as unknown as { target: THREE.Vector3; update: () => void }
      ).target.copy(center);
      (
        controls as unknown as { target: THREE.Vector3; update: () => void }
      ).update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return <primitive ref={ref} object={scene} />;
}

interface AssetModelPreviewProps {
  fileUrl: string;
  fileName: string;
}

export function AssetModelPreview({
  fileUrl,
  fileName,
}: AssetModelPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.model")}
      </label>
      <div
        className="rounded-md overflow-hidden border bg-muted/20"
        style={{ height: 240 }}
      >
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Suspense fallback={null}>
            <Model url={fileUrl} />
            <Environment preset="city" />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileName}</p>
    </div>
  );
}
