import Head from "next/head";
import { useState } from "react";
import TracksScreen from "../client/TracksScreen";
import { useShortcutHandlers } from "../client/useKeyboardHandlers";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  useShortcutHandlers();

  return (
    <>
      <Head>
        <title>Soulector</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <TracksScreen
        onSearchChange={setSearchText}
        onSearchClose={() => setSearchText("")}
        searchText={searchText}
      />
    </>
  );
}
