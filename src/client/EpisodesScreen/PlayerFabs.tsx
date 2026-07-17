import React from "react";
import create from "zustand";
import cx from "classnames";
import { motion } from "framer-motion";
import { IconBroadcast, IconShuffle } from "../components/Icons";

/**
 * The floating radio/shuffle actions: a FAB cluster (all screen sizes)
 * where "on air" swaps which control gets the expanded treatment.
 * Several visual variants are in trial — flip through them with the
 * floating style switcher (persisted per device). Once one wins, the
 * others and the switcher go away.
 */

export type FabVariant = "swap" | "compact" | "cluster";
const FAB_VARIANTS: FabVariant[] = ["swap", "compact", "cluster"];
const FAB_VARIANT_LABELS: Record<FabVariant, string> = {
  swap: "Swap",
  compact: "Compact",
  cluster: "Cluster",
};

type FabVariantStore = {
  variant: FabVariant;
  cycle: () => void;
  loadPersisted: () => void;
};

export const useFabVariantStore = create<FabVariantStore>((set, get) => ({
  variant: "swap",
  cycle() {
    const idx = FAB_VARIANTS.indexOf(get().variant);
    const next = FAB_VARIANTS[(idx + 1) % FAB_VARIANTS.length];
    set({ variant: next });
    localStorage.setItem("radioFabVariant", next);
  },
  loadPersisted() {
    const persisted = localStorage.getItem("radioFabVariant");
    if (persisted && FAB_VARIANTS.includes(persisted as FabVariant)) {
      set({ variant: persisted as FabVariant });
    }
  },
}));

export function FabVariantSwitcher() {
  const variant = useFabVariantStore((s) => s.variant);
  const cycle = useFabVariantStore((s) => s.cycle);
  const idx = FAB_VARIANTS.indexOf(variant);
  return (
    <button
      onClick={cycle}
      className={cx(
        "rounded-full bg-gray-900/80 px-3 py-1.5",
        "text-xs font-semibold text-white",
        "shadow-md focus:outline-none",
      )}
    >
      Style: {FAB_VARIANT_LABELS[variant]} ({idx + 1}/{FAB_VARIANTS.length})
    </button>
  );
}

const invertedStyle =
  "border border-accent/30 bg-white text-accent hover:bg-gray-50";
const filledStyle = "bg-accent text-white hover:bg-accent/90";
const fabBase =
  "flex items-center justify-center font-semibold transition-colors rounded-full shadow-md focus:outline-none";
const spring = { type: "spring", bounce: 0.18, duration: 0.45 } as const;

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cx("relative flex h-3 w-3", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
      <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
    </span>
  );
}

type FabActionProps = {
  on: boolean;
  onRadioClick: () => void;
  onShuffleClick: () => void;
};

export function PlayerFabs(props: FabActionProps) {
  const variant = useFabVariantStore((s) => s.variant);
  switch (variant) {
    case "swap":
      return <SwapFabs {...props} />;
    case "compact":
      return <CompactFabs {...props} />;
    case "cluster":
      return <ClusterFabs {...props} />;
  }
}

/**
 * Variant 1 — Swap: exactly one of the pair is expanded at a time. Off air
 * the radio is an icon FAB beside the "Play Random" pill; tuning in expands
 * the radio into the On Air pill and collapses shuffle into an icon FAB.
 */
function SwapFabs({ on, onRadioClick, onShuffleClick }: FabActionProps) {
  return (
    <div className="flex items-center space-x-2">
      <motion.button
        layout
        transition={spring}
        onClick={onRadioClick}
        aria-label={on ? "On Air" : "Radio"}
        className={cx(
          fabBase,
          on ? cx(filledStyle, "px-5 py-3") : cx(invertedStyle, "p-3"),
        )}
      >
        {on ? (
          <motion.span layout="position" className="flex items-center">
            <PulseDot />
            <span className="ml-2">On Air</span>
          </motion.span>
        ) : (
          <IconBroadcast className="h-6 w-6" />
        )}
      </motion.button>
      <motion.button
        layout
        transition={spring}
        onClick={onShuffleClick}
        aria-label="Play Random"
        className={cx(
          fabBase,
          on ? cx(invertedStyle, "p-3") : cx(filledStyle, "px-5 py-3"),
        )}
      >
        {on ? (
          <IconShuffle className="h-6 w-6 fill-current" />
        ) : (
          <motion.span layout="position" className="flex items-center">
            <IconShuffle className="h-5 w-5 fill-current" />
            <span className="ml-2">Play Random</span>
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}

/**
 * Variant 2 — Compact: both are always icon FABs; on air the radio FAB
 * fills with the accent color and carries a pulsing badge.
 */
function CompactFabs({ on, onRadioClick, onShuffleClick }: FabActionProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="relative inline-flex">
        <button
          onClick={onRadioClick}
          aria-label={on ? "On Air" : "Radio"}
          className={cx(fabBase, "p-3", on ? filledStyle : invertedStyle)}
        >
          <IconBroadcast className="h-6 w-6" />
        </button>
        {on && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-accent"></span>
          </span>
        )}
      </span>
      <button
        onClick={onShuffleClick}
        aria-label="Play Random"
        className={cx(fabBase, "p-3", filledStyle)}
      >
        <IconShuffle className="h-6 w-6 fill-current" />
      </button>
    </div>
  );
}

/**
 * Variant 3 — Cluster: one connected control with a radio segment and a
 * shuffle segment; on air the radio side expands and fills while shuffle
 * collapses to just its icon.
 */
function ClusterFabs({ on, onRadioClick, onShuffleClick }: FabActionProps) {
  return (
    <motion.div
      layout
      transition={spring}
      className="flex items-stretch overflow-hidden rounded-full border border-accent/30 bg-white shadow-md"
    >
      <motion.button
        layout
        transition={spring}
        onClick={onRadioClick}
        aria-label={on ? "On Air" : "Radio"}
        className={cx(
          "flex items-center justify-center font-semibold focus:outline-none",
          on
            ? "bg-accent px-5 py-3 text-white"
            : "px-4 py-3 text-accent hover:bg-gray-50",
        )}
      >
        {on ? (
          <motion.span layout="position" className="flex items-center">
            <PulseDot />
            <span className="ml-2">On Air</span>
          </motion.span>
        ) : (
          <IconBroadcast className="h-6 w-6" />
        )}
      </motion.button>
      <div className="w-px bg-accent/20" />
      <motion.button
        layout
        transition={spring}
        onClick={onShuffleClick}
        aria-label="Play Random"
        className={cx(
          "flex items-center justify-center font-semibold text-accent hover:bg-gray-50 focus:outline-none",
          on ? "px-4 py-3" : "px-5 py-3",
        )}
      >
        {on ? (
          <IconShuffle className="h-6 w-6 fill-current" />
        ) : (
          <motion.span layout="position" className="flex items-center">
            <IconShuffle className="h-5 w-5 fill-current" />
            <span className="ml-2">Play Random</span>
          </motion.span>
        )}
      </motion.button>
    </motion.div>
  );
}
