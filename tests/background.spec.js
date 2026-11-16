const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");

function coloredPixels(buffer) {
  const { data } = PNG.sync.read(buffer);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const channels = [data[i], data[i + 1], data[i + 2]];
    if (Math.max(...channels) - Math.min(...channels) > 20) count++;
  }
  return count;
}

test.beforeEach(async ({ page }) => {
  // Keep the initial fluid splats reproducible and avoid external font requests.
  await page.addInitScript(() => {
    let seed = 7;
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.abort(),
  );
});

test("fluid renders again after repeated WebGL context loss", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // Exclude the portrait and icons so only fluid can satisfy the pixel check.
  await page.addStyleTag({
    content: ".music-container { visibility: hidden; }",
  });
  await expect
    .poll(async () => coloredPixels(await page.locator("canvas").screenshot()))
    .toBeGreaterThan(100);

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.evaluate(async () => {
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      window.testContext = gl;
      window.testContextExtension = gl.getExtension("WEBGL_lose_context");
      const lost = new Promise((resolve) =>
        canvas.addEventListener(
          "webglcontextlost",
          () => setTimeout(resolve, 0),
          { once: true },
        ),
      );
      window.testContextExtension.loseContext();
      await lost;
    });
    await expect(page.locator("canvas")).toBeHidden();
    await page.evaluate(() => window.testContextExtension.restoreContext());
    await expect
      .poll(() => page.evaluate(() => !window.testContext.isContextLost()))
      .toBe(true);
    await expect
      .poll(async () =>
        coloredPixels(await page.locator("canvas").screenshot()),
      )
      .toBeGreaterThan(100);
    const firstFrame = await page.locator("canvas").screenshot();
    await expect
      .poll(async () =>
        firstFrame.equals(await page.locator("canvas").screenshot()),
      )
      .toBe(false);
  }
  expect(errors).toEqual([]);
});

for (const failure of [
  "unavailable",
  "unsupported textures",
  "shader failure",
  "framebuffer failure",
]) {
  test(`content remains usable on black after ${failure}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((failure) => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (!type.includes("webgl"))
          return getContext.call(this, type, ...args);
        if (failure === "unavailable") return null;
        const gl = getContext.call(this, type, ...args);
        if (!gl) return gl;
        if (failure === "shader failure") gl.getShaderParameter = () => false;
        if (failure === "unsupported textures")
          gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_UNSUPPORTED;
        if (failure === "framebuffer failure") {
          // Allow format probes, then fail allocation of a full-size target.
          const check = gl.checkFramebufferStatus.bind(gl);
          let probes = 0;
          gl.checkFramebufferStatus = (...args) =>
            ++probes <= 3
              ? check(...args)
              : gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        return gl;
      };
    }, failure);
    await page.goto("/");
    await expect(page.locator("canvas")).toBeHidden();
    await expect(page.locator("#socials a")).toHaveCount(5);
    await expect(page.locator(".bio")).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = PNG.sync.read(
          await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } }),
        );
        return data
          .filter((_, index) => index % 4 !== 3)
          .some((channel) => channel > 5);
      })
      .toBe(false);
    expect(errors).toEqual([]);
  });
}

test("resizing releases old GPU buffers", async ({ page }) => {
  await page.addInitScript(() => {
    window.liveTextures = 0;
    window.liveFramebuffers = 0;
    for (const prototype of [
      WebGLRenderingContext.prototype,
      WebGL2RenderingContext.prototype,
    ]) {
      for (const [kind, counter] of [
        ["Texture", "liveTextures"],
        ["Framebuffer", "liveFramebuffers"],
      ]) {
        const create = prototype[`create${kind}`];
        const remove = prototype[`delete${kind}`];
        const resources = new Set();
        prototype[`create${kind}`] = function (...args) {
          const resource = create.apply(this, args);
          if (resource) {
            resources.add(resource);
            window[counter]++;
          }
          return resource;
        };
        prototype[`delete${kind}`] = function (resource) {
          if (resources.delete(resource)) window[counter]--;
          return remove.call(this, resource);
        };
      }
    }
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const counts = () =>
    page.evaluate(() => [window.liveTextures, window.liveFramebuffers]);
  const original = await counts();
  const pixelRatio = await page.evaluate(() => Math.min(devicePixelRatio, 2));
  expect(original[0]).toBeGreaterThan(0);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1000, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.querySelector("canvas").width))
      .toBe(viewport.width * pixelRatio);
    expect(await counts()).toEqual(original);
  }
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`content fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const selector of [
      "#frosted-glass-container",
      "#portrait",
      ".bio",
      "#socials",
    ]) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds.x, selector).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, selector).toBeLessThanOrEqual(
        viewport.width,
      );
    }
    await page.locator("#socials").scrollIntoViewIfNeeded();
    await expect(page.locator("#socials")).toBeInViewport();
  });
}
