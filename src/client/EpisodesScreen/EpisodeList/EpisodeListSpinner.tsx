import React from "react";
import { Soulector } from "../../components/Icons";

export default function EpisodeListSpinner() {
  return (
    <div className="animate-fade-loop flex h-full w-full flex-col items-center justify-center">
      <Soulector className="h-14 w-14" />
      <div className="font-semibold">Loading Episodes</div>
    </div>
  );
}
