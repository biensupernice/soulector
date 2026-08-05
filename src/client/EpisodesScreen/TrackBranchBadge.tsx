import { IconBranch } from "@/client/components/Icons";
import { cn } from "@/lib/utils";

/**
 * The way sideways: how many other sets played this record, and the click that
 * opens them.
 *
 * Deliberately always visible rather than revealed on hover like the row's
 * other controls — the count is information you need *before* you reach for
 * it. It sits quiet until pointed at.
 */
export function TrackBranchBadge({
  count,
  active = false,
  onClick,
}: {
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  if (count < 1) return null;

  return (
    <button
      onClick={(event) => {
        // The row underneath seeks to the track; this is a sibling target, not
        // a smaller button inside that one.
        event.stopPropagation();
        onClick();
      }}
      title={`Also played in ${count} other ${count === 1 ? "episode" : "episodes"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-1 pl-1.5 pr-2 text-xs font-semibold",
        "transition-colors duration-150 focus:outline-none",
        active
          ? "bg-white text-black"
          : "bg-white/15 text-white/70 hover:bg-white/30 hover:text-white",
      )}
    >
      <IconBranch className="h-3 w-3" />
      {count}
    </button>
  );
}
