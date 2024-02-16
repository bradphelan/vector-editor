<script lang="ts">
  import { onMount } from "svelte";
  import type { Point, Curve, Curves } from "./types";
  import Sketcher from "./lib/Sketcher.svelte";

  let curves: Point[][] = [];

  function joinByDelimeter(arr: any[], mapFn: (x: any) => string, delimeter: string) {
    let s = "";
    for (let i = 0; i < arr.length; i++) {
      s += mapFn(arr[i]);
      if (i != arr.length - 1) {
        s += delimeter;
      }
    }
    return s;
  }

  function pointToString(point: Point) {
    if(point==undefined)
    {
      return `{}`;
    }
    return `{${point[0]}, ${point[1]}}`;
  }

  function curveToString(curve: Curve){
    return `{${joinByDelimeter(curve, pointToString, ", ")}}`;
  }

  function curvesToString(curves: Curves){
    return `{${joinByDelimeter(curves, curveToString, ", ")}}`;
  }


  function updateCppInitializerList(curves: Point[][] ) {
    return `std::vector<std::vector<cv::Point>> curves = ${curvesToString(curves)};`;
  }

  $: cppInitializerList =  updateCppInitializerList(curves);

  async function setClipboard(text:string) {
    const type = "text/plain";
    const blob = new Blob([text], { type });
    const data = [new ClipboardItem({ [type]: blob })];
    await navigator.clipboard.write(data);
  }


  function copy() {
    setClipboard(cppInitializerList);
  }


  onMount(() => {});

</script>

<main>
  <div class="container">
    <div class="canvas-area">
      <Sketcher bind:curves={curves}/>
    </div>
    <div class="textarea-area">
      <textarea readonly value={cppInitializerList} rows="10" cols="50"
      ></textarea>
      <button on:click={() => copy()}>Copy</button>
    </div>
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
