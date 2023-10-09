import React, { useEffect, useRef } from "react";
import { IconSearch, IconTimes } from "../../components/Icons";
import { KEYS } from "../../helpers";
import { useCollectiveSelectStore } from ".";

type Props = {
  searchText: string;
  onSearchChange: (searchText: string) => void;
  onCloseClick: () => void;
};
export default function NavbarSearch({
  searchText,
  onSearchChange,
  onCloseClick,
}: Props) {
  let searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  function handleKeydown(event: React.KeyboardEvent) {
    if (event.key === KEYS.ESCAPE) {
      event.nativeEvent.stopImmediatePropagation();
      onCloseClick();
    }
  }

  const selectedCollective = useCollectiveSelectStore((s) => s.selected);
  const placeHolderOptions = {
    all: "Search all episodes...",
    soulection: "Search Soulection episodes...",
    "sasha-marie-radio": "Search Sasha Marie Radio episodes...",
  };

  const placeHolder = placeHolderOptions[selectedCollective];

  return (
    <React.Fragment>
      <div className="mx-full ml-auto w-full md:max-w-xl">
        <div className="relative flex flex-grow items-center">
          <div className="absolute pl-4 text-gray-500">
            <IconSearch className="h-6 w-6 fill-current"></IconSearch>
          </div>
          <input
            ref={searchRef}
            onKeyDown={handleKeydown}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            type="text"
            className="w-full rounded-lg bg-gray-100 py-2 pl-12 text-gray-900 outline-none active:border-gray-400 active:bg-gray-200"
            placeholder={placeHolder}
          ></input>
          <div className="absolute right-0 ml-auto mr-3 flex items-center">
            <button
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-300 hover:text-gray-600 hover:shadow-sm focus:outline-none"
              onClick={() => onCloseClick()}
            >
              <IconTimes className="h-3 w-3 fill-current"></IconTimes>
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
