# Orrery

A React + HTML canvas orrery: it plots the Sun, the eight planets (plus Pluto), 22 major moons and Halley's Comet from real orbital elements, and lets you run, reverse or jump time and fly the camera around to watch how everything moves. A second "Mission Planner" mode lets you plan a probe trajectory on top of that same solar system: Lambert-solved transfers, propellant burns (including a solar Oberth escape), and real planetary gravity assists.

## Running it

```
npm install
npm run dev
```

Vite serves the app on its own port; there is no backend, no API and no database. Everything is computed client-side.

```
npm run build    # production build
npm run lint     # oxlint
npm test         # vitest - unit tests for the orbital-mechanics physics
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

### The mission planner

The Mission Planner tab reuses the same canvas, camera and time controls, with a `mission` overlay drawn on top: each leg's path, a probe marker, and a dashed sphere-of-influence circle at gravity-assist waypoints. It's a sandbox, not a puzzle: no scoring, no delta-v budget limit, just plan legs and watch the solved trajectory drawn and animated.

[`src/physics/kepler.js`](src/physics/kepler.js) is never modified for any of this - it's already correct and the existing orrery depends on it. All new physics lives in [`src/physics/orbitalMechanics.js`](src/physics/orbitalMechanics.js) and [`src/physics/mission.js`](src/physics/mission.js):

- **State vectors both ways.** `velocityAt` is the velocity counterpart to `positionAt`. `elementsFromStateVector` is the inverse of both: given a position and velocity at an instant, it recovers the classical orbital elements, which is what turns "the probe just got a delta-v" into "here is the probe's new orbit." Because everything here is 2D, inclination collapses to exactly 0° (prograde) or 180° (retrograde) rather than some angle in between - there's no "which way is up" choice in a flat model, only "which way around."
- **Hyperbolic orbits.** A burn or a gravity assist can push a probe's eccentricity past 1 (unbound). `kepler.js`'s solver only handles ellipses, so `orbitalMechanics.js` carries an explicit hyperbolic twin of it (`solveKeplerHyperbolic`, solving `M = e·sinh(H) - H`), mirroring the elliptical solver's style rather than reaching for the more general but less readable universal-variable/Stumpff-function formulation.
- **Lambert's problem** (`solveLambert`) answers "given a start point, an end point and a time of flight, what velocity gets me there?" - the actual targeting problem behind the Halley rendezvous. It's the standard universal-variable algorithm, deliberately restricted to the elliptical/parabolic branch: every sensible transfer between two heliocentric bodies is itself elliptical in practice, so this covers everything the UI would ask for and fails with a clear message on a time of flight too short to be physical, rather than silently returning a hyperbolic transfer nobody asked to see.
- **Gravity assists** (`mission.js`'s `gravityAssist` leg) treat the encounter as an instantaneous, point-mass patched conic: compute the probe's velocity relative to the planet, bend that relative velocity by a turning angle set by the flyby's periapsis distance (`e = 1 + rp·v∞²/GM`, `turning angle = 2·asin(1/e)`), then add the planet's own velocity back. This is genuine momentum exchange with a *moving* body, at zero propellant cost - a different mechanism from the Oberth burn below, and worth keeping distinct for teaching purposes (see Teaching notes).
- **The solar Oberth "sundiver" escape** needs no Lambert solve at all: it's a `burn` leg (retrograde, at Earth) that drops perihelion while leaving aphelion where it started, followed by a second `burn` timed at that new perihelion (`timeOfPeriapsisPassage` finds when) that pushes the orbit's eccentricity past 1.

Every leg type (`transfer`, `burn`, `gravityAssist`) is resolved by [`computeMission`](src/physics/mission.js), which chains them in order, and `sampleMissionAt(mission, jd)` is the mission-mode equivalent of `solarSystem.js`'s `computeSystem(jd)` - it answers "where is the probe right now," which is what lets the existing time-scrubbing controls animate a mission for free.

All of this is covered by a `vitest` unit-test suite (round-trips, energy-conservation checks, and the specific claims in the Teaching notes below - e.g. that a deeper Oberth dive genuinely costs less delta-v for the same escape speed) rather than only being eyeballed on the canvas, because subtle sign and unit errors in orbital mechanics are easy to write and easy to miss visually.

### File map

```
src/
  physics/
    time.js               Julian Date <-> JS Date, GMT-safe
    kepler.js              Kepler's equation, orbital-plane -> ecliptic transform
    solarSystem.js          ties data + kepler.js together for a given date
    orbitalMechanics.js      state vectors, hyperbolic orbits, Lambert's problem
    mission.js               transfer/burn/gravityAssist leg model
  data/
    planets.js             Sun-orbiting bodies, JPL elements + secular rates + GM/radius
    moons.js                moons, grouped by parent planet
    comets.js                irregular visitors, Halley seeded
  components/
    OrreryCanvas.jsx        canvas rendering, pan/zoom/select, mission overlay
    TimeControls.jsx        play/pause/speed/reverse/jump-to-date
    ObjectPanel.jsx         body list, info card, label mode, focus button
    MissionBuilder.jsx      mission-planner sidebar: leg list, per-leg forms, delta-v
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
- A genuinely unbound object, on a hyperbolic path with positive total energy (a true interstellar visitor, something moving faster than local escape velocity), would show the same slowing-down behaviour on the way out, but would never turn around. It just gets asymptotically closer to a fixed leftover speed and leaves for good. You can build exactly this comparison yourself in the Mission Planner tab: a two-burn "sundiver" mission (drop perihelion, then burn again at that new perihelion) tips a bound ellipse into an unbound hyperbola, and the drawn path visibly stops closing back on itself and heads off the edge of the display instead. See the Mission Planner section below for what that's actually demonstrating.

