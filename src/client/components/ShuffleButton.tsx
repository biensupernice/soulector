import { IconShuffle } from "./Icons";
import React from "react";
import cx from "classnames";

type Props = {
  onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>;

export function ShuffleButton({ onClick, className }: Props) {
  return (
    <button
      onClick={() => onClick()}
      className={cx(
        "bg-accent hover:bg-accent/90 text-white font-semibold transition-all",
        "py-3 px-5 md:px-12",
        "rounded-full",
        "shadow-md",
        "flex items-center",
        "focus:outline-none",
        className
      )}
    >
      <IconShuffle className="fill-current w-5 h-5" />
      <span className="ml-2">Play Random</span>
    </button>
  );
}
