# MAZUMS Ultra Smooth Scroll Cinema

Performance-first cinematic graduation landing page for Mazandaran University of Medical Sciences.

## What changed

- Native browser scrolling: no Lenis, GSAP or ScrollTrigger dependency.
- No Three.js/WebGL render loop or bloom post-processing.
- No full-screen canvas redraw of every video frame.
- The scroll film is rendered directly by the video element.
- The film is prebuffered into memory before the loader exits, eliminating network stalls during scrubbing.
- New H.264 scrub masters use short GOPs (keyframe every 3 frames) and `faststart`.
- Desktop video: 540x960, 231 frames, 15 fps, ~4.7 MB.
- Mobile video: 360x640, 231 frames, 15 fps, ~2.8 MB.
- Stale seeks are never queued; the newest scroll position always replaces the previous target.
- Future chapter images are hydrated only as the user approaches them.
- Runtime blur/backdrop-filter/mix-blend effects were removed from moving full-screen layers.
- 3D feeling is preserved with transform-only depth rings, camera-like image drift, a continuous story trace and cinematic light transitions.
- All project paths are relative and GitHub Pages compatible.

## Publish on GitHub Pages

Upload the contents of this folder directly to the repository root, commit to `main`, then use **Settings → Pages → Deploy from a branch → main / root**.

No build step is required.
