# Performance audit — mg GitHub Pages version

Audited target: `https://alinayab2020.github.io/mg/` and the public `alinayab2020/mg` source.

## Main causes of the visible lag in the previous version

1. **The same scroll-video frame was decoded and then redrawn into a full-screen Canvas.** Desktop also applied a large dynamic Canvas blur to the full-screen copy. That creates additional raster/GPU work on every frame.
2. **Video seeks were serialized with a `seekBusy` lock.** While one seek was running, newer scroll targets had to wait. During fast scroll this makes the visual playhead trail the user's finger/wheel.
3. **A separate Three.js/WebGL world rendered continuously with `requestAnimationFrame`.** High quality also enabled an EffectComposer + UnrealBloomPass and up to 1.8 DPR.
4. **The WebGL loop mutated particle geometry and many object/material properties every frame.** This competes with video decoding exactly when scroll-scrubbing needs the main thread/GPU.
5. **Several moving full-screen layers used runtime `blur()`, `backdrop-filter`, `mix-blend-mode`, SVG turbulence grain and large shadows.** These increase compositing and raster cost.
6. **Lenis + GSAP + ScrollTrigger + Three.js were fetched from an external ESM CDN.** This adds dependency/network latency and makes first-run behavior less deterministic on GitHub Pages.
7. **The hero MP4 was ~10.3 MB.** All 231 frames were I-frames. Seeking was simple, but download/decode pressure was unnecessarily high.
8. **Multiple large chapter images were present from the start.** Even hidden images could be decoded and compete for memory/GPU resources.
9. **Duplicate 1600/2400 image variants existed at identical source dimensions/filesizes.** They added package weight without delivering extra detail.
10. **The boot sequence waited on broad page resources rather than preparing only what the first interaction actually needs.**

## Fixes in this package

- Removed Canvas video rendering entirely. The browser renders the `<video>` directly.
- Replaced serialized seek queuing with a **latest-target-wins** strategy: new scroll input immediately replaces stale seek targets.
- The scroll film is **prebuffered into an in-memory Blob** before the loader exits, preventing GitHub/network range stalls during the actual scrub.
- Re-encoded the scrub film with H.264, `faststart`, and a keyframe every 3 frames.
  - Desktop: 540×960, 231 frames, 15 fps, ~4.7 MB.
  - Mobile: 360×640, 231 frames, 15 fps, ~2.8 MB.
- Removed Three.js, WebGL, EffectComposer and bloom completely.
- Removed GSAP, ScrollTrigger and Lenis. Scrolling is now native and immediate.
- All animation is scroll-driven and coalesced to **one requestAnimationFrame per scroll update**.
- Replaced expensive moving blur/blend effects with transform/opacity-only cinematic layers.
- Replaced runtime SVG turbulence grain with a tiny static PNG texture.
- Replaced 3D WebGL objects with lightweight CSS perspective/depth rings and a persistent narrative path.
- Chapter images are loaded **just-in-time, one scene ahead**.
- Added real mobile-specific image/video assets.
- Removed duplicate oversized image variants.
- Removed all runtime external CDN/script/font dependencies; only the optional university hyperlink is external.
- Preserved relative paths for GitHub project Pages (`/mg/`).

## Verification performed

- JavaScript syntax check: passed.
- HTML parse: passed.
- CSS parse: passed.
- Checked all 16 local asset references: no missing files.
- Checked for root-absolute `/assets/...` paths: none.
- Verified both MP4s are H.264, 231 frames at 15 fps.
- Verified both MP4s have 76 keyframes (one every 3 frames) and `moov` precedes `mdat` (`faststart`).
- Rendered desktop and mobile versions in headless Chromium using the actual optimized assets.
- Console errors during the render test: none.
- Video was fully loaded from a Blob and reached readyState 4 in both desktop and mobile tests.
- Automated 180-step full-journey scroll simulation:
  - Desktop median rAF interval: 16.7 ms; p95: 16.8 ms; 0 long tasks.
  - Mobile median rAF interval: 16.7 ms; p95: 16.7 ms; 0 long tasks.

The browser simulation is a controlled verification, not a guarantee of identical FPS on every phone. The architecture is deliberately designed so slower devices have substantially less work than the previous version.
