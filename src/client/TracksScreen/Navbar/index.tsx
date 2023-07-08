import Logo from "./Logo";
import React, { useEffect } from "react";
import { IconSearch } from "../../components/Icons";
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
    <div className="flex w-full items-center px-4 py-3">
      <React.Fragment>
        <div
          className={cx("flex", "items-center", searchOpen && "hidden sm:flex")}
        >
          <Logo />
        </div>
        <div className="ml:auto flex w-full items-center justify-end sm:ml-6">
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
