/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the mouse-aware animated characters shown beside the authentication form.
*/
import { useEffect, useRef, useState, type RefObject } from "react";

interface EyeProps {
  size: number;
  pupilSize: number;
  maxDistance: number;
  blinking: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function useMouse() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return pos;
}

function offsetToward(
  ref: RefObject<HTMLDivElement | null>,
  mouse: { x: number; y: number },
  maxDistance: number,
) {
  if (!ref.current) return { x: 0, y: 0 };
  const rect = ref.current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  const distance = Math.min(Math.hypot(dx, dy), maxDistance);
  const angle = Math.atan2(dy, dx);
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function Eye({ size, pupilSize, maxDistance, blinking, forceLookX, forceLookY }: EyeProps) {
  const mouse = useMouse();
  const ref = useRef<HTMLDivElement>(null);
  const forced = forceLookX !== undefined && forceLookY !== undefined;
  const offset = forced ? { x: forceLookX, y: forceLookY } : offsetToward(ref, mouse, maxDistance);

  return (
    <div
      ref={ref}
      className="flex items-center justify-center overflow-hidden rounded-full transition-all duration-150"
      style={{
        width: size,
        height: blinking ? 2 : size,
        backgroundColor: "#FFFFFF",
      }}
    >
      {blinking ? null : (
        <div
          className="rounded-full"
          style={{
            width: pupilSize,
            height: pupilSize,
            backgroundColor: "#2D2D2D",
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
}

function useBlink() {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(
        () => {
          setBlinking(true);
          setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 150);
        },
        Math.random() * 4000 + 3000,
      );
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);
  return blinking;
}

function useFaceLean(ref: RefObject<HTMLDivElement | null>, mouse: { x: number; y: number }) {
  if (!ref.current) return { faceX: 0, faceY: 0, skew: 0 };
  const rect = ref.current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 3;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  return {
    faceX: Math.max(-15, Math.min(15, dx / 20)),
    faceY: Math.max(-10, Math.min(10, dy / 30)),
    skew: Math.max(-6, Math.min(6, -dx / 120)),
  };
}

export function AnimatedCharacters({
  typing,
  passwordLength,
  revealed,
}: {
  typing: boolean;
  passwordLength: number;
  revealed: boolean;
}) {
  const mouse = useMouse();
  const tealBlink = useBlink();
  const inkBlink = useBlink();

  const tealRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);

  const [glance, setGlance] = useState(false);
  const [peek, setPeek] = useState(false);
  const hidingPassword = passwordLength > 0 && !revealed;
  const watchingPassword = passwordLength > 0 && revealed;

  useEffect(() => {
    if (!typing) {
      setGlance(false);
      return;
    }
    setGlance(true);
    const timer = setTimeout(() => setGlance(false), 800);
    return () => clearTimeout(timer);
  }, [typing]);

  useEffect(() => {
    if (!watchingPassword) {
      setPeek(false);
      return;
    }
    const timer = setTimeout(
      () => {
        setPeek(true);
        setTimeout(() => setPeek(false), 800);
      },
      Math.random() * 3000 + 2000,
    );
    return () => clearTimeout(timer);
  }, [watchingPassword, peek]);

  const teal = useFaceLean(tealRef, mouse);
  const ink = useFaceLean(inkRef, mouse);
  const arch = useFaceLean(archRef, mouse);
  const side = useFaceLean(sideRef, mouse);

  const shy = watchingPassword;

  return (
    <div className="relative" style={{ width: 520, height: 380 }}>
      {/* Accent-purple tall character — back */}
      <div
        ref={tealRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 70,
          width: 170,
          height: typing || hidingPassword ? 410 : 376,
          backgroundColor: "#6C3FF5",
          borderRadius: "12px 12px 0 0",
          zIndex: 1,
          transform: shy
            ? "skewX(0deg)"
            : typing || hidingPassword
              ? `skewX(${teal.skew - 12}deg) translateX(36px)`
              : `skewX(${teal.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-7 transition-all duration-700 ease-in-out"
          style={{
            left: shy ? 18 : glance ? 52 : 42 + teal.faceX,
            top: shy ? 34 : glance ? 62 : 38 + teal.faceY,
          }}
        >
          <Eye
            size={18}
            pupilSize={7}
            maxDistance={5}
            blinking={tealBlink}
            forceLookX={shy ? (peek ? 4 : -4) : glance ? 3 : undefined}
            forceLookY={shy ? (peek ? 5 : -4) : glance ? 4 : undefined}
          />
          <Eye
            size={18}
            pupilSize={7}
            maxDistance={5}
            blinking={tealBlink}
            forceLookX={shy ? (peek ? 4 : -4) : glance ? 3 : undefined}
            forceLookY={shy ? (peek ? 5 : -4) : glance ? 4 : undefined}
          />
        </div>
      </div>

      {/* Ink tall character — middle */}
      <div
        ref={inkRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 230,
          width: 116,
          height: 296,
          backgroundColor: "#B69CFF",
          borderRadius: "10px 10px 0 0",
          zIndex: 2,
          transform: shy
            ? "skewX(0deg)"
            : glance
              ? `skewX(${ink.skew * 1.5 + 10}deg) translateX(18px)`
              : typing || hidingPassword
                ? `skewX(${ink.skew * 1.5}deg)`
                : `skewX(${ink.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-5 transition-all duration-700 ease-in-out"
          style={{
            left: shy ? 10 : glance ? 30 : 24 + ink.faceX,
            top: shy ? 26 : glance ? 12 : 30 + ink.faceY,
          }}
        >
          <Eye
            size={15}
            pupilSize={6}
            maxDistance={4}
            blinking={inkBlink}
            forceLookX={shy ? -4 : glance ? 0 : undefined}
            forceLookY={shy ? -4 : glance ? -4 : undefined}
          />
          <Eye
            size={15}
            pupilSize={6}
            maxDistance={4}
            blinking={inkBlink}
            forceLookX={shy ? -4 : glance ? 0 : undefined}
            forceLookY={shy ? -4 : glance ? -4 : undefined}
          />
        </div>
      </div>

      {/* Soft arch character — front left */}
      <div
        ref={archRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 0,
          width: 228,
          height: 188,
          zIndex: 3,
          backgroundColor: "#EDE9F5",
          borderRadius: "114px 114px 0 0",
          transform: shy ? "skewX(0deg)" : `skewX(${arch.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-7 transition-all duration-200 ease-out"
          style={{ left: shy ? 48 : 78 + arch.faceX, top: shy ? 80 : 86 + arch.faceY }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            blinking={false}
            forceLookX={shy ? -5 : undefined}
            forceLookY={shy ? -4 : undefined}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            blinking={false}
            forceLookX={shy ? -5 : undefined}
            forceLookY={shy ? -4 : undefined}
          />
        </div>
      </div>

      {/* Accent arch character — front right */}
      <div
        ref={sideRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 300,
          width: 132,
          height: 218,
          backgroundColor: "#CFCAE0",
          borderRadius: "66px 66px 0 0",
          zIndex: 4,
          transform: shy ? "skewX(0deg)" : `skewX(${side.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-5 transition-all duration-200 ease-out"
          style={{ left: shy ? 18 : 48 + side.faceX, top: shy ? 32 : 38 + side.faceY }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            blinking={false}
            forceLookX={shy ? -5 : undefined}
            forceLookY={shy ? -4 : undefined}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            blinking={false}
            forceLookX={shy ? -5 : undefined}
            forceLookY={shy ? -4 : undefined}
          />
        </div>
        <div
          className="absolute h-1 w-16 rounded-full transition-all duration-200 ease-out"
          style={{
            backgroundColor: "#2D2D2D",
            left: shy ? 10 : 38 + side.faceX,
            top: 84 + side.faceY,
          }}
        />
      </div>
    </div>
  );
}
