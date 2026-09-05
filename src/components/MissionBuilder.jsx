import { jdToInputValue, inputValueToJd } from '../physics/time.js';

function listAllBodyNames(system) {
  const names = ['Sun'];
  for (const planet of system.planets) {
    names.push(planet.name);
    for (const moon of planet.moons) names.push(moon.name);
  }
  for (const comet of system.comets) names.push(comet.name);
  return names;
}

function listPlanetNames(system) {
  return system.planets.map((p) => p.name);
}

function defaultTransferLeg(jd, system) {
  const toBody = system.planets.find((p) => p.name === 'Mars') ? 'Mars' : system.planets[0]?.name;
  return { type: 'transfer', fromBody: 'Earth', fromJd: jd, toBody, toJd: jd + 260, matchVelocityAtArrival: true, prograde: true };
}

function defaultBurnLeg(jd, isFirst) {
  return { type: 'burn', atJd: jd, deltaVKmPerS: 3, direction: 'prograde', ...(isFirst ? { fromBody: 'Earth' } : {}) };
}

function defaultGravityAssistLeg(jd, system) {
  const atBody = system.planets.find((p) => p.name === 'Jupiter') ? 'Jupiter' : system.planets[0]?.name;
  return { type: 'gravityAssist', atBody, atJd: jd, periapsisAltitudeKm: 500000, side: 'leading' };
}

function formatOrbitType(elements) {
  if (!elements) return '-';
  return elements.type === 'hyperbolic' ? `hyperbolic (escaping), e=${elements.e.toFixed(3)}` : `elliptical, e=${elements.e.toFixed(3)}`;
}

/**
 * Sidebar for the mission-planner view: an ordered, editable list of
 * transfer / burn / gravity-assist legs, each leg's computed delta-v and
 * resulting orbit, and the mission's running delta-v total.
 */
