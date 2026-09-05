import { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';
import OrreryCanvas from './components/OrreryCanvas.jsx';
import TimeControls from './components/TimeControls.jsx';
import ObjectPanel from './components/ObjectPanel.jsx';
import MissionBuilder from './components/MissionBuilder.jsx';
import CMFloatAd from './components/CMFloatAd.jsx';
import { computeSystem } from './physics/solarSystem.js';
import { computeMission } from './physics/mission.js';
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
  const [view, setView] = useState('orrery'); // 'orrery' | 'mission'
  const [legs, setLegs] = useState([]);

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

  const computedMission = useMemo(() => {
    if (legs.length === 0) return { legs: [], totalDeltaVKmPerS: 0 };
    try {
      return computeMission(legs);
    } catch (err) {
      return { legs: [], totalDeltaVKmPerS: 0, error: err.message };
    }
  }, [legs]);

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
        <div className="app-header-top">
          <div className="app-title">
            <img src="/favicon.png" alt="" className="app-logo" />
            <h1>Orrery</h1>
          </div>
          <div className="view-tabs">
            <button className={`view-tab ${view === 'orrery' ? 'active' : ''}`} onClick={() => setView('orrery')}>Orrery</button>
            <button className={`view-tab ${view === 'mission' ? 'active' : ''}`} onClick={() => setView('mission')}>Mission Planner</button>
          </div>
        </div>
        <p className="app-subtitle">
          {view === 'orrery'
            ? 'Solar system positions from Keplerian orbital elements'
            : 'Plan a probe trajectory: transfers, burns and gravity assists'}
        </p>
      </header>

      <div className="app-body">
        <OrreryCanvas
          jd={jd}
          camera={camera}
          onCameraChange={setCamera}
          selected={selected}
          onSelect={setSelected}
          labelMode={labelMode}
          mission={view === 'mission' ? computedMission : null}
        />
        {view === 'orrery' ? (
          <ObjectPanel
            system={system}
            selected={selected}
            onSelect={setSelected}
            onFocus={handleFocus}
            labelMode={labelMode}
            setLabelMode={setLabelMode}
          />
        ) : (
          <MissionBuilder
            legs={legs}
            setLegs={setLegs}
            computedMission={computedMission}
            system={system}
            jd={jd}
          />
        )}
      </div>

      <TimeControls jd={jd} setJd={setJd} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />

      <CMFloatAd />
    </div>
  );
}

export default App;
