import React, { ElementRef, useRef, useState, useCallback } from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import cx from "classnames";

const MAX_OVERFLOW = 50;

export interface SliderProps {
  value: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  "aria-label"?: string;
  showThumb?: boolean; // Note: thumb is always hidden, this prop is kept for compatibility
  variant?: "default" | "flat";
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  label?: string;
}

// Scale animation configuration
// Adjust these values to customize the hover/touch scale behavior:
//
// BASIC SCALING:
// - scaleFactor: How much to scale the whole slider (1.0 = no scale, 1.2 = 20% larger, 1.5 = 50% larger)
// - scaleEvenly: If true, scales uniformly in all directions
//
// DIRECTIONAL SCALING (only when scaleEvenly = false):
// - scaleX: Whether to scale horizontally (true/false)
// - scaleY: Whether to scale vertically (true/false)
//
// HEIGHT SCALING (the track height animation):
// - enableHeightScaling: Whether the track height should grow on interaction
// - heightScaleFactor: Multiplier for track height (e.g., 2.4 means 12px when base is 5px)
//
// EXAMPLES:
// Subtle even scaling: { scaleFactor: 1.1, scaleEvenly: true }
// Horizontal only: { scaleFactor: 1.3, scaleEvenly: false, scaleX: true, scaleY: false }
// Vertical only: { scaleFactor: 1.4, scaleEvenly: false, scaleX: false, scaleY: true }
// No height change: { scaleFactor: 1.2, enableHeightScaling: false }
// Dramatic scaling: { scaleFactor: 1.5, heightScaleFactor: 3.0 }
// Minimal scaling: { scaleFactor: 1.05, heightScaleFactor: 1.5 }
//
// QUICK TWEAKS:
// → Want bigger scaling? Change line 55: scaleFactor: 1.3 (or higher)
// → Want smaller scaling? Change line 55: scaleFactor: 1.1 (or lower)
// → Want no scaling? Change line 55: scaleFactor: 1.0
// → Want horizontal stretch only? Change line 56: scaleEvenly: false, line 57: scaleX: true, line 58: scaleY: false
// → Want no height animation? Change line 59: enableHeightScaling: false
const SCALE_CONFIG = {
  scaleFactor: 1.1, // Overall scale multiplier
  scaleEvenly: false, // Set to false for directional scaling
  scaleX: false, // Horizontal scaling (when scaleEvenly = false)
  scaleY: true, // Vertical scaling (when scaleEvenly = false)
  enableHeightScaling: true, // Whether track height should animate
  heightScaleFactor: 2.0, // Track height multiplier (12px / 5px = 2.4)
};

// Sigmoid-based decay function
function decay(value: number, max: number) {
  if (max === 0) {
    return 0;
  }

  let entry = value / max;
  let sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);

  return sigmoid * max;
}

export function Slider({
  value,
  onChange,
  onChangeEnd,
  minValue = 0,
  maxValue = 100,
  "aria-label": ariaLabel,
  showThumb = false,
  variant = "default",
  onMouseDown,
  onMouseUp,
  label,
}: SliderProps) {
  let ref = useRef<ElementRef<typeof RadixSlider.Root>>(null);
  let [region, setRegion] = useState("middle");
  let clientX = useMotionValue(0);
  let overflow = useMotionValue(0);
  let scale = useMotionValue(1);

  const updateOverflow = useCallback(
    (latest: number) => {
      if (ref.current) {
        let { left, right } = ref.current.getBoundingClientRect();
        let newValue;

        if (latest < left) {
          setRegion("left");
          newValue = left - latest;
        } else if (latest > right) {
          setRegion("right");
          newValue = latest - right;
        } else {
          setRegion("middle");
          newValue = 0;
        }

        overflow.set(decay(newValue, MAX_OVERFLOW));
      }
    },
    [overflow],
  );

  const handleValueChange = (values: number[]) => {
    onChange?.(values[0]);
  };

  const handleValueCommit = (values: number[]) => {
    onChangeEnd?.(values[0]);
  };

  return (
    <div className="flex w-full flex-col">
      {label && (
        <div className="label-container flex justify-between">
          <label>{label}</label>
          <output>{value}</output>
        </div>
      )}

      <motion.div
        onHoverStart={() => animate(scale, SCALE_CONFIG.scaleFactor)}
        onHoverEnd={() => animate(scale, 1)}
        onTouchStart={() => animate(scale, SCALE_CONFIG.scaleFactor)}
        onTouchEnd={() => animate(scale, 1)}
        style={{
          ...(SCALE_CONFIG.scaleEvenly
            ? { scale }
            : {
                scaleX: SCALE_CONFIG.scaleX ? scale : 1,
                scaleY: SCALE_CONFIG.scaleY ? scale : 1,
              }),
          opacity: useTransform(
            scale,
            [1, SCALE_CONFIG.scaleFactor],
            [variant === "flat" ? 1 : 0.7, 1],
          ),
        }}
        className="flex w-full touch-none select-none items-center justify-center"
      >
        <RadixSlider.Root
          ref={ref}
          value={[value]}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          min={minValue}
          max={maxValue}
          step={0.01}
          aria-label={ariaLabel}
          className="relative flex w-full grow cursor-grab touch-none select-none items-center py-4 active:cursor-grabbing"
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.buttons > 0) {
              clientX.set(e.clientX);
              updateOverflow(e.clientX);
            }
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onMouseDown?.();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onMouseUp?.();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onLostPointerCapture={() => {
            animate(overflow, 0, { type: "spring", bounce: 0.5 });
          }}
        >
          <motion.div
            style={{
              scaleX: useTransform(overflow, (val) => {
                if (ref.current) {
                  let { width } = ref.current.getBoundingClientRect();
                  return 1 + val / width;
                }
                return 1;
              }),
              scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
              transformOrigin: useTransform(clientX, (val) => {
                if (ref.current) {
                  let { left, width } = ref.current.getBoundingClientRect();
                  return val < left + width / 2 ? "right" : "left";
                }
                return "center";
              }),
              ...(SCALE_CONFIG.enableHeightScaling
                ? {
                    height: useTransform(
                      scale,
                      [1, SCALE_CONFIG.scaleFactor],
                      [5, 5 * SCALE_CONFIG.heightScaleFactor],
                    ),
                    marginTop: useTransform(
                      scale,
                      [1, SCALE_CONFIG.scaleFactor],
                      [0, -(5 * SCALE_CONFIG.heightScaleFactor - 5) / 2],
                    ),
                    marginBottom: useTransform(
                      scale,
                      [1, SCALE_CONFIG.scaleFactor],
                      [0, -(5 * SCALE_CONFIG.heightScaleFactor - 5) / 2],
                    ),
                  }
                : {}),
            }}
            className="flex w-full grow"
          >
            <RadixSlider.Track
              className={cx(
                "relative isolate h-full w-full grow overflow-hidden rounded-full",
                variant === "default" && "bg-gray-300",
                variant === "flat" && "bg-white/50",
              )}
            >
              <RadixSlider.Range
                className={cx(
                  "absolute h-full rounded-full",
                  variant === "default" && "bg-gray-500 group-hover:bg-accent",
                  variant === "flat" && "bg-white",
                )}
              />
            </RadixSlider.Track>
          </motion.div>
          <RadixSlider.Thumb
            className="opacity-0 pointer-events-none" // Always hidden - no visible thumb
          />
        </RadixSlider.Root>
      </motion.div>
    </div>
  );
}
