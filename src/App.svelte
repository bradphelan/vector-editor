<script>
  import { onMount } from "svelte";

  let canvas;
  let context;
  let isDrawing = false;
  let mode = "freehand"; // Default mode
  let currentCurve = [];
  let curves = [];
  let tempLineStart = null;
  let cppInitializerList = ""; // This will hold the C++ initializer list
  let closeCurves = true;

  function handleMouseDown(event) {
    isDrawing = true;
    const newPoint = [event.offsetX, event.offsetY];
    if (mode === "freehand") {
      // Start a new curve in freehand mode
      currentCurve = [newPoint];
      curves.push(currentCurve);
    } else if (mode === "lines") {
      // Add a point to the current curve or start a new one
      if (currentCurve.length === 0) {
        // Start a new curve
        currentCurve.push(newPoint);
        curves.push(currentCurve);
      } else {
        // Add a point to the current curve
        currentCurve.push(newPoint);
      }
      tempLineStart = newPoint; // Start the temporary line
    }
    redraw();
  }

  function handleMouseMove(event) {
    if (isDrawing) {
      if (mode === "freehand") {
        const newPoint = [event.offsetX, event.offsetY];
        currentCurve.push(newPoint);
        redraw();
      } else if (mode === "lines" && tempLineStart) {
        // Draw a temporary line
        context.clearRect(0, 0, canvas.width, canvas.height);
        redraw();
        context.strokeStyle = "#999"; // Grey color for the temporary line
        context.beginPath();
        context.moveTo(tempLineStart[0], tempLineStart[1]);
        context.lineTo(event.offsetX, event.offsetY);
        context.stroke();
        context.strokeStyle = "#000000"; // Reset color to black
      }
    }
  }

  function handleMouseUp() {
    if (mode === "freehand") {
      // End the current curve in freehand mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        currentCurve.push(currentCurve[0]);
      }
      currentCurve = [];
    } else if (mode === "lines") {
      // Clear the temporary line
      //tempLineStart = null;
    }
    redraw();
  }

  function handleMouseOut() {
    isDrawing = false;
    if (mode === "freehand") {
      // End the current curve in freehand mode
      currentCurve = [];
    } else if (mode === "lines") {
      // Clear the temporary line
      tempLineStart = null;
    }
    redraw();
  }

  function handleDoubleClick() {
    if (mode === "lines" && currentCurve.length > 0) {
      // End the current curve in line mode
      isDrawing = false;
      if (closeCurves && currentCurve.length > 1) {
        currentCurve.push(currentCurve[0]);
      }
      currentCurve = [];
      redraw();
    }
  }

  function redraw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let curve of curves) {
      if (curve.length > 0) {
        context.beginPath();
        context.moveTo(curve[0][0], curve[0][1]);
        for (let i = 1; i < curve.length; i++) {
          context.lineTo(curve[i][0], curve[i][1]);
        }
        context.stroke();
      }
    }
    // Draw the current curve
    if (currentCurve.length > 1) {
      context.beginPath();
      context.moveTo(currentCurve[0][0], currentCurve[0][1]);
      for (let i = 1; i < currentCurve.length; i++) {
        context.lineTo(currentCurve[i][0], currentCurve[i][1]);
      }
      context.stroke();
    }
    updateCppInitializerList(); // Update the C++ initializer list
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
    redraw();
  }

  function clear() {
    curves = [];
    currentCurve = [];
    updateCppInitializerList();
    redraw();
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
    redraw();
  }

  function copy() {
    setClipboard(cppInitializerList);
  }

  onMount(() => {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    // Set the display size (scaled for device's pixel ratio)
    const scale = window.devicePixelRatio;
    canvas.width = Math.floor(800 * scale); // Set the width to 300px scaled
    canvas.height = Math.floor(600 * scale); // Set the height to 300px scaled
    canvas.style.width = "800px"; // Set the CSS width to 300px
    canvas.style.height = "600px"; // Set the CSS height to 300px

    // Scale the drawing context
    context.scale(scale, scale);

    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    redraw();
  });
</script>

<div class="container">
  <div class="canvas-area">
    <canvas
      id="canvas"
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseout={handleMouseOut}
      on:dblclick={handleDoubleClick}
    ></canvas>
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
  <button on:click={() => clear()}>Reset</button>
  <button on:click={() => smoothCurves(5)}>Smooth</button>
  <label>
    Close curves
    <input type="checkbox" bind:checked={closeCurves} />
  </label>
</div>

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