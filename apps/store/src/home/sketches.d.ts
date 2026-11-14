export type SketchName = 'rose' | 'blossom' | 'cedar' | 'amber' | 'oud';
export type Sketch = (ctx: CanvasRenderingContext2D, width: number, height: number, seconds: number) => void;

export const SKETCHES: Record<SketchName, Sketch>;
/** Light theme: gold and black. Dark theme: the original colours. */
export function setLight(value: boolean): void;
