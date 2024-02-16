<script lang="ts">
  import { onMount } from "svelte";
  import Canvas from "./lib/Canvas.svelte";
  import Line from "./lib/Line.svelte";
  import Polyline from "./lib/Polyline.svelte";
  import type { Point } from "../types";

  let canvas;
  let context;
  let isDrawing = false;
  let mode = "freehand"; // Default mode
  let currentCurve: Point[] = [];
  let curves: Point[][] = [];
  let tempLineStart: Point = null;
  let cppInitializerList = ""; // This will hold the C++ initializer list
  let closeCurves = true;

  let editedCurve = 0;
  let editedPoint = 0;
  let editing = false;

  function handleMouseDown(event) {
    console.log("handleMouseDown");
    isDrawing = true;
    const newPoint = [event.offsetX, event.offsetY];
    if (mode === "freehand") {
      // Start a new curve in freehand mode
      currentCurve = [newPoint];
      curves.push(currentCurve);
      curves = curves;
    } else if (mode === "lines") {
      // Add a point to the current curve or start a new one
      if (currentCurve.length === 0) {
        // Start a new curve
        currentCurve.push(newPoint);
        currentCurve = currentCurve;
        curves.push(currentCurve);
        curves = curves;
      } else {
        // Add a point to the current curve
        currentCurve.push(newPoint);
        currentCurve = currentCurve;
      }
      tempLineStart = newPoint; // Start the temporary line
    } else if (mode === "edit") {
      // Find the closest point to the mouse and drag it
      let minDistance = Infinity;
      for (let i = 0; i < curves.length; i++) {
        for (let j = 0; j < curves[i].length; j++) {
          const distance = Math.sqrt(
            (curves[i][j][0] - event.offsetX) ** 2 +
              (curves[i][j][1] - event.offsetY) ** 2
          );
          if (distance < minDistance) {
            minDistance = distance;
            editedCurve = i;
            editedPoint = j;
          }
        }
      }
      editing = true;
    }
  }

  function handleMouseMove(event) {
    if (isDrawing) {
      if (mode === "freehand") {
        const newPoint = [event.offsetX, event.offsetY];
        currentCurve.push(newPoint);
        currentCurve = currentCurve;
      } else if (mode === "edit") {
        // Drag the closest point to the mouse with the mouse
        if (editing) {
          curves[editedCurve][editedPoint] = [event.offsetX, event.offsetY];
        }
      } else if (mode === "lines") {
        // Update the temporary line
        tempLineStart = [event.offsetX, event.offsetY];
      }
    }
  }

  function handleMouseUp() {
    if (mode === "freehand") {
      // End the current curve in freehand mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        currentCurve.push(currentCurve[0]);
        currentCurve = currentCurve;
      }
      currentCurve = [];
    } else if (mode === "lines") {
    } else if (mode === "edit") {
      editing = false;
    }
  }

  function handleMouseOut() {
    isDrawing = false;
    if (mode === "freehand") {
      // End the current curve in freehand mode
      currentCurve = [];
    } else if (mode === "lines") {
      // Clear the temporary line
      tempLineStart = null;
    } else if (mode === "edit") {
      editing = false;
    }
  }

  function handleDoubleClick() {
    if (mode === "lines" && currentCurve.length > 0) {
      // End the current curve in line mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        currentCurve.push(currentCurve[0]);
        currentCurve = currentCurve;
      }
      currentCurve = [];
      tempLineStart = null;
    }
  }

  function updateCppInitializerList() {
    cppInitializerList =
      "std::vector<std::vector<cadcam::Point2D>> curves = {\n";
    for (let curve of curves) {
      cppInitializerList += "  {";
      for (let point of curve) {
        cppInitializerList += `{${point[0]}, ${point[1]}}`;
        if (point !== curve[curve.length - 1]) {
          cppInitializerList += ", ";
        }
      }
      cppInitializerList += "}";
      if (curve !== curves[curves.length - 1]) {
        cppInitializerList += ",";
      }
      cppInitializerList += "\n";
    }
    cppInitializerList += "};";
  }

  function changeMode(newMode) {
    mode = newMode;
    if (mode === "freehand") {
      // Clear the current curve and start a new one
      currentCurve = [];
    }
  }

  function clear() {
    curves = [];
    currentCurve = [];
    updateCppInitializerList();
    tempLineStart = null;
  }
  async function setClipboard(text) {
    const type = "text/plain";
    const blob = new Blob([text], { type });
    const data = [new ClipboardItem({ [type]: blob })];
    await navigator.clipboard.write(data);
  }

  function perpendicularDistance(point, start, end) {
    let dx = end[0] - start[0];
    let dy = end[1] - start[1];

    if (dx === 0 && dy === 0) {
      // It's a point not a line segment.
      dx = point[0] - start[0];
      dy = point[1] - start[1];
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate the t that minimizes the distance.
    let t =
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
      (dx * dx + dy * dy);

    // See if this represents one of the segment's end points or a point in the middle.
    if (t < 0) {
      dx = point[0] - start[0];
      dy = point[1] - start[1];
    } else if (t > 1) {
      dx = point[0] - end[0];
      dy = point[1] - end[1];
    } else {
      let closestPoint = {
        x: start[0] + t * dx,
        y: start[1] + t * dy,
      };
      dx = point[0] - closestPoint.x;
      dy = point[1] - closestPoint.y;
    }

    return Math.sqrt(dx * dx + dy * dy);
  }

  function douglasPeucker(points, tolerance) {
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (dmax > tolerance) {
      // Recursive call
      const results1 = douglasPeucker(points.slice(0, index + 1), tolerance);
      const results2 = douglasPeucker(points.slice(index), tolerance);

      // Build the result list
      const results = results1.slice(0, -1).concat(results2);
      return results;
    } else {
      return [points[0], points[end]];
    }
  }

  function smoothCurves(tolerance) {
    curves = curves.map((curve) => douglasPeucker(curve, tolerance));
  }

  function copy() {
    setClipboard(cppInitializerList);
  }
  $: updateCppInitializerList();

  onMount(() => {});
</script>

<main>
  <div class="container">
    <div class="canvas-area">
      <Canvas
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseout={handleMouseOut}
        on:dblclick={handleDoubleClick}
      >
        <!-- If tempLineStart exists then draw a line from the end of the current curve -->
        {#if tempLineStart  }
          <Line
            start={tempLineStart}
            end={currentCurve[currentCurve.length - 1]}
          />
        {/if}
        <!-- Draw all polylines in curves -->
        {#each curves as curve}
          <Polyline points={curve} />
        {/each}
      </Canvas>
    </div>
    <div class="textarea-area">
      <textarea readonly value={cppInitializerList} rows="10" cols="50"
      ></textarea>
      <button on:click={() => copy()}>Copy</button>
    </div>
  </div>

  <div class="button-area">
    <button
      on:click={() => changeMode("freehand")}
      class={mode === "freehand" ? "active" : ""}>Freehand</button
    >
    <button
      on:click={() => changeMode("lines")}
      class={mode === "lines" ? "active" : ""}>Lines</button
    >
    <button
      on:click={() => changeMode("edit")}
      class={mode === "edit" ? "active" : ""}>Edit</button
    >
    <button on:click={() => clear()}>Reset</button>
    <button on:click={() => smoothCurves(5)}>Smooth</button>
    <label>
      Close curves
      <input type="checkbox" bind:checked={closeCurves} />
    </label>
  </div>
</main>

<style>
  .container {
    display: flex;
    justify-content: align-self;
  }

  .canvas-area {
    flex: 1;
    margin-right: 10px;
  }

  .textarea-area {
    flex: 1;
  }

  .button-area {
    display: flex;
    justify-content: left;
    margin-top: 10px;
  }

  button {
    padding: 10px;
    margin: 10px;
    background: blue;
  }

  canvas {
    border: 1px solid #000;
    width: 100%; /* Ensure the canvas takes full width */
  }

  textarea {
    width: 100%; /* Ensure the textarea takes full width */
  }

  .active {
    background-color: #ddd; /* Highlight the active button */
  }
</style>