export default function MissionBuilder({ legs, setLegs, computedMission, system, jd }) {
  const bodyNames = listAllBodyNames(system);
  const planetNames = listPlanetNames(system);

  const updateLeg = (idx, patch) => {
    setLegs(legs.map((leg, i) => (i === idx ? { ...leg, ...patch } : leg)));
  };
  const removeLeg = (idx) => setLegs(legs.filter((_, i) => i !== idx));
  const addLeg = (factory) => setLegs([...legs, factory(jd, system)]);

  const resolvedLegs = computedMission?.legs || [];
  const error = computedMission?.error;

  return (
    <div className="object-panel">
      <div className="object-panel-header">
        <h2>Mission Planner</h2>
        <p className="mission-hint">Plan a probe trajectory: transfers, burns and gravity assists, chained in order.</p>
      </div>

      <div className="mission-leg-list">
        {legs.length === 0 && <p className="mission-empty">No legs yet - add one below to start.</p>}

        {legs.map((leg, idx) => {
          const resolved = resolvedLegs[idx];
          return (
            <div className="mission-leg-card" key={idx}>
              <div className="mission-leg-header">
                <span className="mission-leg-title">
                  {idx + 1}. {leg.type === 'transfer' ? 'Transfer' : leg.type === 'burn' ? 'Burn' : 'Gravity assist'}
                </span>
                <button className="btn btn-remove" onClick={() => removeLeg(idx)} title="Remove leg">×</button>
              </div>

              {leg.type === 'transfer' && (
                <div className="mission-leg-fields">
                  <label>From
                    <select value={leg.fromBody} onChange={(e) => updateLeg(idx, { fromBody: e.target.value })}>
                      {bodyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>Departure date
                    <input type="datetime-local" value={jdToInputValue(leg.fromJd)} onChange={(e) => updateLeg(idx, { fromJd: inputValueToJd(e.target.value) })} />
                  </label>
                  <label>To
                    <select value={leg.toBody} onChange={(e) => updateLeg(idx, { toBody: e.target.value })}>
                      {bodyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>Arrival date
                    <input type="datetime-local" value={jdToInputValue(leg.toJd)} onChange={(e) => updateLeg(idx, { toJd: inputValueToJd(e.target.value) })} />
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={leg.matchVelocityAtArrival} onChange={(e) => updateLeg(idx, { matchVelocityAtArrival: e.target.checked })} />
                    Match velocity at arrival (rendezvous)
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={leg.prograde} onChange={(e) => updateLeg(idx, { prograde: e.target.checked })} />
                    Prograde transfer direction
                  </label>
                </div>
              )}

              {leg.type === 'burn' && (
                <div className="mission-leg-fields">
                  {'fromBody' in leg && (
                    <label>Launching from
                      <select value={leg.fromBody} onChange={(e) => updateLeg(idx, { fromBody: e.target.value })}>
                        {bodyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  )}
                  <label>Burn date
                    <input type="datetime-local" value={jdToInputValue(leg.atJd)} onChange={(e) => updateLeg(idx, { atJd: inputValueToJd(e.target.value) })} />
                  </label>
                  <label>Delta-v (km/s)
                    <input type="number" step="0.1" value={leg.deltaVKmPerS} onChange={(e) => updateLeg(idx, { deltaVKmPerS: Number(e.target.value) })} />
                  </label>
                  <label>Direction
                    <select value={leg.direction} onChange={(e) => updateLeg(idx, { direction: e.target.value })}>
                      <option value="prograde">Prograde (speed up)</option>
                      <option value="retrograde">Retrograde (slow down)</option>
                    </select>
                  </label>
                </div>
              )}

              {leg.type === 'gravityAssist' && (
                <div className="mission-leg-fields">
                  <label>At planet
                    <select value={leg.atBody} onChange={(e) => updateLeg(idx, { atBody: e.target.value })}>
                      {planetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>Encounter date
                    <input type="datetime-local" value={jdToInputValue(leg.atJd)} onChange={(e) => updateLeg(idx, { atJd: inputValueToJd(e.target.value) })} />
                  </label>
                  <label>Flyby altitude (km)
                    <input type="number" step="1000" value={leg.periapsisAltitudeKm} onChange={(e) => updateLeg(idx, { periapsisAltitudeKm: Number(e.target.value) })} />
                  </label>
                  <label>Pass on the planet's
                    <select value={leg.side} onChange={(e) => updateLeg(idx, { side: e.target.value })}>
                      <option value="leading">Leading side</option>
                      <option value="trailing">Trailing side</option>
                    </select>
                  </label>
                </div>
              )}

              {resolved && (
                <div className="mission-leg-result">
                  {leg.type === 'transfer' ? (
                    <>
                      <span>Departure Δv: {resolved.departureDeltaVKmPerS.toFixed(2)} km/s</span>
                      <span>Arrival Δv: {resolved.arrivalDeltaVKmPerS.toFixed(2)} km/s</span>
                    </>
                  ) : (
                    <span>Δv: {resolved.deltaVKmPerS.toFixed(2)} km/s</span>
                  )}
                  {leg.type === 'gravityAssist' && <span>Turn: {resolved.turningAngleDeg.toFixed(1)}°</span>}
                  <span>Resulting orbit: {formatOrbitType(resolved.travelElements)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mission-add-row">
        <button className="btn" onClick={() => addLeg(defaultTransferLeg)}>+ Transfer</button>
        <button className="btn" onClick={() => addLeg((j) => defaultBurnLeg(j, legs.length === 0))}>+ Burn</button>
        <button className="btn" onClick={() => addLeg(defaultGravityAssistLeg)}>+ Gravity assist</button>
      </div>

      {error && <div className="mission-error">{error}</div>}

      {!error && legs.length > 0 && (
        <div className="mission-total">
          Total mission Δv: <strong>{computedMission.totalDeltaVKmPerS.toFixed(2)} km/s</strong>
        </div>
      )}
    </div>
  );
}
