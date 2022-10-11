import React from "react";
import cx from "classnames";

export type EpisodeListHeaderProps = {
  numEpisodes: number;
  filterText?: string;
  activeSection?: "all" | "favorites";
  onSectionClick?: (section: "all" | "favorites") => void;
};

export function EpisodeListHeader({
  numEpisodes,
  filterText,
  activeSection = "all",
  onSectionClick = () => {},
}: EpisodeListHeaderProps) {
  return (
    <div className="item-center mt-4 mb-2 flex px-4">
      <div className="mr-auto font-semibold">
        <div className="-mx-2 space-x-1 md:space-x-4">
          <button
            className={cx(
              "inline-flex rounded px-2 py-1 hover:bg-gray-100",
              activeSection === "all" &&
                "bg-indigo-50 font-bold text-indigo-800",
              "text-gray-900"
            )}
            onClick={() => onSectionClick("all")}
          >
            {filterText ? `Episodes matching "${filterText}"` : "All Episodes"}
          </button>
          <button
            className={cx(
              "inline-flex rounded px-2 py-1 hover:bg-gray-100",
              activeSection === "favorites" &&
                "bg-indigo-50 font-bold text-indigo-800",
              "text-gray-900"
            )}
            onClick={() => onSectionClick("favorites")}
          >
            Favorites
          </button>
        </div>
      </div>
      <div className="font-semibold text-gray-600">{numEpisodes} Total</div>
    </div>
  );
}
