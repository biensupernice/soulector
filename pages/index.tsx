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
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json"></link>
        <meta name="theme-color" content="#000000"></meta>
      </Head>
      <TracksScreen
        onSearchChange={setSearchText}
        onSearchClose={() => setSearchText("")}
        searchText={searchText}
      />
    </>
  );
}