A good classroom exercise: jump to a date near Halley's aphelion, pause, and ask students to predict what happens next before pressing play. Most will get it right on reflection, but the "why doesn't it just float off" question is worth asking out loud first.

### Make it personal: how old will you be?

The single most effective way to make Halley's 75-year period land with a class isn't the physics at all, it's the arithmetic of their own age. Halley's next perihelion is predicted for 2061; its previous one was 1986. Ask each student to do the sum themselves:

> **Your age when Halley returns = your age now + (2061 − this year).**

A 16-year-old today will be **51** when it comes back. Their teacher will very likely not be around to see it a second time; their (hypothetical) grandchild might. It's the same equal-areas, same-gravity, same slow-return physics covered above, but framed as "this is a once-in-a-working-lifetime event, and here's exactly where you'll be standing for it" rather than an abstract orbital period - which tends to land harder than any diagram does. Pull the actual date up in the Orrery tab (jump to 2061) and it stops being an arithmetic exercise and becomes a specific place in the sky on a specific day they can now put an age against.

Worth noting for accuracy: the widely-quoted return date is *2061*, not the 2100 date sometimes seen in loosely-sourced material - Halley's period is close to but not exactly 75 years (see its `periodDays` in [`src/data/comets.js`](src/data/comets.js): about 75.32 years), and 1986 + 75.32 lands in 2061, not 2100. Worth flagging to students as a small lesson in checking a claimed date against the underlying number rather than taking a rounded "75 years" at face value.

### Other things worth pointing at

- **Retrograde motion for free**: Triton orbits Neptune backwards relative to Neptune's own spin and orbital motion. It's in the moon data as an inclination of about 157 degrees rather than a negative rate. If you zoom into Neptune and watch, you can literally see it going the "wrong way" round, which is a nice hook for explaining that Triton is thought to be a captured Kuiper Belt object rather than one that formed in place, unlike Neptune's other moons.
- **Orbital resonance**: the Galilean moons Io, Europa and Ganymede orbit in a 1:2:4 resonance (Io orbits four times for every once round for Ganymede). Zoom into Jupiter and run time forward; the moons realign in the same relative pattern with a regularity that's visually obvious, and it's a good lead-in to why that resonance keeps Io's interior flexing and volcanically active.
- **Eccentricity by eye**: put Mercury (e ≈ 0.206), Earth (e ≈ 0.017) and Halley (e ≈ 0.967) on screen together at a zoom where all three orbits fit, and the visual difference between "nearly circular" and "extremely elongated" does more work than the number does on its own.
- **Inclination**: Pluto's orbit (about 17 degrees to the ecliptic) visibly tilts out of the plane that the other planets share, which is one of the reasons it doesn't collide with Neptune despite their orbits crossing on a 2D diagram.
- **Scale**: focusing on the Sun and zooming out slowly from Mercury's orbit to Pluto's is a more honest way to convey the emptiness of the solar system than any textbook diagram, which almost always compresses the outer planets' distances to fit the page.

