import { useState } from "react";
import TracksScreen from "@/client/TracksScreen";
import { useShortcutHandlers } from "@/client/useKeyboardHandlers";
import Navbar from "@/client/TracksScreen/Navbar";
import "react-spring-bottom-sheet/dist/style.css";
import { TrackOptionsModal } from "./TrackOptionsModal";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  useShortcutHandlers();

  return (
    <>
      <div className="text-gray-900 h-full w-full">
        <div className="pt-safe-top h-15 fixed top-0 w-full bg-white shadow-md z-10">
          <Navbar
            searchText={searchText}
            onSearchChange={setSearchText}
            onSearchClose={() => setSearchText("")}
          />
        </div>
        <TracksScreen searchText={searchText} />
      </div>
      <TrackOptionsModal />
    </>
  );
}
