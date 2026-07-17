import { IconBroadcast } from "./Icons";
import React from "react";
import cx from "classnames";

type Props = {
  on: boolean;
  onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>;

export function RadioButton({ on, onClick, className }: Props) {
  return (
    <button
      onClick={() => onClick()}
      className={cx(
        "font-semibold transition-all",
        "px-4 py-3 md:px-6",
        "rounded-full",
        "shadow-md",
        "flex items-center",
        "focus:outline-none",
        on
          ? "bg-accent text-white hover:bg-accent/90"
          : "border border-accent/30 bg-white text-accent hover:bg-gray-50",
        className,
      )}
    >
      {on ? (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
        </span>
      ) : (
        <IconBroadcast className="h-5 w-5" />
      )}
      <span className="ml-2">{on ? "On Air" : "Radio"}</span>
    </button>
  );
}
