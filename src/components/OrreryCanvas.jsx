import { useEffect, useRef, useCallback, useState } from 'react';
import { computeSystem } from '../physics/solarSystem.js';

const SUN_COLOR = '#ffd75e';
const SUN_VISUAL_RADIUS_PX = 10;

/**
 * Build the flat list of all drawable bodies (sun, planets, moons, comets)
 * for the current system state, each carrying its heliocentric AU
 * position, marker style and orbit path.
 */
function flattenBodies(system) {
  const bodies = [
    { name: 'Sun', color: SUN_COLOR, visualRadiusPx: SUN_VISUAL_RADIUS_PX, x: 0, y: 0, kind: 'sun' },
  ];
  for (const planet of system.planets) {
    bodies.push({ ...planet, kind: 'planet' });
    for (const moon of planet.moons) {
      bodies.push({ ...moon, kind: 'moon' });
    }
  }
  for (const comet of system.comets) {
    bodies.push({ ...comet, kind: 'comet' });
  }
  return bodies;
}

/**
 * Resolve the camera's world-space centre: the focused body's current
 * position, or the origin (Sun) if nothing is focused.
 */
function focusCenter(system, focusName) {
  if (!focusName || focusName === 'Sun') return { x: 0, y: 0 };
  for (const planet of system.planets) {
    if (planet.name === focusName) return { x: planet.x, y: planet.y };
    for (const moon of planet.moons) {
      if (moon.name === focusName) return { x: moon.x, y: moon.y };
    }
  }
  for (const comet of system.comets) {
    if (comet.name === focusName) return { x: comet.x, y: comet.y };
  }
  return { x: 0, y: 0 };
}

/**
 * Interactive canvas rendering the solar system: orbit paths, the Sun,
 * planets, their major moons and any comets, with mouse-drag panning and
 * scroll-wheel zoom centred on the cursor.
 */
export default function OrreryCanvas({ jd, camera, onCameraChange, selected, onSelect, labelMode }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragState = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const worldToScreen = useCallback((x, y, center, cam, width, height) => {
    return {
      sx: width / 2 + cam.panX + (x - center.x) * cam.scale,
      sy: height / 2 + cam.panY - (y - center.y) * cam.scale,
    };
  }, []);

  const screenToWorld = useCallback((sx, sy, center, cam, width, height) => {
    return {
      x: center.x + (sx - width / 2 - cam.panX) / cam.scale,
      y: center.y - (sy - height / 2 - cam.panY) / cam.scale,
    };
  }, []);

  // Resize canvas to fill its container.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setSize({ width: rect.width, height: rect.height });
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw whenever the date or camera changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = size;

    const system = computeSystem(jd);
    const center = focusCenter(system, camera.focus);
    const bodies = flattenBodies(system);

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, width, height);

    // Faint starfield (deterministic pseudo-random so it doesn't twinkle).
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let s = 0; s < 140; s++) {
      const sx = (s * 97.3) % width;
      const sy = (s * 53.7 + s * s * 0.7) % height;
      ctx.fillRect(sx, sy, 1, 1);
    }

    const toScreen = (x, y) => worldToScreen(x, y, center, camera, width, height);

    // Orbit paths first, so markers draw on top.
    const drawPath = (points, color, alpha) => {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      points.forEach((pt, idx) => {
        const { sx, sy } = toScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    for (const planet of system.planets) {
      drawPath(planet.orbitPoints, planet.color, 0.55);
      for (const moon of planet.moons) {
        drawPath(moon.orbitPoints, moon.color, 0.35);
      }
    }
    for (const comet of system.comets) {
      drawPath(comet.orbitPoints, comet.color, 0.5);
    }

    // Markers and labels.
    for (const body of bodies) {
      const { sx, sy } = toScreen(body.x, body.y);
      if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) continue;

      ctx.beginPath();
      ctx.fillStyle = body.color;
      ctx.arc(sx, sy, body.visualRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      if (body.name === selected) {
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.arc(sx, sy, body.visualRadiusPx + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      const shouldLabel =
        labelMode === 'all' || (labelMode === 'planets' && (body.kind === 'sun' || body.kind === 'planet'));
      if (shouldLabel) {
        ctx.font = body.kind === 'moon' ? '10px "Trebuchet MS", sans-serif' : '12px "Trebuchet MS", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(body.name, sx + body.visualRadiusPx + 4, sy + 4);
      }
    }
  }, [jd, camera, selected, labelMode, size, worldToScreen]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { width, height } = size;

      const system = computeSystem(jd);
      const center = focusCenter(system, camera.focus);
      const before = screenToWorld(mx, my, center, camera, width, height);

      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.min(Math.max(camera.scale * zoomFactor, 5), 5e7);

      const newPanX = mx - width / 2 - (before.x - center.x) * newScale;
      const newPanY = my - height / 2 + (before.y - center.y) * newScale;

      onCameraChange({ ...camera, scale: newScale, panX: newPanX, panY: newPanY });
    },
    [camera, jd, onCameraChange, screenToWorld, size]
  );

  const handleMouseDown = useCallback(
    (e) => {
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: camera.panX,
        panY: camera.panY,
        moved: false,
      };
    },
    [camera]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragState.current.moved = true;
      onCameraChange({ ...camera, panX: dragState.current.panX + dx, panY: dragState.current.panY + dy });
    },
    [camera, onCameraChange]
  );

  const handleMouseUp = useCallback(
    (e) => {
      const wasDrag = dragState.current?.moved;
      dragState.current = null;
      if (wasDrag) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { width, height } = size;

      const system = computeSystem(jd);
      const center = focusCenter(system, camera.focus);
      const bodies = flattenBodies(system);

      let hit = null;
      let bestDist = Infinity;
      for (const body of bodies) {
        const { sx, sy } = worldToScreen(body.x, body.y, center, camera, width, height);
        const d = Math.hypot(sx - mx, sy - my);
        const hitRadius = Math.max(body.visualRadiusPx + 4, 8);
        if (d < hitRadius && d < bestDist) {
          hit = body.name;
          bestDist = d;
        }
      }
      onSelect(hit);
    },
    [camera, jd, onSelect, worldToScreen, size]
  );

  return (
    <div className="orrery-canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragState.current = null; }}
      />
    </div>
  );
}
