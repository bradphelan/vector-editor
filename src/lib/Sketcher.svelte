<script lang="ts">
  import Canvas from "./Canvas.svelte";
  import Line from "./Line.svelte";
  import Polyline from "./Polyline.svelte";
  import type { Point, Curve, Curves } from "../types";
  import { douglasPeucker } from "../utils";

  type Mode = "freehand" | "lines" | "edit";

  let isDrawing = false;
  let mode: Mode = "freehand"; // Default mode
  let currentCurve: Curve  = [];
  export let curves: Curves = [];
  let tempLineStart: Point | null = null;
  let closeCurves = true;

  type PointIndex = {
    curve: number;
    point: number;
  } 
  
  let editedPoint : PointIndex|undefined = undefined;

  function push_point(point: Point) {
    currentCurve.push(point);
    currentCurve = currentCurve;
    curves = curves;
  }

  function new_curve() {
    currentCurve = [];
    curves.push(currentCurve);
    curves = curves;
  }

  function changeMode(newMode: Mode) {
    mode = newMode;
    if (mode === "freehand") {
      // Clear the current curve and start a new one
      currentCurve = [];
    }
  }

  function clear() {
    curves = [];
    currentCurve = [];
    tempLineStart = null;
  }

  function smoothCurves(tolerance: number) {
    curves = curves.map((curve) => douglasPeucker(curve, tolerance));
  }

  function handleMouseDown(event: MouseEvent) {
    isDrawing = true;
    const newPoint: Point = [event.offsetX, event.offsetY];
    if (mode === "freehand") {
      // Start a new curve in freehand mode
      new_curve();
      push_point(newPoint);
    } else if (mode === "lines") {
      // Add a point to the current curve or start a new one
      if (currentCurve.length === 0) {
        // Start a new curve
        new_curve();
        push_point(newPoint);
      } else {
        // Add a point to the current curve
        push_point(newPoint);
      }
      tempLineStart = newPoint; // Start the temporary line
    } else if (mode === "edit") {
      // Find the closest point to the mouse and drag it
      editedPoint = GetEditedPoint(event);
    }
  }

  function GetEditedPoint(event: MouseEvent) : PointIndex | undefined {
    let minDistance = Infinity;
    let editedCurve = undefined;
    let editedPoint = undefined;
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
    if(editedCurve&&editedPoint)
        return {curve: editedCurve, point:editedPoint};
    return undefined;
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDrawing) {
      if (mode === "freehand") {
        const newPoint: Point = [event.offsetX, event.offsetY];
        push_point(newPoint);
      } else if (mode === "edit") {
        // Drag the closest point to the mouse with the mouse
        if (editedPoint) {
          curves[editedPoint.curve][editedPoint.point] = [event.offsetX, event.offsetY];
        }
      } else if (mode === "lines") {
        // Update the temporary line
        tempLineStart = [event.offsetX, event.offsetY];
      }
    }
  }

  function handleMouseUp(event: MouseEvent) {
    if (mode === "freehand") {
      // End the current curve in freehand mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        push_point(currentCurve[0]);
      }
      currentCurve = [];
    } else if (mode === "edit") {
      editedPoint = undefined
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
      editedPoint = undefined;
    }
  }

  function handleDoubleClick() {
    if (mode === "lines" && currentCurve.length > 0) {
      // End the current curve in line mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        push_point(currentCurve[0]);
      }
      currentCurve = [];
      tempLineStart = null;
    }
  }
</script>

<Canvas
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseout={handleMouseOut}
  on:dblclick={handleDoubleClick}
>
  <!-- If tempLineStart exists then draw a line from the end of the current curve -->
  {#if tempLineStart}
    <Line start={tempLineStart} end={currentCurve[currentCurve.length - 1]} />
  {/if}
  <!-- Draw all polylines in curves -->
  {#each curves as curve}
    <Polyline points={curve} />
  {/each}
</Canvas>

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
