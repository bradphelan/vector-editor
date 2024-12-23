<script lang="ts">
  import { onDestroy, onMount, setContext } from "svelte";
  import type { DrawFn } from "../types";

  let canvasElement: HTMLCanvasElement;
  let fnsToDraw = [] as DrawFn[];
  let frameId: number;

  setContext("canvas", {
    addDrawFn: (fn: DrawFn) => {
      fnsToDraw.push(fn);
    },
    removeDrawFn: (fn: DrawFn) => {
      let index = fnsToDraw.indexOf(fn);
      if (index > -1) {
        fnsToDraw.splice(index, 1);
      }
    },
  });

  onMount(() => {
    // get canvas context
    let ctx = canvasElement.getContext("2d");

    let frameId = requestAnimationFrame(() => {
      if (ctx != null) draw(ctx);
    });

    // Set the display size (scaled for device's pixel ratio)
    const scale = window.devicePixelRatio;
    canvasElement.width = Math.floor(800 * scale); // Set the width to 300px scaled
    canvasElement.height = Math.floor(600 * scale); // Set the height to 300px scaled
    canvasElement.style.width = "800px"; // Set the CSS width to 300px
    canvasElement.style.height = "600px"; // Set the CSS height to 300px

    // Scale the drawing context
    ctx.scale(scale, scale);

    // Shift origin to bottom-left and invert Y
    ctx.translate(0, canvasElement.height / scale);
    ctx.scale(1, -1);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
  });

  onDestroy(() => {
    if (frameId) cancelAnimationFrame(frameId);
  });

  function draw(ctx: CanvasRenderingContext2D) {
    // Clear in untransformed space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.restore();

    fnsToDraw.forEach((fn) => fn(ctx));
    frameId = requestAnimationFrame(() => draw(ctx));
  }
</script>

<slot />

<canvas
  bind:this={canvasElement}
  on:click
  on:mousemove
  on:mousedown
  on:mouseup
  on:keydown
  on:keyup
  on:keypress
  on:dblclick
/>

<style>
  canvas {
    /* drop shadow border */
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.2);
    background-color: white;
  }
</style>
