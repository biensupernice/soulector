import React from "react";

export function TrackListError() {
  return (
    <div className="flex max-w-4xl m-auto flex-col h-full items-start justify-start p-16 px-10 md:px-6 text-3xl md:text-6xl font-bold space-y-8 md:space-y-16">
      <div>Err...</div>
      <div>
        Something went wrong loading episodes.
        <br /> Try again in a bit.
      </div>
    </div>
  );
}
