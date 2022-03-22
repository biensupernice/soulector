import { useState } from "react";
import TracksScreen from "../client/TracksScreen";
import { useShortcutHandlers } from "../client/useKeyboardHandlers";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  useShortcutHandlers();

  return (
    <TracksScreen
      onSearchChange={setSearchText}
      onSearchClose={() => setSearchText("")}
      searchText={searchText}
    />
  );
}
