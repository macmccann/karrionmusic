The browser tests cover WebGL context recovery, GPU resource cleanup on resize,
initialization failures, and responsive phone layouts in Chromium and mobile
WebKit.

With Node.js and `uv` installed, run from the repository root:

```sh
npm ci
npx playwright install chromium webkit
npm test
```

The tests start a local static server automatically. Context loss is simulated
with `WEBGL_lose_context`; pixel checks exclude the portrait and icons to verify
that the fluid itself resumes rendering. The resize test counts live GPU
textures and framebuffers to catch resources accumulating across orientation
changes.
