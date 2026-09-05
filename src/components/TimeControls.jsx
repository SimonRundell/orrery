import { useState } from 'react';
import { dateToJd, jdToDate, formatGmt, inputValueToJd, jdToInputValue } from '../physics/time.js';

const SPEED_PRESETS = [
  { label: '1 hour / sec', value: 1 / 24 },
  { label: '1 day / sec', value: 1 },
  { label: '1 week / sec', value: 7 },
  { label: '1 month / sec', value: 30.44 },
  { label: '1 year / sec', value: 365.25 },
  { label: '10 years / sec', value: 3652.5 },
  { label: '100 years / sec', value: 36525 },
];

/**
 * Playback controls for simulated time: play/pause, speed, direction, a
 * jump-to-date field (interpreted as GMT) and a "now" shortcut.
 */
export default function TimeControls({ jd, setJd, playing, setPlaying, speed, setSpeed }) {
  const [dateInput, setDateInput] = useState(() => jdToInputValue(jd));

  const magnitude = Math.abs(speed);
  const reversed = speed < 0;

  const handleSpeedChange = (e) => {
    const mag = Number(e.target.value);
    setSpeed(reversed ? -mag : mag);
  };

  const toggleReverse = () => setSpeed(-speed);

  const jumpToDate = () => {
    const parsedJd = inputValueToJd(dateInput);
    if (!Number.isNaN(parsedJd)) setJd(parsedJd);
  };

  const jumpToNow = () => {
    const now = new Date();
    setJd(dateToJd(now));
    setDateInput(jdToInputValue(dateToJd(now)));
  };

  return (
    <div className="time-controls">
      <div className="time-controls-row">
        <button className="btn" onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className={`btn ${reversed ? 'btn-active' : ''}`} onClick={toggleReverse} title="Reverse direction">
          {reversed ? 'Reverse ◀' : 'Forward ▶'}
        </button>
        <select className="speed-select" value={magnitude} onChange={handleSpeedChange}>
          {SPEED_PRESETS.map((p) => (
            <option key={p.label} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="time-controls-row">
        <span className="current-date">{formatGmt(jdToDate(jd))}</span>
      </div>

      <div className="time-controls-row">
        <input
          type="datetime-local"
          className="date-input"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
        />
        <button className="btn" onClick={jumpToDate}>Jump</button>
        <button className="btn" onClick={jumpToNow}>Now</button>
      </div>
    </div>
  );
}