### Mission Planner: two mechanisms that get confused with each other

Your two motivating examples for this feature - rendezvousing with Halley near its turnaround, and using the Sun to "slingshot" out of the solar system - are actually testing two different pieces of physics, and it's worth being explicit with students about which is which, because they get conflated a lot in popular science writing.

- **A gravity assist is a momentum trade with a moving planet.** Swinging past something that isn't moving (like the Sun) gains you nothing on its own - there's no momentum to borrow from a stationary object. A planet works because it's orbiting the Sun itself; in the planet's own reference frame the flyby only *bends* the probe's velocity, it doesn't speed it up, but bending that velocity while the planet is dragging its own reference frame along at tens of km/s can add (or subtract) a large chunk of the planet's own orbital speed once you look at it from the Sun's frame. Build the Jupiter gravity-assist leg in this app and check the numbers: delta-v is exactly zero, but the "turning angle" readout shows the trajectory was genuinely redirected. That zero-cost redirection *is* the whole trick, and it's why real missions (Voyager, Cassini, New Horizons) chain several of them rather than brute-forcing everything with propellant.
- **An Oberth burn is an energy trick with a stationary Sun**, and it works for a completely different reason: kinetic energy depends on speed *squared*, so the same fixed dose of delta-v adds far more energy when you're already moving fast (deep in the Sun's gravity well, near perihelion) than when you're moving slowly (far out). Build the two-burn sundiver mission and compare a shallow dive against a deep one for the *same* target escape speed - the deep dive costs less delta-v for an identical outcome, purely because the second burn lands at a higher starting speed. This is a genuinely different lesson from the gravity assist: no other body's momentum is involved at all, just where along your own orbit you choose to spend the fuel.

A good way to make students notice the distinction themselves: ask them to explain, in their own words, why the Sun can't give a probe a "gravity assist" the way Jupiter can. The answer ("the Sun isn't going anywhere") is short, but getting there usually surfaces whether they've actually understood momentum versus energy, or were just pattern-matching "flew past something big, got faster."

## Known gaps

Everything below is a deliberate scope line for this pass, not an oversight - each is a reasonable follow-on if this becomes a bigger tool:

- **Targets are chosen by name, not by clicking the canvas.** There's no "click a point in space" picker; a transfer or gravity-assist leg always aims at a named body (or a burn from one).
- **No automatic trajectory optimiser.** This is a sandbox: you dial in dates, burns and flyby altitudes and see what happens, the way real early-stage mission design actually works, rather than a solver searching for the cheapest possible transfer window for you.
- **Halley's real ~18° inclination is discarded**, same as everywhere else in this app - the departure delta-v numbers for a Halley rendezvous are inflated by that missing geometry, even though the arrival delta-v (the number the aphelion lesson actually depends on) stays meaningfully small and correct in shape.
- **Lambert's problem is solved planar, single-revolution, short-or-long-way only** - no 3D plane-of-motion resolution and no multi-revolution transfers, which is the right complexity trade-off for a teaching tool but would need extending for anything closer to real mission design.
- **A gravity assist's sphere of influence is drawn, not simulated.** The turning-angle physics uses the planet's GM and the flyby's periapsis distance directly (the standard patched-conic simplification); the dashed circle on screen is there so students can see where the "kink" comes from, not because the app models entering and leaving that sphere as a separate phase of flight.
