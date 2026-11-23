import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FIGHTER_BY_ID, FighterId, SkinId } from '../shared/gameData.ts';
import {
  FighterRig,
  createArticulatedFighter,
  disposeFighterRig,
  getStancePose,
  poseFighter,
} from '../game/fighterBuilder.ts';
import { detectSoftwareWebGL } from '../game/mapBuilder.ts';
import { detectQualityTier, resolveRenderProfile } from '../game/perfConfig.ts';

interface TekkenStagePreviewProps {
  fighterId: FighterId;
  skinId: SkinId;
  variant?: 'dark' | 'light' | 'semi-light';
  interactive?: boolean;
}

export const TekkenStagePreview: React.FC<TekkenStagePreviewProps> = React.memo(
  ({ fighterId, skinId, variant = 'semi-light', interactive = true }) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const fighterIdRef = useRef<FighterId>(fighterId);
    const skinIdRef = useRef<SkinId>(skinId);
    const interactiveRef = useRef<boolean>(interactive);
    const dragYawRef = useRef<number>(0);
    const swapPulseRef = useRef<number>(0);

    fighterIdRef.current = fighterId;
    skinIdRef.current = skinId;
    interactiveRef.current = interactive;

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isDark = variant === 'dark';
      const isSemiLight = variant === 'semi-light';
      const isSoftwareGl = detectSoftwareWebGL();
      const hasCoarsePointer =
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
      const navWithMem = navigator as Navigator & { deviceMemory?: number };
      const qualityTier = detectQualityTier({
        isSoftwareGl,
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
        viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 720,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4,
        deviceMemoryGb: navWithMem?.deviceMemory,
        hasCoarsePointer,
      });
      const profile = resolveRenderProfile(
        qualityTier,
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      );
      const renderer = new THREE.WebGLRenderer({
        antialias: profile.antialias,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = isDark ? 1.08 : isSemiLight ? 1.05 : 1.02;
      renderer.setPixelRatio(profile.initialPixelRatio);
      renderer.shadowMap.enabled = profile.shadowMapEnabled;

      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
      camera.position.set(0, 1.4, 4.65);
      camera.lookAt(0, 0.96, 0);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();

      const hemi = new THREE.HemisphereLight(
        isDark ? 0xfef3c7 : isSemiLight ? 0xf8fafc : 0xffffff,
        isDark ? 0x1e293b : isSemiLight ? 0x64748b : 0x94a3b8,
        isDark ? 1.15 : isSemiLight ? 1.22 : 1.2
      );
      scene.add(hemi);

      const key = new THREE.DirectionalLight(
        isDark ? 0xffe4b5 : isSemiLight ? 0xfff3db : 0xfff7e6,
        isDark ? 1.75 : isSemiLight ? 1.7 : 1.65
      );
      key.position.set(3, 5, 4);
      key.castShadow = profile.shadowMapEnabled;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x38bdf8, isDark ? 1.15 : 0.98);
      rim.position.set(-3.5, 3, -3.5);
      scene.add(rim);

      const pedestalGeom = new THREE.CylinderGeometry(1.15, 1.38, 0.24, 6);
      const pedestalMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x1e293b : isSemiLight ? 0x3b485c : 0xe2e8f0,
        metalness: isDark ? 0.45 : isSemiLight ? 0.34 : 0.25,
        roughness: isDark ? 0.38 : isSemiLight ? 0.42 : 0.42,
      });
      const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
      pedestal.position.y = -0.12;
      pedestal.receiveShadow = true;
      scene.add(pedestal);

      const ringGeom = new THREE.RingGeometry(1.06, 1.2, 6);
      const ringMat = new THREE.MeshBasicMaterial({
        color: FIGHTER_BY_ID[fighterId].hex,
        transparent: true,
        opacity: isDark ? 0.9 : 0.88,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.y = 0.01;
      scene.add(ring);

      const pulseRingGeom = new THREE.RingGeometry(1.0, 1.15, 24);
      const pulseRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const pulseRing = new THREE.Mesh(pulseRingGeom, pulseRingMat);
      pulseRing.rotation.x = -Math.PI * 0.5;
      pulseRing.position.y = 0.03;
      scene.add(pulseRing);

      let activeRig: FighterRig | null = null;
      let builtFighter: FighterId | null = null;
      let builtSkin: SkinId | null = null;

      const ensureActiveRig = (fid: FighterId, sid: SkinId) => {
        if (activeRig && builtFighter === fid && builtSkin === sid) return activeRig;
        if (activeRig) {
          disposeFighterRig(activeRig, scene);
        }
        activeRig = createArticulatedFighter(fid, scene, sid, false);
        activeRig.overheadSprite.visible = false;
        builtFighter = fid;
        builtSkin = sid;
        swapPulseRef.current = 1.0;
        return activeRig;
      };

      ensureActiveRig(fighterIdRef.current, skinIdRef.current);

      const resize = () => {
        const w = Math.max(90, container.clientWidth);
        const h = Math.max(90, container.clientHeight);
        const aspect = w / h;
        camera.aspect = aspect;
        if (aspect < 0.95) {
          camera.fov = 47;
          camera.position.set(0, 1.38, 5.3);
          camera.lookAt(0, 0.95, 0);
        } else if (aspect > 1.45) {
          camera.fov = 42;
          camera.position.set(0, 1.42, 4.95);
          camera.lookAt(0, 0.98, 0);
        } else {
          camera.fov = 41;
          camera.position.set(0, 1.4, 4.7);
          camera.lookAt(0, 0.96, 0);
        }
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(profile.initialPixelRatio);
        renderer.setSize(w, h, false);
      };

      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      resize();

      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      ro?.observe(container);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);

      let dragging = false;
      let lastX = 0;
      let dragVel = 0;
      const onDown = (e: PointerEvent) => {
        if (!interactiveRef.current) return;
        dragging = true;
        lastX = e.clientX;
        dragVel = 0;
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging || !interactiveRef.current) return;
        const delta = (e.clientX - lastX) * 0.012;
        dragYawRef.current += delta;
        dragVel = delta;
        lastX = e.clientX;
      };
      const onUp = () => {
        dragging = false;
      };
      const dom = renderer.domElement;
      if (interactiveRef.current) {
        dom.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }

      let frameId = 0;
      let active = true;
      let contextLost = false;
      const startMs = performance.now();
      let prevMs = startMs;

      function afterDraw(cb: () => void) {
        if (!active || contextLost) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          let polls = 0;
          const poll = () => {
            if (!active || contextLost) {
              if (sync) gl.deleteSync(sync);
              return;
            }
            polls += 1;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED && polls < 40) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          frameId = window.setTimeout(cb, 80);
        }
      }

      const tick = () => {
        if (!active || contextLost || document.hidden) return;
        const nowMs = performance.now();
        const dt = Math.min((nowMs - prevMs) / 1000, 0.05);
        prevMs = nowMs;
        const t = (nowMs - startMs) / 1000;
        const curId = fighterIdRef.current;
        const curSkin = skinIdRef.current;
        const spec = FIGHTER_BY_ID[curId];
        ringMat.color.setHex(spec.hex);
        rim.color.setHex(spec.hex);

        const rig = ensureActiveRig(curId, curSkin);

        if (swapPulseRef.current > 0.01) {
          swapPulseRef.current = Math.max(0, swapPulseRef.current - dt * 2.8);
          const p = 1 - swapPulseRef.current;
          pulseRing.scale.setScalar(1 + p * 0.9);
          pulseRingMat.color.setHex(spec.hex);
          pulseRingMat.opacity = swapPulseRef.current * 0.75;
        } else {
          pulseRingMat.opacity = 0;
        }

        if (!dragging) {
          dragYawRef.current += dragVel + 0.48 * dt;
          dragVel *= Math.exp(-6.5 * dt);
        }

        const pose = getStancePose(curId, t);
        pose.rotY = Math.sin(t * 0.6) * 0.3 + dragYawRef.current;
        poseFighter(rig, pose, null, t);
        rig.overheadSprite.visible = false;

        renderer.render(scene, camera);
        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      const onContextLost = (e: Event) => {
        e.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
      };
      const onContextRestored = () => {
        contextLost = false;
        if (active && !document.hidden) {
          prevMs = performance.now();
          tick();
        }
      };
      dom.addEventListener('webglcontextlost', onContextLost);
      dom.addEventListener('webglcontextrestored', onContextRestored);

      const onVisibilityChange = () => {
        if (!document.hidden && active && !contextLost) {
          cancelAnimationFrame(frameId);
          clearTimeout(frameId);
          prevMs = performance.now();
          tick();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      tick();

      return () => {
        active = false;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        dom.removeEventListener('webglcontextlost', onContextLost);
        dom.removeEventListener('webglcontextrestored', onContextRestored);
        ro?.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        dom.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (activeRig) disposeFighterRig(activeRig, scene);
        pedestalGeom.dispose();
        pedestalMat.dispose();
        ringGeom.dispose();
        ringMat.dispose();
        pulseRingGeom.dispose();
        pulseRingMat.dispose();
        envTex.dispose();
        renderer.dispose();
      };
    }, [variant]);

    return (
      <div
        ref={mountRef}
        data-testid="stage-preview"
        className={`w-full h-full min-h-[90px] overflow-hidden touch-none-select ${
          interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none cursor-default'
        }`}
      />
    );
  }
);
