/**
 * Touch utilities for mobile/tablet support.
 *
 * Key pattern: touch events fire on the ORIGINAL target, not the element
 * under the finger. Use `elementAtTouch()` with `document.elementFromPoint()`
 * for drag-across behaviors (grid painting, automation lane drawing).
 */

/** Get the element under a touch point matching a CSS selector. */
export function elementAtTouch(touch: Touch, selector: string): HTMLElement | null {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return el?.closest(selector) as HTMLElement | null;
}

/** Check if the primary pointer is coarse (touch device). */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
