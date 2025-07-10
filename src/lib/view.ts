import { writable, get, derived } from 'svelte/store';

// Define Point2D locally since it's not exported from types.ts
type Point2D = { x: number; y: number };

// Constants for the coordinate system
export const WORLD_ORIGIN: Point2D = { x: 0, y: 0 }; // Origin point in world coordinates
export const DEFAULT_ZOOM = 1.0;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

export interface View {
	x: number; // pan offset x
	y: number; // pan offset y
	zoom: number;
}

export const view = writable<View>({
	x: 0,
	y: 0,
	zoom: DEFAULT_ZOOM
});

// Function to calculate viewport bounds based on current view and canvas dimensions
export function getViewportBounds(width: number, height: number) {
    const { x, y, zoom } = get(view);
    
    if (width === 0 || height === 0) return null;
    
    const topLeft = viewToWorld({ x: 0, y: 0 }, width, height);
    const bottomRight = viewToWorld({ x: width, y: height }, width, height);
    
    return {
        minX: topLeft.x,
        minY: bottomRight.y,
        maxX: bottomRight.x,
        maxY: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: topLeft.y - bottomRight.y
    };
};

/**
 * Apply the current view transform to a canvas context
 * This should be called before any drawing operations
 */
export function applyTransform(ctx: CanvasRenderingContext2D, width: number, height: number) {
	const { x, y, zoom } = get(view);
	// Set the transform for drawing: scale by zoom and flip Y-axis
	// The x and y values are the pan offsets in screen coordinates
	ctx.setTransform(zoom, 0, 0, -zoom, x, height - y);
}

/**
 * Reset the transform to identity (useful after drawing is complete)
 */
export function resetTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Convert a point from view/screen coordinates to world coordinates
 */
export function viewToWorld(p: Point2D, width: number, height: number): Point2D {
	const { x, y, zoom } = get(view);
	// Convert from screen coordinates to world coordinates
	// First translate to origin by subtracting the pan offset
	// Then scale by 1/zoom to get world coordinates
	// Also flip Y axis since world Y is up but screen Y is down
	return {
		x: (p.x - x) / zoom,
		y: (height - p.y - y) / zoom
	};
}

/**
 * Convert a point from world coordinates to view/screen coordinates
 */
export function worldToView(p: Point2D, width: number, height: number): Point2D {
	const { x, y, zoom } = get(view);
	// Convert from world coordinates to screen coordinates
	// First scale by zoom
	// Then translate by pan offset
	// Also flip Y axis since world Y is up but screen Y is down
	return {
		x: p.x * zoom + x,
		y: height - (p.y * zoom + y)
	};
}

/**
 * Pan the view by a specified amount in screen coordinates
 * dx and dy are in screen pixel units
 */
export function panView(dx: number, dy: number) {
    // Apply a scale factor of 0.5 to slow down the panning by half
    // This makes the panning feel more natural and less exaggerated
    const scaleFactor = 0.5;
    const scaledDx = dx * scaleFactor;
    const scaledDy = dy * scaleFactor;
    
    view.update(v => ({
        ...v,
        x: v.x + scaledDx,
        y: v.y - scaledDy  // Invert Y direction for natural panning (dragging up moves view up)
    }));
}

/**
 * Zoom the view centered around a specific point in screen coordinates
 */
export function zoomViewAt(factor: number, center: Point2D, width: number, height: number) {
    // First convert the screen point to world coordinates
    const worldCenter = viewToWorld(center, width, height);
    
    view.update(v => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
        
        // Calculate new pan offset to keep the point under cursor at the same position
        // We need to ensure that after zooming, worldCenter maps back to the same screen position (center)
        
        // Calculate where the world center point would appear with the new zoom level
        const newScreenCenter = {
            x: worldCenter.x * newZoom + v.x,
            y: height - (worldCenter.y * newZoom + v.y)
        };
        
        // Calculate the required pan offset to keep the point centered under the cursor
        const newX = v.x + (center.x - newScreenCenter.x);
        const newY = v.y + (center.y - newScreenCenter.y);
        
        return {
            x: newX,
            y: newY,
            zoom: newZoom
        };
    });
}

/**
 * Reset the view to default
 */
export function resetView() {
    view.set({
        x: 0,
        y: 0,
        zoom: DEFAULT_ZOOM
    });
}

/**
 * Get the current grid cell size in world units based on zoom level
 * This ensures the grid adapts to the zoom level
 */
export function getGridCellSize(): number {
    const { zoom } = get(view);
    
    // Base grid cell size (adjust as needed)
    const baseSize = 10;
    
    // Adaptive grid based on zoom
    if (zoom <= 0.2) return baseSize * 10;
    if (zoom <= 0.5) return baseSize * 5;
    if (zoom <= 1.0) return baseSize * 2;
    if (zoom <= 3.0) return baseSize;
    if (zoom <= 6.0) return baseSize / 2;
    return baseSize / 5;
}
