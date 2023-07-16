import React from "react";
import cx from "classnames";
import { motion } from "framer-motion";

export type EpisodeListHeaderProps = {
  filterText?: string;
  activeSection?: "all" | "favorites";
  onSectionClick?: (section: "all" | "favorites") => void;
  rightContent?: React.ReactNode;
};

export function EpisodeListHeader({
  filterText,
  activeSection = "all",
  onSectionClick = () => {},
  rightContent,
}: EpisodeListHeaderProps) {
  return (
    <div className="item-center mt-4 mb-2 flex px-4">
      <div className="mr-auto font-semibold">
        <div className="-mx-2 space-x-1 md:space-x-4">
          <button
            className={cx(
              "relative inline-flex rounded-full bg-gray-100 px-3 py-1",
              activeSection === "all" && "font-bold text-accent",
              "text-gray-900"
            )}
            onClick={() => onSectionClick("all")}
          >
            {activeSection === "all" && (
              <motion.span
                layoutId="backlight"
                className="absolute inset-0 z-10 rounded bg-accent/10 mix-blend-multiply"
                style={{ borderRadius: 9999 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            {filterText ? `Episodes matching "${filterText}"` : "All Episodes"}
          </button>
          {filterText ? null : (
            <button
              className={cx(
                "relative inline-flex rounded-full bg-gray-100 px-3 py-1",
                activeSection === "favorites" && "font-bold text-accent",
                "text-gray-900"
              )}
              onClick={() => onSectionClick("favorites")}
            >
              {activeSection === "favorites" && (
                <motion.span
                  layoutId="backlight"
                  className="absolute inset-0 z-10 rounded bg-accent/10 mix-blend-multiply"
                  style={{ borderRadius: 9999 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              Favorites
            </button>
          )}
        </div>
      </div>
      <div>{rightContent}</div>
    </div>
  );
}
