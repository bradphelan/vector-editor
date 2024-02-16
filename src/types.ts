// src/types.ts
export type Point = [number, number];
export type Curve = Point[];
export type Segment = [Point, Point];
export type Curves = Curve[];
export type DrawFn = (ctx: CanvasRenderingContext2D) => void;
export type CanvasContext = {
  addDrawFn: (fn: DrawFn) => void;
  removeDrawFn: (fn: DrawFn) => void;
};
