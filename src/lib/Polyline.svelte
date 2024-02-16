<script lang="ts">
    import { getContext, onDestroy, onMount } from "svelte";
    import type { Point, CanvasContext } from "../types";

    // declare a prop points of type array of Point
    export let points: Point[] = [];

    let canvasContext = getContext("canvas") as CanvasContext;

    onMount(() => {
        canvasContext.addDrawFn(draw);
    });

    onDestroy(() => {
        canvasContext.removeDrawFn(draw);
    });

    function draw(ctx: CanvasRenderingContext2D) {
        // draw the points
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point[0], point[1]);
            } else {
                ctx.lineTo(point[0], point[1]);
            }
        });
        ctx.stroke();
    }
</script>
  
