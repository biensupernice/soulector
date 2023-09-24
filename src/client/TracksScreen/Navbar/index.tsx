import Logo from "./Logo";
import React, { useEffect } from "react";
import { IconChevron, IconSearch } from "../../components/Icons";
import NavbarSearch from "./NavbarSearch";
import cx from "classnames";
import create from "zustand";

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
  const searchOpen = useNavbarStore((state) => state.searchOpen);
  const openSearch = useNavbarStore((state) => state.openSearch);
  const closeSearch = useNavbarStore((state) => state.closeSearch);

  useEffect(() => {
    if (!searchOpen) {
      onSearchClose();
    }
  }, [searchOpen, onSearchClose]);

  return (
    <div className="flex w-full items-center py-3">
      <React.Fragment>
        <div className={cx("flex w-full px-2", searchOpen && "hidden sm:flex")}>
          <button className="flex w-full sm:w-auto items-center justify-between space-x-4 rounded-full border border-white px-4 py-2 transition-colors hover:border hover:border-slate-200 hover:bg-gray-100 hover:shadow-sm active:shadow-sm">
            <Logo />
            <IconChevron className="inline-block h-5 w-5 stroke-current" />
          </button>
        </div>
        <div className="ml:auto hidden w-full  items-center justify-end px-4 sm:ml-6 sm:flex">
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
