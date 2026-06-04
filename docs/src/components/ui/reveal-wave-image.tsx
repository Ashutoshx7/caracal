/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * React shader image component for the documentation landing hero.
 */

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uRevealRadius;
  uniform float uRevealSoftness;
  uniform float uPixelSize;
  uniform float uMouseActive;
  uniform float uWaveSpeed;
  uniform float uWaveFrequency;
  uniform float uWaveAmplitude;
  uniform float uMouseRadius;
  uniform vec2 uResolution;
  uniform vec4 uRevealBounds;
  uniform float uRevealTargetFeather;
  uniform float uRevealTargetActive;

  varying vec2 vUv;

  float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;

    float pattern[16];
    pattern[0] = 0.0;    pattern[1] = 8.0;    pattern[2] = 2.0;    pattern[3] = 10.0;
    pattern[4] = 12.0;   pattern[5] = 4.0;    pattern[6] = 14.0;   pattern[7] = 6.0;
    pattern[8] = 3.0;    pattern[9] = 11.0;   pattern[10] = 1.0;   pattern[11] = 9.0;
    pattern[12] = 15.0;  pattern[13] = 7.0;   pattern[14] = 13.0;  pattern[15] = 5.0;

    for (int i = 0; i < 16; i++) {
      if (i == index) return pattern[i] / 16.0;
    }
    return 0.0;
  }

  void main() {
    vec2 uv = vUv;
    float time = uTime;
    float waveStrength = uWaveAmplitude * 0.1;
    float wave1 = sin(uv.y * uWaveFrequency + time * uWaveSpeed) * waveStrength;
    float wave2 = sin(uv.x * uWaveFrequency * 0.7 + time * uWaveSpeed * 0.8) * waveStrength * 0.5;

    vec2 distortedUv = uv;
    distortedUv.x += wave1;
    distortedUv.y += wave2;

    if (uMouseActive > 0.01) {
      vec2 mousePos = uMouse;
      float dist = distance(uv, mousePos);
      float mouseInfluence = smoothstep(uMouseRadius, 0.0, dist);
      float rippleFreq = uWaveFrequency * 5.0;
      float rippleSpeed = uWaveSpeed * 1.0;
      float rippleStrength = uWaveAmplitude * 0.05;
      float ripple = sin(dist * rippleFreq - time * rippleSpeed) * rippleStrength * mouseInfluence * uMouseActive;
      distortedUv.x += ripple;
      distortedUv.y += ripple;
    }

    vec4 color = texture2D(uTexture, distortedUv);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec2 pixelCoord = floor(gl_FragCoord.xy / uPixelSize);
    float dither = bayer4x4(pixelCoord);
    float adjusted = gray + (dither - 0.5) * 0.5;

    float quantized;
    if (adjusted < 0.33) {
      quantized = 0.0;
    } else if (adjusted < 0.66) {
      quantized = 0.5;
    } else {
      quantized = 1.0;
    }

    vec3 bwColor = vec3(quantized);
    float revealDist = distance(uv, uMouse);
    float innerRadius = uRevealRadius * (1.0 - uRevealSoftness);
    float outerRadius = uRevealRadius;
    float revealAmount = 1.0 - smoothstep(innerRadius, outerRadius, revealDist);
    revealAmount *= uMouseActive;

    vec2 screenUv = gl_FragCoord.xy / uResolution;
    float revealLeft = smoothstep(uRevealBounds.x, uRevealBounds.x + uRevealTargetFeather, screenUv.x);
    float revealRight = 1.0 - smoothstep(uRevealBounds.z - uRevealTargetFeather, uRevealBounds.z, screenUv.x);
    float revealBottom = smoothstep(uRevealBounds.y, uRevealBounds.y + uRevealTargetFeather, screenUv.y);
    float revealTop = 1.0 - smoothstep(uRevealBounds.w - uRevealTargetFeather, uRevealBounds.w, screenUv.y);
    float targetReveal = revealLeft * revealRight * revealBottom * revealTop * uRevealTargetActive;
    revealAmount = max(revealAmount, targetReveal);

    vec3 finalColor = mix(bwColor, color.rgb, revealAmount);
    gl_FragColor = vec4(finalColor, color.a);
  }
