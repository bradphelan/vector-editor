
  import type { Point, Curve } from './types';

  export function perpendicularDistance(point: Point, start: Point, end: Point) {
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

  export function douglasPeucker(points: Curve, tolerance: number): Curve {
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