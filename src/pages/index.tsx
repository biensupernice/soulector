import { RefObject, createContext, useRef, useState } from "react";
import {
  EpisodeAudioPlayer,
  EpisodesScreen,
} from "@/client/EpisodesScreen/EpisodesScreen";
import { useShortcutHandlers } from "@/client/useKeyboardHandlers";
import Navbar, { useNavbarStore } from "@/client/EpisodesScreen/Navbar";
import "react-spring-bottom-sheet/dist/style.css";
import { EpisodeOptionsModal } from "../client/EpisodesScreen/EpisodeOptionsModal";
import { motion, useScroll, useTransform } from "framer-motion";
import { EpisodeListHandle } from "@/client/EpisodesScreen/EpisodeList";
import { useEpisodesScreenState } from "@/client/EpisodesScreen/useEpisodesScreenState";
import { useMedia } from "@/client/infra/useMedia";
import {
  EpisodeModalSheet,
  useEpisodeModalSheetActions,
  useEpisodeModalSheetStore,
} from "@/client/EpisodesScreen/EpisodeModalSheet";
import Player from "@/client/EpisodesScreen/Player";
import { useEpisodes } from "@/client/EpisodesScreen/useEpisodeHooks";
import { cn } from "@/lib/utils";
import { IconSearch } from "@/client/components/Icons";
import { ShuffleButton } from "@/client/components/ShuffleButton";
import { useRouter } from "next/router";

export default function Home() {
  return <IndexScreen />;
}

export type EpisodeListContext = {
  ref: RefObject<EpisodeListHandle>;
  focusEpisode: (episodeId: string) => void;
};

export const EpisodeListContext = createContext<EpisodeListContext>(
  null as unknown as EpisodeListContext,
);

export const USE_NEW_PLAYER = true;
interface ScreenWithPlayerProps {
  children?: React.ReactNode;
  navBarSlot?: React.ReactNode;
  beforePlayerSlot?: React.ReactNode;
}
export function ScreenWithPlayer({
  children,
  navBarSlot,
  beforePlayerSlot,
}: ScreenWithPlayerProps) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 20], [0, 1]);
  const isWideScreen = useMedia("(min-width: 768px)");

  useShortcutHandlers();

  const isEpisodeModalSheetOpen = useEpisodeModalSheetStore((s) => s.isOpen);
  const episodeModalSheetActions = useEpisodeModalSheetActions();

  const { currentEpisodeId, currentEpisodeStreamUrls } =
    useEpisodesScreenState();

  const episodeListContextRef = useRef<EpisodeListHandle>(null);
  const focusEpisode = (episodeId: string) => {
    router.push("/");
    if (episodeListContextRef.current) {
      episodeListContextRef.current.focusEpisode(episodeId);
    }
  };

  return (
    <EpisodeListContext.Provider
      value={{ ref: episodeListContextRef, focusEpisode }}
    >
      <div className="h-full w-full text-gray-900">
        <div className="h-15 fixed top-0 z-20 w-full bg-white">
          <motion.div
            style={{ opacity }}
            className="pointer-events-none absolute inset-0 z-0 border-b border-b-gray-200"
          />
          <div className="mx-auto mt-safe-top max-w-4xl">{navBarSlot}</div>
        </div>
        {children}
        <div className="fixed bottom-0 right-0 z-20 w-full bg-white pb-safe-bottom">
          {beforePlayerSlot}
          {currentEpisodeId && <Player currentEpisodeId={currentEpisodeId} />}
        </div>
        {USE_NEW_PLAYER && currentEpisodeId && currentEpisodeStreamUrls && (
          <EpisodeAudioPlayer
            currentEpisodeId={currentEpisodeId}
            currentEpisodeStreamUrls={currentEpisodeStreamUrls}
          />
        )}
        {!isWideScreen && (
          <EpisodeModalSheet
            episodeId={currentEpisodeId}
            showEpisodeModal={isEpisodeModalSheetOpen}
            onCloseModal={() => episodeModalSheetActions.close()}
          ></EpisodeModalSheet>
        )}
      </div>
    </EpisodeListContext.Provider>
  );
}

function IndexScreen() {
  const [searchText, setSearchText] = useState("");
  const searchOpen = useNavbarStore((state) => state.searchOpen);
  const openSearch = useNavbarStore((state) => state.openSearch);

  // const episodeListContextRef = useRef<EpisodeListHandle>(null);
  // const focusEpisode = (episodeId: string) => {
  //   if (episodeListContextRef.current) {
  //     episodeListContextRef.current.focusEpisode(episodeId);
  //   }
  // };

  const {
    currentEpisodeId,
    onEpisodeClick,
    onRandomClick,
    currentEpisodeStreamUrls,
  } = useEpisodesScreenState();

  const { data: episodes, error } = useEpisodes();
  const shouldShowSuffleButton = !searchText && episodes;

  return (
    <>
      <ScreenWithPlayer
        navBarSlot={
          <Navbar
            searchText={searchText}
            onSearchChange={setSearchText}
            onSearchClose={() => setSearchText("")}
          />
        }
        beforePlayerSlot={
          <>
            {shouldShowSuffleButton || searchOpen ? (
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end justify-end space-y-2 pr-3 md:mb-4">
                <button
                  onClick={openSearch}
                  className={cn(
                    "border border-accent/30 bg-white font-semibold text-accent transition-all hover:bg-gray-50 ",
                    "items-center space-x-1 px-4 py-3",
                    "rounded-full",
                    "shadow-md",
                    "hidden focus:outline-none",
                    !searchOpen && "flex sm:hidden",
                  )}
                >
                  <IconSearch className="h-5 w-5 fill-current" />
                  <div>Search</div>
                </button>
                <ShuffleButton onClick={onRandomClick} />
              </div>
            ) : null}
          </>
        }
      >
        <EpisodesScreen searchText={searchText} />
      </ScreenWithPlayer>
      <EpisodeOptionsModal />
    </>
  );
}
