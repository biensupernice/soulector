import { useEffect, useRef } from "react";
import { formatTimeSecs } from "@/client/helpers";
import { IconTimes } from "@/client/components/Icons";
import { useRetrace } from "./TrackConnections";
import { useTracksPanelActions, useTracksPanelStore } from "./TracksPanelStore";

/**
 * The path a dive has taken, as steps you can click.
 *
 * A phone can only offer "back", one step at a time, because its history is a
 * stack it can't show you. With the room to lay the whole path out, going back
 * three sets is one click rather than three.
 */
export function DiveTrail() {
  const trail = useTracksPanelStore((s) => s.trail);
  const { clearTrail } = useTracksPanelActions();
  const retraceTo = useRetrace();
  const stripRef = useRef<HTMLDivElement | null>(null);

  // A long path outruns a narrow strip, and the step you are standing on is
  // the one that has to stay in sight.
  useEffect(() => {
    const strip = stripRef.current;
    if (strip) strip.scrollLeft = strip.scrollWidth;
  }, [trail.length]);

  // Escape leaves the thread without leaving the set you ended up in.
  useEffect(() => {
    if (trail.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") clearTrail();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trail.length, clearTrail]);

  if (trail.length === 0) return null;

  return (
    <div
      ref={stripRef}
      className="flex items-center gap-1 overflow-x-auto border-b border-white/10 bg-black/25 px-3 py-2 text-white"
    >
      {trail.map((step, index) => {
        const isLast = index === trail.length - 1;
        return (
          <div
            key={`${step.episodeId}-${index}`}
            className="flex items-center gap-1"
          >
            {index > 0 && (
              <span aria-hidden className="px-0.5 text-white/30">
                ›
              </span>
            )}
            <button
              onClick={() => retraceTo(index)}
              disabled={isLast}
              title={isLast ? "You are here" : `Back to ${step.name}`}
              className={
                isLast
                  ? "flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold"
                  : "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
              }
            >
              <span className="max-w-[11rem] truncate">{step.name}</span>
              {step.timestamp !== undefined && (
                <span className="tabular-nums text-white/50">
                  {formatTimeSecs(step.timestamp)}
                </span>
              )}
            </button>
          </div>
        );
      })}

      <button
        onClick={clearTrail}
        title="Leave the thread"
        className="ml-auto shrink-0 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
      >
        <IconTimes className="h-3 w-3 fill-current" />
      </button>
    </div>
  );
}
