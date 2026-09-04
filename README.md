# Orrery

A React + HTML canvas orrery: it plots the Sun, the eight planets (plus Pluto), 22 major moons and Halley's Comet from real orbital elements, and lets you run, reverse or jump time and fly the camera around to watch how everything moves.

This is stage one of a bigger plan. The coordinate system and body-state model here are meant to be the foundation for a later stage that plans intra-solar-system probe trajectories.

## Running it

```
npm install
npm run dev
```

Vite serves the app on its own port; there is no backend, no API and no database. Everything is computed client-side.

```
npm run build    # production build
npm run lint     # oxlint
```

## Technical notes

### How a position is calculated

Every body (planet, moon or comet) is described by a set of classical Keplerian orbital elements: semi-major axis, eccentricity, inclination, longitude of ascending node, argument of periapsis, and a mean anomaly tied to a reference date. Given a Julian Date, [`src/physics/kepler.js`](src/physics/kepler.js) does the same three-step job for every body:

1. Advance the mean anomaly to the requested date and solve Kepler's equation `M = E - e·sin(E)` for the eccentric anomaly `E`, by Newton-Raphson iteration.
2. Turn `E` into a true anomaly and a radius, which gives the body's position in its own orbital plane.
3. Rotate that position by inclination, node and argument of periapsis to land it in the shared ecliptic frame.

Planets also carry secular rates (how much each element drifts per Julian century), taken from JPL's published low-precision elements, valid roughly 1800 to 2050. Moons and the comet use fixed elements with no drift, which is a reasonable trade-off given their much shorter periods.

Orbit paths on screen are the same ellipse traced out for a full revolution using the element set at the current date. Because this is a static two-body model with no perturbation from other planets, that single traced ellipse *is* the past and future path. Nothing is extrapolated separately for "history" versus "projection".

Everything is 2D. Positions are computed in 3D and then z is dropped, giving the conventional top-down view of the solar system. Inclinations are still used in the maths (they affect x and y through the rotation), just not drawn as height.

### Data and its limits

