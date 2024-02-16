<script lang="ts">
  import Canvas from "./Canvas.svelte";
  import Line from "./Line.svelte";
  import Polyline from "./Polyline.svelte";
  import type { Point, Curve, Curves, Segment } from "../types";
  import { areDeeplyEqual, douglasPeucker } from "../utils";
  import { produce } from "immer";

  type Action =
    | "mousedown"
    | "mousemove"
    | "mouseup"
    | "mouseout"
    | "mouseclick"
    | "mousedblclick";

  /// Whether to close the curves
  let closeCurves: boolean = true;

  type PointIndex = {
    curve: number;
    point: number;
  };

  let editedPoint: PointIndex | undefined = undefined;

  type Mode = "freehand" | "lines" | "edit";

  /// State object for when the user is editing the curves
  interface EditState {
    kind: "edit";
    curves: Curves;
    drawing: boolean;
    editedPoint: PointIndex | undefined;
  }
  let defaultEditState: EditState = {
    kind: "edit",
    curves: [],
    drawing: false,
    editedPoint: undefined,
  };

  /// State object for when the user is drawing freehand curves
  interface FreehandState {
    kind: "freehand";
    curves: Curves;
    drawing: boolean;
  }
  let defaultFreehandState: FreehandState = {
    kind: "freehand",
    curves: [],
    drawing: false,
  };

  /// State object for when the user is drawing line segments
  interface LinesState {
    kind: "lines";
    curves: Curves;
    drawing: boolean;
    segment: Segment | undefined;
  }
  let defaultLinesState: LinesState = {
    kind: "lines",
    curves: [],
    drawing: false,
    segment: undefined,
  };

  /// Factory function to create a default state for a given mode
  function defaultState(mode: Mode): State {
    if (mode == "edit") return defaultEditState;
    if (mode == "lines") return defaultLinesState;
    if (mode == "freehand") return defaultFreehandState;
    throw new Error("Invalid mode");
  }

  /// Union type for the state of the sketcher
  type State = EditState | FreehandState | LinesState;

  /// Set the default state of the sketcher
  let state: State = defaultState("freehand");

  /// Export curves from the component so the parent can access them
  export let curves: Curves;
  $: curves = state.curves;

  /// Return the last curve in the state or undefined
  function last_curve(state: State): Curve | undefined {
    let l0 = state.curves.length;
    if (l0 == 0) {
      return undefined;
    }
    return state.curves[l0 - 1];
  }

  /// Return the last point in the last curve or undefined
  function last_point(state: State): Point | undefined {
    let lc = last_curve(state);
    let l = lc?.length ?? 0;
    if (!lc || l == 0) {
      return undefined;
    }
    return lc[l - 1];
  }

  /// Push a new point onto the last curve or create a new curve if there are no curves
  function push_point(point: Point, state: State): State {
    return produce(state, (draft) => {
      if (draft.curves.length == 0) draft.curves.push([]);
      if (!areDeeplyEqual(point, last_point(state)))
        draft.curves[draft.curves.length - 1].push(point);
    });
  }

  /// Pop a point from the last curve
  function pop_point(state: State): State {
    return produce(state, (draft) => {
      if (draft.curves.length > 0) draft.curves[draft.curves.length - 1].pop();
    });
  }

  /// Push a new curve onto the state
  function new_curve(state: State): State {
    return produce(state, (draft) => {
      if ((last_curve(draft)?.length ?? 0) > 0) draft.curves.push([]);
    });
  }

  /// Pop the last curve from the state
  function pop_curve(state: State): State {
    return produce(state, (draft) => {
      draft.curves.pop();
    });
  }

  /// Mark the state as drawing a curve
  function startDrawing(state: State) {
    return produce(state, (draft) => {
      draft.drawing = true;
    });
  }

  /// Mark the state as not drawing a curve
  function stopDrawing(state: State): State {
    return produce(state, (draft) => {
      draft.drawing = false;
    });
  }

  /// Change the mode and switch state types
  function changeMode(newMode: Mode) {
    state = produce(defaultState(newMode), (draft) => {
      draft.curves = state.curves;
    });
  }

  function finish_curve(state: State) {
    return produce(state, (draft) => {
      if (draft.curves.length == 0) return;
      if (closeCurves) {
        let currentCurve = draft.curves[draft.curves.length - 1];
        currentCurve.push(currentCurve[0]);
      }
    });
  }

  function clear(state: State) {
    return defaultState(state.kind);
  }

  /// Return the index of the point closest to the mouse
  function GetEditedPoint(event: MouseEvent): PointIndex | undefined {
    let minDistance = Infinity;
    let editedCurve = undefined;
    let editedPoint = undefined;
    for (let i = 0; i < state.curves.length; i++) {
      for (let j = 0; j < state.curves[i].length; j++) {
        const distance = Math.sqrt(
          (state.curves[i][j][0] - event.offsetX) ** 2 +
            (state.curves[i][j][1] - event.offsetY) ** 2
        );
        if (distance < minDistance) {
          minDistance = distance;
          editedCurve = i;
          editedPoint = j;
        }
      }
    }
    if (editedCurve != undefined && editedPoint != undefined)
      return { curve: editedCurve, point: editedPoint };
    return undefined;
  }

  /// Smooth the curves using the Douglas-Peucker algorithm
  function smoothCurves(tolerance: number, state: State): State {
    return produce(state, (draft) => {
      draft.curves = draft.curves.map((curve) =>
        douglasPeucker(curve, tolerance)
      );
    });
  }

  /// Create a segment between the last point in the last curve and the new point
  function create_segment(state: LinesState, newPoint: Point): LinesState {
    return produce(state, (draft) => {
      if (draft.curves.length > 0) {
        let currentCurve = draft.curves[draft.curves.length - 1];
        if (currentCurve.length > 0) {
          draft.segment = [currentCurve[currentCurve.length - 1], newPoint];
        }
      }
    });
  }

  /// Delete the last curve
  function undo(arg0: number, state: State): State {
    state = stopDrawing(state);
    return produce(state, (draft) => {
      if (draft.curves.length > 0) {
        draft.curves.pop();
      }
    });
  }

  /// Action management for editing mode
  function reduceEdit(
    action: string,
    state: EditState,
    event: MouseEvent
  ): State {
    if (action === "mousedown") {
      editedPoint = GetEditedPoint(event);
    } else if (action === "mouseup") {
      editedPoint = undefined;
    } else if (action === "mousemove") {
      if (editedPoint) {
        state = produce(state, (draft) => {
          if (editedPoint != undefined) {
            let curve = draft.curves[editedPoint.curve];
            curve[editedPoint.point] = [event.offsetX, event.offsetY];
            if (
              editedPoint.point == 0 ||
              editedPoint.point == curve.length - 1
            ) {
              let i = curve.length - editedPoint.point - 1;
              curve[i] = [event.offsetX, event.offsetY];
            }
          }
        });
      }
    }
    return state;
  }

  /// Action management for line drawing mode
  function reduceLines(
    action: string,
    state: LinesState,
    event: MouseEvent
  ): State {
    let newPoint: Point = [event.offsetX, event.offsetY];
    let timer;
    if (action === "mouseclick") {
      if (!state.drawing)
        return startDrawing(push_point(newPoint, new_curve(state)));
      else return push_point(newPoint, state);
    } else if (action === "mousemove") {
      return state.drawing ? create_segment(state, newPoint) : state;
    } else if (action === "mousedblclick") {
      return stopDrawing(finish_curve(state));
    }
    return state;
  }

  /// Action management for freehand drawing mode
  function reduceFreehand(
    action: string,
    state: State,
    event: MouseEvent
  ): State {
    let newPoint: Point = [event.offsetX, event.offsetY];
    if (action === "mousedown") {
      return startDrawing(push_point(newPoint, new_curve(state)));
    } else if (action === "mouseup") {
      return state.drawing ? stopDrawing(finish_curve(state)) : state;
    } else if (action === "mousemove") {
      return state.drawing ? push_point(newPoint, state) : state;
    }
    return state;
  }

  function handleEvent(action: Action) {
    return (event: MouseEvent | any) => {
      if (state.kind === "freehand") {
        state = reduceFreehand(action, state, event);
      } else if (state.kind === "lines") {
        state = reduceLines(action, state, event);
      } else if (state.kind === "edit") {
        state = reduceEdit(action, state, event);
      }
      return state;
    };
  }
