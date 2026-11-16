import { createFluidSimulation } from "./script.js";

const canvas = document.getElementById("fluid-background");
let controller;

function stop() {
  controller?.abort();
  canvas.classList.remove("is-ready");
}

function handleError(error) {
  stop();
  console.warn("Fluid background unavailable.", error);
}

function start() {
  stop();
  controller = new AbortController();
  try {
    createFluidSimulation(canvas, {
      signal: controller.signal,
      onReady: () => canvas.classList.add("is-ready"),
      onError: handleError,
    });
  } catch (error) {
    handleError(error);
  }
}

canvas.addEventListener("webglcontextlost", (event) => {
  // Opt into restoration and stop submitting work to invalid GPU resources.
  event.preventDefault();
  stop();
});
canvas.addEventListener("webglcontextrestored", start);

start();