- **Planets** ([`src/data/planets.js`](src/data/planets.js)): JPL's Keplerian elements for the major planets, including Pluto. Accurate to roughly a degree over centuries, which is what "simplified Keplerian" buys you: no perturbation theory, no numerical integration, just closed-form ellipses that drift slowly and correctly.
- **Moons** ([`src/data/moons.js`](src/data/moons.js)): 22 of the best-known moons, one set per planet (Earth's Moon; Phobos and Deimos; the four Galilean moons; seven major Saturnian moons; five major Uranian moons; Triton and Nereid; Charon). Semi-major axis, eccentricity and period are real published mean values. The *starting phase* of each moon (other than a rough placement) is spread out arbitrarily rather than read off a precise ephemeris, so a moon's exact position in the sky on a given date is illustrative, not authoritative. The shape, size, period and resonances between moons are all correct.
- **Comets** ([`src/data/comets.js`](src/data/comets.js)): a generic element-based framework, seeded with Halley's Comet (e = 0.967, period ≈ 75.3 years, last perihelion 1986). Adding another periodic comet is a data change, not a code change. The shared solver only handles closed ellipses (e < 1), which covers every known periodic comet but not a one-off hyperbolic interstellar visitor.

### Scale and the camera

Distances are true to scale in AU throughout, for both orbit radius and body separation. Nothing is scaled by planet size, either: markers are a fixed, readable pixel size regardless of the real diameter, because a true-to-scale Jupiter next to a true-to-scale orbit would be a fraction of a pixel wide.

Because distances are honest, the same view can't usefully show the whole solar system and a planet's moon system at once; Jupiter's moons sit at a scale roughly four orders of magnitude smaller than Jupiter's distance from the Sun. The camera in [`src/components/OrreryCanvas.jsx`](src/components/OrreryCanvas.jsx) handles this with:

- scroll-wheel zoom, centred on the cursor
- click-and-drag pan
- a "Focus camera here" button per body, which recentres the camera on that body and picks a sensible zoom (fit Pluto's aphelion for the Sun, fit the outermost moon for a planet)

### Time

[`src/physics/time.js`](src/physics/time.js) converts between JavaScript `Date` objects and Julian Dates, always treating the JS `Date` as GMT/UTC. The date-jump field in the UI is parsed manually from its `YYYY-MM-DDTHH:MM` string using `Date.UTC(...)`, deliberately bypassing the browser's local timezone, so "jump to date" always means GMT regardless of where the browser thinks it is.

Playback runs on `requestAnimationFrame`, converting real elapsed milliseconds into simulated days at whatever speed is selected (from 1 hour/sec up to 100 years/sec), with a separate reverse toggle that just negates the speed.

### File map

```
src/
  physics/
    time.js          Julian Date <-> JS Date, GMT-safe
    kepler.js         Kepler's equation, orbital-plane -> ecliptic transform
    solarSystem.js     ties data + kepler.js together for a given date
  data/
    planets.js        Sun-orbiting bodies, JPL elements + secular rates
    moons.js           moons, grouped by parent planet
    comets.js          irregular visitors, Halley seeded
  components/
    OrreryCanvas.jsx   canvas rendering, pan/zoom/select
    TimeControls.jsx   play/pause/speed/reverse/jump-to-date
    ObjectPanel.jsx    body list, info card, label mode, focus button
```

### Known simplifications, stated plainly

- No perturbations between bodies. Jupiter doesn't tug on Saturn here. Over the 1800-2050 window this is a small effect for planets; it's why the elements include secular drift rather than needing full integration.
- Moon phase (not shape) is illustrative rather than ephemeris-accurate.
- Only one comet is seeded, though the data shape supports more.
- No relativistic correction (irrelevant at this precision; Mercury's perihelion precession is folded into its secular rate anyway).

## Teaching notes

This app is genuinely useful for showing things that are hard to get across from a static diagram, because it's the *motion* that makes the physics visible.

### Kepler's second law, made obvious

Watch any planet, but especially Mercury or Halley's Comet, run at a fast forward speed. The marker visibly speeds up near the Sun and crawls near aphelion. That's Kepler's second law: equal areas in equal times. A textbook diagram of an ellipse with a shaded wedge doesn't convey how dramatic the speed difference actually is. Halley's Comet is the best demonstration in the whole simulation, because its eccentricity (0.967) is so extreme that the effect is almost cartoonish, whereas Earth's orbit (eccentricity 0.017) barely shows it at all. Setting those two side by side is a good "why do we even need this law" moment.

### The bit that struck you: Halley's slow return

Run time forward from a perihelion passage (1986, or the predicted 2061 return) at high speed and watch Halley's Comet climb out past Jupiter, past Saturn, past Neptune, slowing the whole way, hang near its most distant point for what feels like a very long stretch of simulated time, and then start falling back in.

This is worth pulling students up on specifically, because the intuition it corrects is quite common: "surely once it's past Neptune the Sun's gravity is basically switched off and it should just drift away." It doesn't, and the reason is a good one to sit with:

- Gravity in this model (and in reality, to excellent approximation at solar-system distances) never actually reaches zero. It falls off as 1/r², so it gets *weak* very fast, but weak is not zero. At 35 AU it's about 1/35² ≈ 1/1225 of its strength at Earth's distance, and that is still enough to matter over the years it takes to make the return trip.
- What decides whether an object escapes or returns isn't distance, it's whether its total orbital energy (kinetic plus gravitational potential) is negative or positive. Halley's Comet has negative total energy: it's gravitationally *bound* to the Sun, the same way the Moon is bound to Earth even though the Moon is "far away" compared to the size of the Earth. A bound object always comes back, no matter how far out its orbit takes it, because there's nowhere else for that energy to go.
- Slowing down near aphelion isn't the comet running out of steam and giving up, either. It's exactly conservation of energy: as the comet climbs away from the Sun it trades kinetic energy for gravitational potential energy, the same way a ball thrown straight up slows down as it rises. It reaches a point (aphelion, roughly 35 AU for Halley) where its outward speed hits zero, and at that point the still-present, still-real pull of the Sun's gravity is the only force acting on it, so it has no option but to fall back.
- A genuinely unbound object, on a hyperbolic path with positive total energy (a true interstellar visitor, something moving faster than local escape velocity), would show the same slowing-down behaviour on the way out, but would never turn around. It just gets asymptotically closer to a fixed leftover speed and leaves for good. The comet dataset in this app only supports closed ellipses, so that comparison would need extending `kepler.js` with a parabolic/hyperbolic solver, which is flagged in the code as a deliberate gap.

A good classroom exercise: jump to a date near Halley's aphelion, pause, and ask students to predict what happens next before pressing play. Most will get it right on reflection, but the "why doesn't it just float off" question is worth asking out loud first.

### Other things worth pointing at

- **Retrograde motion for free**: Triton orbits Neptune backwards relative to Neptune's own spin and orbital motion. It's in the moon data as an inclination of about 157 degrees rather than a negative rate. If you zoom into Neptune and watch, you can literally see it going the "wrong way" round, which is a nice hook for explaining that Triton is thought to be a captured Kuiper Belt object rather than one that formed in place, unlike Neptune's other moons.
- **Orbital resonance**: the Galilean moons Io, Europa and Ganymede orbit in a 1:2:4 resonance (Io orbits four times for every once round for Ganymede). Zoom into Jupiter and run time forward; the moons realign in the same relative pattern with a regularity that's visually obvious, and it's a good lead-in to why that resonance keeps Io's interior flexing and volcanically active.
- **Eccentricity by eye**: put Mercury (e ≈ 0.206), Earth (e ≈ 0.017) and Halley (e ≈ 0.967) on screen together at a zoom where all three orbits fit, and the visual difference between "nearly circular" and "extremely elongated" does more work than the number does on its own.
- **Inclination**: Pluto's orbit (about 17 degrees to the ecliptic) visibly tilts out of the plane that the other planets share, which is one of the reasons it doesn't collide with Neptune despite their orbits crossing on a 2D diagram.
- **Scale**: focusing on the Sun and zooming out slowly from Mercury's orbit to Pluto's is a more honest way to convey the emptiness of the solar system than any textbook diagram, which almost always compresses the outer planets' distances to fit the page.

## Known gaps for the next stage

The physics core (`kepler.js`, `solarSystem.js`) already produces a heliocentric AU position for every body at any date, which is the input a trajectory planner needs. The obvious next additions, when that stage starts, are patched-conic or numerical-integration transfer calculations between two body states, and a parabolic/hyperbolic branch in the Kepler solver for unbound trajectories.