</script>

<Canvas
  on:mousedown={handleEvent("mousedown")}
  on:mousemove={handleEvent("mousemove")}
  on:mouseup={handleEvent("mouseup")}
  on:mouseout={handleEvent("mouseout")}
  on:dblclick={handleEvent("mousedblclick")}
  on:click={handleEvent("mouseclick")}
>
  <!-- If tempLineStart exists then draw a line from the end of the current curve -->
  {#each state.curves as curve}
    <Polyline points={curve} />
  {/each}
  {#if state.kind == "lines" && state.segment != undefined}
    <Line start={state.segment[0]} end={state.segment[1]} />
  {/if}
</Canvas>

<div class="button-area">
  <button
    on:click={() => changeMode("freehand")}
    class={state.kind === "freehand" ? "active" : ""}>Freehand</button
  >
  <button
    on:click={() => changeMode("lines")}
    class={state.kind === "lines" ? "active" : ""}>Lines</button
  >
  <button
    on:click={() => changeMode("edit")}
    class={state.kind === "edit" ? "active" : ""}>Edit</button
  >
  <button on:click={() => (state = clear(state))}>Reset</button>
  <button on:click={() => (state = smoothCurves(5, state))}>Smooth</button>
  <button on:click={() => (state = undo(5, state))}>Undo</button>
  <label>
    Close curves
    <input type="checkbox" bind:checked={closeCurves} />
  </label>
</div>
