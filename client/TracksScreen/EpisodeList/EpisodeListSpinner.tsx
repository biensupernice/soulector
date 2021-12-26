import React from "react";
import { Soulector } from "../../components/Icons";

export default function EpisodeListSpinner() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center animate-fade-loop">
      <Soulector className="w-10 h-10" />
      <div className="font-semibold">Loading Episodes</div>
    </div>
  );
}
