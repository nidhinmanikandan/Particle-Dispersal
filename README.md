# Particle Image Lab

A browser-only React + Three.js experiment that converts an uploaded image into a particle field, uses brightness as pseudo-depth, animates the points, and draws screen-space tracking brackets over selected particles.

## Run locally

1. Install Node.js (LTS).
2. Open a terminal in this folder.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL printed by Vite.

No backend, AI API, or Blender is required. Image processing happens locally in the browser.

## Notes

- Depth is a brightness-based relief approximation, not true single-image 3D reconstruction.
- Tracking brackets follow projected particle positions; this is a visual tracking overlay, not object recognition.
- For better performance on weaker GPUs, lower Particle density.
