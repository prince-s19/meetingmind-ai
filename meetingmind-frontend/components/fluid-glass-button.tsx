"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type FluidGlassButtonProps = { href: string; children: React.ReactNode; variant?: "hero" | "compact" };

const vertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragmentShader = `
varying vec2 vUv;
uniform float uTime;
uniform float uHover;
uniform float uClick;
uniform vec3 uBaseColor;
uniform vec3 uGlassColor;
uniform vec2 uResolution;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0; p.x *= uResolution.x / uResolution.y;
  float dist = length(max(abs(p) - vec2(max(uResolution.x / uResolution.y - 1.0, 0.0), 0.0), 0.0)) - 1.0;
  float edge = smoothstep(0.35, 0.0, abs(dist));
  float n = noise(vUv * 3.0 + vec2(uTime * 0.25, uTime * 0.12));
  float shine = smoothstep(0.9, 0.15, vUv.x + n * 0.18) * edge;
  float surge = exp(-length(vUv - 0.5) * 7.0) * uClick;
  vec3 color = uBaseColor + uGlassColor * (edge * (0.2 + uHover * 0.4) + surge * 0.75);
  color += vec3(1.0) * shine * (0.18 + uHover * 0.45);
  gl_FragColor = vec4(color, 1.0);
}`;

export function FluidGlassButton({ href, children, variant = "hero" }: FluidGlassButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(0);
  const clickRef = useRef(0);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const link = linkRef.current;
    if (!canvas || !link) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { uTime: { value: 0 }, uHover: { value: 0 }, uClick: { value: 0 }, uBaseColor: { value: new THREE.Color("#080808") }, uGlassColor: { value: new THREE.Color("#ffffff") }, uResolution: { value: new THREE.Vector2(1, 1) } };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));
    let frame = 0;
    let previous = performance.now();
    const resize = () => { const { width, height } = link.getBoundingClientRect(); const pixelRatio = variant === "compact" ? 1 : Math.min(window.devicePixelRatio, 1.5); renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false); uniforms.uResolution.value.set(width, height); };
    const observer = new ResizeObserver(resize);
    observer.observe(link);
    resize();
    const render = (time: number) => { const delta = (time - previous) / 1000; previous = time; uniforms.uTime.value += delta; uniforms.uHover.value = THREE.MathUtils.lerp(uniforms.uHover.value, hoverRef.current, delta * 7); uniforms.uClick.value = THREE.MathUtils.lerp(uniforms.uClick.value, clickRef.current, delta * 8); clickRef.current = 0; renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); geometry.dispose(); material.dispose(); renderer.dispose(); };
  }, []);

  return <Link ref={linkRef} href={href} className={`fluid-glass-button ${variant === "compact" ? "fluid-glass-button-compact" : ""}`} onMouseEnter={() => { hoverRef.current = 1; }} onMouseLeave={() => { hoverRef.current = 0; }} onMouseDown={() => { clickRef.current = 1; linkRef.current?.classList.add("is-pressed"); }} onMouseUp={() => linkRef.current?.classList.remove("is-pressed")}><canvas ref={canvasRef} aria-hidden="true" /><span>{children}</span></Link>;
}
