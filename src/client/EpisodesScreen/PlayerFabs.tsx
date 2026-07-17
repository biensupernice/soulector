import React from "react";
import cx from "classnames";
import { motion } from "framer-motion";
import { IconBroadcast, IconShuffle } from "../components/Icons";

const spring = { type: "spring", bounce: 0.18, duration: 0.45 } as const;

function PulseDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
      <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
    </span>
  );
}

type PlayerFabsProps = {
  on: boolean;
  onRadioClick: () => void;
  onShuffleClick: () => void;
};

/**
 * The floating radio/shuffle actions: one connected control with a radio
 * segment and a shuffle segment. On air the radio side expands and fills
 * while shuffle collapses to just its icon; tuning away reverses it.
 */
export function PlayerFabs({
  on,
  onRadioClick,
  onShuffleClick,
}: PlayerFabsProps) {
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
        title={on ? "On Air — tap to tune out" : "Tune in to the radio"}
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
        title="Play a random episode"
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
