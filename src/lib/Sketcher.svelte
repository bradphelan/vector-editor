<script lang="ts">
  import Canvas from "./Canvas.svelte";
  import Line from "./Line.svelte";
  import Polyline from "./Polyline.svelte";
  import type { Point, Curve, Curves } from "../types";
  import { douglasPeucker } from "../utils";
  import type { Action } from "svelte/action";
  import { produce } from "immer";

  type Mode = "freehand" | "lines" | "edit";
  type Action =
    | "mousedown"
    | "mousemove"
    | "mouseup"
    | "mouseout"
    | "mousedblclick";

  let mode: Mode = "freehand"; // Default mode
  let closeCurves: boolean = true;

  type PointIndex = {
    curve: number;
    point: number;
  };

  let editedPoint: PointIndex | undefined = undefined;

  type State = {
    curves: Curves;
    drawing: boolean;
    tempLineStart: Point | null;
  };

  let state = {
    curves: [] as Curves,
    drawing: false,
    tempLineStart: null as Point | null,
  };

  export let curves: Curves;

  $: curves = state.curves;


  function last_curve(state: State) {
    let l0 = state.curves.length;
    if(l0==0)
    {
      return undefined;
    }
    return state.curves[l0 - 1];
  }

  function last_point(state: State) {
    let lc = last_curve(state);
    let l = lc?.length ?? 0;
    if(!lc || l==0)
    {
      return undefined;
    }
    return lc[l - 1];
  }

  function areDeeplyEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
  
      if(obj1.length !== obj2.length) return false;
      
      return obj1.every((elem, index) => {
        return areDeeplyEqual(elem, obj2[index]);
      })
  
  }
  
  return false; 
}

  function push_point(point: Point, state: State): State {
    return produce(state, (draft) => {
      if (draft.curves.length == 0) draft.curves.push([]);
     // if (!areDeeplyEqual(point,last_point(state)))
        draft.curves[draft.curves.length - 1].push(point);
    });
  }

  function pop_point(state: State): State {
    return produce(state, (draft) => {
      if (draft.curves.length > 0) draft.curves[draft.curves.length - 1].pop();
    });
  }

  function new_curve(state: State) {
    return produce(state, (draft) => {
      if ((last_curve(draft)?.length ?? 0) > 0) draft.curves.push([]);
    });
  }

  function pop_curve(state: State) {
    return produce(state, (draft) => {
      draft.curves.pop();
    });
  }

  function startDrawing(state: State) {
    return produce(state, (draft) => {
      draft.drawing = true;
    });
  }

  function stopDrawing(state: State) {
    return produce(state, (draft) => {
      draft.drawing = false;
    });
  }

  function changeMode(newMode: Mode) {
    mode = newMode;
    state = new_curve(state);
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
    return produce(state, (draft) => {
      draft.curves = [];
      draft.tempLineStart = null;
      draft.drawing = false;
    });
  }

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
    if (editedCurve && editedPoint)
      return { curve: editedCurve, point: editedPoint };
    return undefined;
  }

  function smoothCurves(tolerance: number, state: State): State {
    return produce(state, (draft) => {
      draft.curves = draft.curves.map((curve) =>
        douglasPeucker(curve, tolerance)
      );
    });
  }

  const reduce = (
    action: Action,
    mode: Mode,
    state: State,
    event: MouseEvent
  ) => {
    if (action === "mouseout") {
      state = stopDrawing(finish_curve(state));
      return state;
    }

    let newPoint: Point = [event.offsetX, event.offsetY];
    if (mode === "freehand") {
      if (action === "mousedown") {
        state = startDrawing(push_point(newPoint, new_curve(state)));
      } else if (action === "mouseup") {
        if (state.drawing) {
          state = stopDrawing(finish_curve(state));
        }
      } else if (action === "mousemove") {
        if (state.drawing) state = push_point(newPoint, state);
      }
    } else if (mode === "lines") {
      if (action === "mousedown" && !state.drawing) {
        state = startDrawing(push_point(newPoint, new_curve(state)));
      } else if (action === "mouseup") {
        state = push_point(newPoint, state);
      } else if (action === "mousemove") {
        if (state.drawing) {
          state = pop_point(state);
          state = push_point(newPoint, state);
        }
      } else if (action === "mousedblclick") {
        state = stopDrawing(finish_curve(state));
      }
    } else if (mode === "edit") {
      if (action === "mousedown") {
        editedPoint = GetEditedPoint(event);
      } else if (action === "mouseup") {
        editedPoint = undefined;
      } else if (action === "mousemove") {
        if (editedPoint) {
          state = produce(state, (draft) => {
            if (editedPoint != undefined)
              draft.curves[editedPoint.curve][editedPoint.point] = [
                event.offsetX,
                event.offsetY,
              ];
          });
        }
      }
    }

    return state;
  };

  function handleMouseDown(event: MouseEvent) {
    state = reduce("mousedown", mode, state, event);
  }

  function handleMouseMove(event: MouseEvent) {
    state = reduce("mousemove", mode, state, event);
  }

  function handleMouseUp(event: MouseEvent) {
    state = reduce("mouseup", mode, state, event);
  }

  function handleMouseOut(event: any) {
    state = reduce("mouseout", mode, state, event);
  }

  function handleDoubleClick(event: MouseEvent) {
    state = reduce("mousedblclick", mode, state, event);
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
  {#each state.curves as curve}
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
  <button on:click={() => (state = clear(state))}>Reset</button>
  <button on:click={() => (state = smoothCurves(5, state))}>Smooth</button>
  <label>
    Close curves
    <input type="checkbox" bind:checked={closeCurves} />
  </label>
</div>
