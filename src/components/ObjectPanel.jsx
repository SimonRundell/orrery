const AU_KM = 149597870.7;

function findBody(system, name) {
  if (!name || name === 'Sun') return { name: 'Sun', kind: 'sun', r: 0 };
  for (const planet of system.planets) {
    if (planet.name === name) return { ...planet, kind: 'planet' };
    for (const moon of planet.moons) {
      if (moon.name === name) return { ...moon, kind: 'moon' };
    }
  }
  for (const comet of system.comets) {
    if (comet.name === name) return { ...comet, kind: 'comet' };
  }
  return null;
}

function formatDistance(au, kind) {
  if (kind === 'sun') return '-';
  if (kind === 'moon') return `${Math.round(au * AU_KM).toLocaleString()} km`;
  return `${au.toFixed(3)} AU`;
}

function formatPeriod(days) {
  if (!days) return '-';
  if (days < 60) return `${days.toFixed(2)} days`;
  if (days < 800) return `${(days / 30.44).toFixed(1)} months`;
  return `${(days / 365.25).toFixed(2)} years`;
}

/**
 * Sidebar: a browsable list of every body in the system plus a detail
 * panel for whichever one is currently selected, with buttons to focus
 * the camera on it.
 */
const LABEL_MODES = [
  { value: 'all', label: 'All' },
  { value: 'planets', label: 'Planets only' },
  { value: 'none', label: 'None' },
];

export default function ObjectPanel({ system, selected, onSelect, onFocus, labelMode, setLabelMode }) {
  const info = findBody(system, selected);

  return (
    <div className="object-panel">
      <div className="object-panel-header">
        <h2>Solar System</h2>
        <div className="label-mode">
          <span className="label-mode-title">Labels</span>
          <div className="label-mode-options">
            {LABEL_MODES.map((mode) => (
              <label key={mode.value} className="label-mode-option">
                <input
                  type="radio"
                  name="label-mode"
                  value={mode.value}
                  checked={labelMode === mode.value}
                  onChange={() => setLabelMode(mode.value)}
                />
                {mode.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="object-list">
        <button
          className={`object-list-item sun ${selected === 'Sun' ? 'selected' : ''}`}
          onClick={() => onSelect('Sun')}
        >
          Sun
        </button>
        {system.planets.map((planet) => (
          <div key={planet.name} className="object-list-group">
            <button
              className={`object-list-item ${selected === planet.name ? 'selected' : ''}`}
              style={{ '--body-color': planet.color }}
              onClick={() => onSelect(planet.name)}
            >
              {planet.name}
            </button>
            {planet.moons.length > 0 && (
              <div className="object-list-moons">
                {planet.moons.map((moon) => (
                  <button
                    key={moon.name}
                    className={`object-list-item moon ${selected === moon.name ? 'selected' : ''}`}
                    style={{ '--body-color': moon.color }}
                    onClick={() => onSelect(moon.name)}
                  >
                    {moon.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {system.comets.map((comet) => (
          <button
            key={comet.name}
            className={`object-list-item comet ${selected === comet.name ? 'selected' : ''}`}
            style={{ '--body-color': comet.color }}
            onClick={() => onSelect(comet.name)}
          >
            {comet.name}
          </button>
        ))}
      </div>

      {info && (
        <div className="info-card">
          <h3>{info.name}</h3>
          <dl>
            <dt>Distance from {info.kind === 'moon' ? info.parent : 'Sun'}</dt>
            <dd>{formatDistance(info.r, info.kind)}</dd>
            {info.kind !== 'sun' && (
              <>
                <dt>Orbital period</dt>
                <dd>{formatPeriod(info.periodDays)}</dd>
                <dt>Eccentricity</dt>
                <dd>{info.e !== undefined ? info.e.toFixed(4) : '-'}</dd>
              </>
            )}
          </dl>
          <button className="btn btn-focus" onClick={() => onFocus(info.name)}>
            Focus camera here
          </button>
        </div>
      )}
    </div>
  );
}
