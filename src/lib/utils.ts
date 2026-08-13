import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The element that scales away behind a presented sheet, the way iOS recedes
 * the page behind one. Vaul finds it by its `vaul-drawer-wrapper` attribute;
 * the id is here so the wrapper and the sheet agree on which element it is.
 */
export const SHEET_BACKGROUND_ID = "app-root";
