<script lang="ts">
  import { onMount } from "svelte";
  import type { Point } from "./types";
  import Sketcher from "./lib/Sketcher.svelte";



  let curves: Point[][] = [];

  function updateCppInitializerList(curves: Point[][] ) {
    let cppInitializerList =
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
    return cppInitializerList;
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
