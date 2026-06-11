"use client";

import {
  Component,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  onLoaded: () => void;
}

interface PreviewErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("3D model preview failed:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function Model({ url, onLoaded }: ModelProps) {
  const { scene, animations } = useGLTF(url);
  const { camera, controls } = useThree();
  const ref = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, ref);

  // Signal that the model is loaded (useGLTF suspends until ready, so this
  // only fires after the GLTF is fully available).
  useEffect(() => {
    onLoaded();
  }, [url, onLoaded]);

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
    if (!ref.current || !scene) return;

    try {
      const box = new THREE.Box3().setFromObject(ref.current);
      if (box.isEmpty()) return;

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxDim) || maxDim <= 0) return;

      if (!(camera instanceof THREE.PerspectiveCamera)) return;

      const fov = camera.fov * (Math.PI / 180);
      const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      if (!Number.isFinite(distance) || distance <= 0) return;

      camera.position.set(center.x, center.y, center.z + distance);
      camera.near = Math.max(distance / 100, 0.01);
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
    } catch (error) {
      console.warn("3D model framing failed:", error);
    }
  }, [url, camera, controls, scene]);

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
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset loading state whenever the model URL changes.
  useEffect(() => {
    setIsLoaded(false);
  }, [fileUrl]);

  const handleLoaded = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {t("assetEditor.preview.loadError", "Unable to preview this 3D model")}
    </div>
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {t("assetEditor.preview.model")}
      </label>
      <div
        className="relative rounded-md overflow-hidden border bg-muted/20"
        style={{ height: 240 }}
      >
        {/* Loading overlay — shown outside Canvas so it's plain HTML, not R3F */}
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-xs text-muted-foreground pointer-events-none">
            {t("assetEditor.preview.loading", "Loading 3D model...")}
          </div>
        )}
        <PreviewErrorBoundary fallback={fallback} key={fileUrl}>
          <Canvas
            camera={{ position: [0, 0, 4], fov: 45 }}
            gl={{ antialias: true }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            {/* fallback={null} — DOM elements can't be rendered by R3F */}
            <Suspense fallback={null}>
              <Model url={fileUrl} onLoaded={handleLoaded} />
              <Environment preset="city" />
            </Suspense>
            <OrbitControls makeDefault enablePan={false} />
          </Canvas>
        </PreviewErrorBoundary>
      </div>
      <p className="text-xs text-muted-foreground truncate">{fileName}</p>
    </div>
  );
}