`;

interface ImagePlaneProps {
  src: string;
  aspectRatio: number;
  revealRadius: number;
  revealSoftness: number;
  pixelSize: number;
  waveSpeed: number;
  waveFrequency: number;
  waveAmplitude: number;
  mouseRadius: number;
  isMouseInCanvas: boolean;
  revealBounds: [number, number, number, number] | null;
  revealTargetFeather: number;
}

function ImagePlane({
  src,
  aspectRatio,
  revealRadius,
  revealSoftness,
  pixelSize,
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  mouseRadius,
  isMouseInCanvas,
  revealBounds,
  revealTargetFeather,
}: ImagePlaneProps) {
  const texture = useTexture(src);
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer, size, viewport } = useThree();
  const mouseActiveRef = useRef(0);
  const hasEnteredRef = useRef(false);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(-10, -10) },
      uRevealRadius: { value: revealRadius },
      uRevealSoftness: { value: revealSoftness },
      uPixelSize: { value: pixelSize },
      uMouseActive: { value: 0 },
      uWaveSpeed: { value: waveSpeed },
      uWaveFrequency: { value: waveFrequency },
      uWaveAmplitude: { value: waveAmplitude },
      uMouseRadius: { value: mouseRadius },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRevealBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRevealTargetFeather: { value: revealTargetFeather },
      uRevealTargetActive: { value: 0 },
    }),
    [
      texture,
      revealRadius,
      revealSoftness,
      pixelSize,
      waveSpeed,
      waveFrequency,
      waveAmplitude,
      mouseRadius,
      revealTargetFeather,
    ],
  );

  const scale = useMemo<[number, number, number]>(() => {
    const viewportAspectRatio = viewport.width / viewport.height;

    if (aspectRatio > viewportAspectRatio) {
      return [viewport.height * aspectRatio, viewport.height, 1];
    }

    return [viewport.width, viewport.width / aspectRatio, 1];
  }, [aspectRatio, viewport.height, viewport.width]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uResolution.value.set(size.width, size.height);
    material.uniforms.uRevealTargetFeather.value = revealTargetFeather;

    if (revealBounds) {
      material.uniforms.uRevealBounds.value.set(
        revealBounds[0],
        revealBounds[1],
        revealBounds[2],
        revealBounds[3],
      );
      material.uniforms.uRevealTargetActive.value = 1;
    } else {
      material.uniforms.uRevealTargetActive.value = 0;
    }

    if (isMouseInCanvas) {
      hasEnteredRef.current = true;
    }

    const targetActive = isMouseInCanvas ? 1 : 0;
    mouseActiveRef.current += (targetActive - mouseActiveRef.current) * 0.08;
    material.uniforms.uMouseActive.value = mouseActiveRef.current;

    if (hasEnteredRef.current) {
      material.uniforms.uMouse.value.set((pointer.x + 1) / 2, (pointer.y + 1) / 2);
    }
  });

  return (
    <mesh ref={meshRef} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}

interface RevealWaveImageProps {
  src: string;
  revealRadius?: number;
  revealSoftness?: number;
  pixelSize?: number;
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  mouseRadius?: number;
  revealTargetFeather?: number;
  revealTargetPadding?: number;
  revealTargetSelector?: string;
  className?: string;
}

export function RevealWaveImage({
  src,
  revealRadius = 0.2,
  revealSoftness = 0.5,
  pixelSize = 3,
  waveSpeed = 0.5,
  waveFrequency = 3.0,
  waveAmplitude = 0.2,
  mouseRadius = 0.2,
  revealTargetFeather = 0.01,
  revealTargetPadding = 0,
  revealTargetSelector,
  className = "",
}: RevealWaveImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isMouseInCanvas, setIsMouseInCanvas] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [revealBounds, setRevealBounds] = useState<[number, number, number, number] | null>(null);

  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      if (isMounted) {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  useEffect(() => {
    if (!revealTargetSelector) {
      setRevealBounds(null);
      return;
    }

    const root = rootRef.current;
    const target = document.querySelector<HTMLElement>(revealTargetSelector);
    if (!root || !target) {
      setRevealBounds(null);
      return;
    }

    let frame = 0;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const setNextBounds = (next: [number, number, number, number] | null) => {
      setRevealBounds((current) => {
        if (!current || !next) return next;
        const changed = current.some((value, index) => Math.abs(value - next[index]) > 0.001);
        return changed ? next : current;
      });
    };

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        if (rootRect.width === 0 || rootRect.height === 0 || targetRect.width === 0 || targetRect.height === 0) {
          setNextBounds(null);
          return;
        }

        const left = targetRect.left - revealTargetPadding;
        const right = targetRect.right + revealTargetPadding;
        const top = targetRect.top - revealTargetPadding;
        const bottom = targetRect.bottom + revealTargetPadding;

        setNextBounds([
          clamp((left - rootRect.left) / rootRect.width),
          clamp((rootRect.bottom - bottom) / rootRect.height),
          clamp((right - rootRect.left) / rootRect.width),
          clamp((rootRect.bottom - top) / rootRect.height),
        ]);
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(target);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [revealTargetPadding, revealTargetSelector]);

  return (
    <div
      ref={rootRef}
      className={["reveal-wave-image", className].filter(Boolean).join(" ")}
      onMouseEnter={() => setIsMouseInCanvas(true)}
      onMouseLeave={() => setIsMouseInCanvas(false)}
    >
      {aspectRatio !== null && (
        <Canvas
          orthographic
          camera={{ position: [0, 0, 10], zoom: 1 }}
          gl={{ antialias: false }}
          style={{ display: "block", height: "100%", width: "100%" }}
        >
          <Suspense fallback={null}>
            <ImagePlane
              aspectRatio={aspectRatio}
              isMouseInCanvas={isMouseInCanvas}
              mouseRadius={mouseRadius}
              pixelSize={pixelSize}
              revealBounds={revealBounds}
              revealRadius={revealRadius}
              revealSoftness={revealSoftness}
              revealTargetFeather={revealTargetFeather}
              src={src}
              waveAmplitude={waveAmplitude}
              waveFrequency={waveFrequency}
              waveSpeed={waveSpeed}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
