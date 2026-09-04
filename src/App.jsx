import { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';
import OrreryCanvas from './components/OrreryCanvas.jsx';
import TimeControls from './components/TimeControls.jsx';
import ObjectPanel from './components/ObjectPanel.jsx';
import { computeSystem } from './physics/solarSystem.js';
import { dateToJd } from './physics/time.js';

const DEFAULT_SCALE = 130; // px per AU, shows out to about the asteroid belt

/** Find a body's max-moon semi-major-axis (AU), for auto-framing a focus. */
function maxMoonDistance(planet) {
  return planet.moons.reduce((max, m) => Math.max(max, m.a), 0);
}

/** Choose a sensible camera scale when focusing on a given body. */
function scaleForFocus(system, name, currentScale) {
  if (name === 'Sun') {
    return 8; // px per AU - fits Pluto's ~49 AU aphelion comfortably on screen
  }
  for (const planet of system.planets) {
    if (planet.name === name) {
      const maxMoon = maxMoonDistance(planet);
      return maxMoon > 0 ? 140 / (maxMoon * 1.3) : currentScale;
    }
    for (const moon of planet.moons) {
      if (moon.name === name) {
        const maxMoon = maxMoonDistance(planet);
        return 140 / (maxMoon * 1.3);
      }
    }
  }
  return currentScale;
}

function App() {
  const [jd, setJd] = useState(() => dateToJd(new Date()));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // days of sim time per real second
  const [camera, setCamera] = useState({ scale: DEFAULT_SCALE, panX: 0, panY: 0, focus: 'Sun' });
  const [selected, setSelected] = useState(null);
  const [labelMode, setLabelMode] = useState('all'); // 'all' | 'planets' | 'none'

  const lastFrameRef = useRef(null);

  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return undefined;
    }
    let raf;
    const tick = (now) => {
      if (lastFrameRef.current != null) {
        const dtSeconds = (now - lastFrameRef.current) / 1000;
        setJd((prev) => prev + dtSeconds * speed);
      }
      lastFrameRef.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const system = useMemo(() => computeSystem(jd), [jd]);

  const handleFocus = (name) => {
    setCamera((prev) => ({
      ...prev,
      focus: name,
      panX: 0,
      panY: 0,
      scale: scaleForFocus(system, name, prev.scale),
    }));
    setSelected(name);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Orrery</h1>
        <p className="app-subtitle">Solar system positions from Keplerian orbital elements</p>
      </header>

      <div className="app-body">
        <OrreryCanvas
          jd={jd}
          camera={camera}
          onCameraChange={setCamera}
          selected={selected}
          onSelect={setSelected}
          labelMode={labelMode}
        />
        <ObjectPanel
          system={system}
          selected={selected}
          onSelect={setSelected}
          onFocus={handleFocus}
          labelMode={labelMode}
          setLabelMode={setLabelMode}
        />
      </div>

      <TimeControls jd={jd} setJd={setJd} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />
    </div>
  );
}

export default App;
