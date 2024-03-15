import {
  SashaMarieRadioLogo,
  SoulectionLogo,
  TheLoveBelowHourLogo,
} from "./Logos";
import React, { useEffect } from "react";
import { IconChevron, IconSearch, Soulection } from "../../components/Icons";
import NavbarSearch from "./NavbarSearch";
import cx from "classnames";
import create from "zustand";
import {
  CollectiveSelect,
  CollectiveSelectContent,
  CollectiveSelectItem,
  CollectiveSelectTrigger,
  CollectiveSelectValue,
} from "./CollectiveSelect";
import { Arrow } from "@radix-ui/react-select";
import EpisodeListSpinner from "../EpisodeList/EpisodeListSpinner";
import { CardStackIcon } from "@radix-ui/react-icons";
import { SelectSeparator } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EpisodeCollectiveSlugProjection } from "@/server/router";

export type NavbarStore = {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

export const useNavbarStore = create<NavbarStore>((set, get) => ({
  searchOpen: false,
  openSearch() {
    set({
      searchOpen: true,
    });
  },
  closeSearch() {
    set({
      searchOpen: false,
    });
  },
}));

export type CollectiveSelectStore = {
  selected: "all" | EpisodeCollectiveSlugProjection;
  setSelected: (collective: "all" | EpisodeCollectiveSlugProjection) => void;
  loadPersisted: () => void;
};

export const useCollectiveSelectStore = create<CollectiveSelectStore>(
  (set, get) => ({
    selected: "soulection",
    setSelected(collective) {
      set({
        selected: collective,
      });
      localStorage.setItem("selectedCollective", collective);
    },
    loadPersisted: () => {
      const persistedCollective = localStorage.getItem("selectedCollective");
      if (persistedCollective) {
        set({
          selected: persistedCollective as
            | "all"
            | EpisodeCollectiveSlugProjection,
        });
      }
    },
  })
);

type Props = {
  searchText: string;
  onSearchClose: () => void;
  onSearchChange: (searchText: string) => void;
};

export default function Navbar({
  searchText,
  onSearchChange,
  onSearchClose,
}: Props) {
  const searchOpen = useNavbarStore((s) => s.searchOpen);
  const openSearch = useNavbarStore((s) => s.openSearch);
  const closeSearch = useNavbarStore((s) => s.closeSearch);

  const selectedCollective = useCollectiveSelectStore((s) => s.selected);
  const selectCollective = useCollectiveSelectStore((s) => s.setSelected);

  useEffect(() => {
    if (!searchOpen) {
      onSearchClose();
    }
  }, [searchOpen, onSearchClose]);

  return (
    <div className="flex w-full items-center py-3">
      <React.Fragment>
        <div
          className={cn(
            "flex w-full flex-shrink-0 px-2 sm:w-auto",
            searchOpen && "hidden sm:flex"
          )}
        >
          <CollectiveSelect
            onValueChange={(v: any) => selectCollective(v)}
            value={selectedCollective}
            defaultValue={selectedCollective}
          >
            <CollectiveSelectTrigger className="w-full">
              <CollectiveSelectValue />
            </CollectiveSelectTrigger>
            <CollectiveSelectContent sideOffset={-52} side="bottom">
              <CollectiveSelectItem value="all">
                <div className="flex items-center space-x-3">
                  <CardStackIcon className="h-8 w-8" />
                  <div className="w-full text-2xl font-bold">
                    All Collectives
                  </div>
                </div>
              </CollectiveSelectItem>
              <SelectSeparator className="bg-gray-200" />
              <CollectiveSelectItem value="sasha-marie-radio">
                <SashaMarieRadioLogo />
              </CollectiveSelectItem>
              <CollectiveSelectItem value="soulection">
                <SoulectionLogo />
              </CollectiveSelectItem>
              <CollectiveSelectItem value="the-love-below-hour">
                <TheLoveBelowHourLogo />
              </CollectiveSelectItem>
            </CollectiveSelectContent>
          </CollectiveSelect>
        </div>
        <div className="ml:auto flex w-full items-center justify-end px-4 sm:ml-6">
          {searchOpen ? (
            <NavbarSearch
              searchText={searchText}
              onCloseClick={closeSearch}
              onSearchChange={onSearchChange}
            />
          ) : (
            <SearchButton onClick={openSearch} />
          )}
        </div>
      </React.Fragment>
    </div>
  );
}

type SearchButtonProps = {
  onClick: () => void;
};
function SearchButton({ onClick }: SearchButtonProps) {
  return (
    <button
      className="rounded-full p-2 hover:bg-gray-200 focus:outline-none"
      onClick={() => onClick()}
    >
      <IconSearch className="h-6 w-6 fill-current"></IconSearch>
    </button>
  );
}
