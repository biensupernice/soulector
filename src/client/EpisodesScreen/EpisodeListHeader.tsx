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
    <div className="mt-4 mb-2 flex items-center gap-3 px-4">
      <div className="min-w-0 flex-1 font-semibold">
        <div className="-mx-2 flex flex-wrap items-center gap-y-1 space-x-1 md:space-x-4">
          <motion.button
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
          </motion.button>
          {filterText ? null : (
            <motion.button
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
            </motion.button>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">{rightContent}</div>
    </div>
  );
}
