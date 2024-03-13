import { useState } from "react";
import TracksScreen from "@/client/TracksScreen";
import { useShortcutHandlers } from "@/client/useKeyboardHandlers";
import Navbar from "@/client/TracksScreen/Navbar";
import "react-spring-bottom-sheet/dist/style.css";
import { TrackOptionsModal } from "../client/TracksScreen/TrackOptionsModal";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  useShortcutHandlers();

  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 20], [0, 1]);

  return (
    <>
      <div className="h-full w-full text-gray-900">
        <div className="h-15 fixed top-0 z-20 w-full bg-white">
          <motion.div
            style={{ opacity }}
            className="pointer-events-none absolute inset-0 z-0 border-b border-b-gray-200"
          />
          <div className="mx-auto mt-safe-top max-w-4xl">
            <Navbar
              searchText={searchText}
              onSearchChange={setSearchText}
              onSearchClose={() => setSearchText("")}
            />
          </div>
        </div>
        <TracksScreen searchText={searchText} />
      </div>
      <TrackOptionsModal />
    </>
  );
}
