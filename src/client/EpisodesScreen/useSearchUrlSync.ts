import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { debounce } from "lodash-es";
import { parseFilter, serializeFilter } from "./searchFilter";
import { useCollectiveSelectStore, useNavbarStore } from "./Navbar";

/**
 * Owns the search query and keeps it in sync with a shareable `?filter=` URL
 * (an AIP-160-subset expression — see {@link ./searchFilter}).
 *
 * On first load it hydrates from the URL: a deep link like
 * `/?filter=collective = soulection missing you` restores the collective scope,
 * pre-fills the query, and opens the search bar so the shared state is visible.
 * As the user types or changes collective, the URL is updated (debounced, via
 * `replace` + shallow routing) so it never spams history and never triggers a
 * data refetch or scroll jump. Clearing the search returns the URL to a clean
 * `/`.
 */
export function useSearchUrlSync(): {
  searchText: string;
  setSearchText: (text: string) => void;
} {
  const [searchText, setSearchText] = useState("");

  const router = useRouter();
  const collective = useCollectiveSelectStore((s) => s.selected);
  const setCollective = useCollectiveSelectStore((s) => s.setSelected);
  const openSearch = useNavbarStore((s) => s.openSearch);

  // Only hydrate from the URL once; after that the UI is the source of truth.
  const hydratedRef = useRef(false);

  // The router object identity changes across renders, but `replace` always
  // targets the live router — keep a ref so the debounced writer stays stable.
  const routerRef = useRef(router);
  routerRef.current = router;

  const commit = useMemo(
    () =>
      debounce((filterStr: string) => {
        const r = routerRef.current;
        const url = filterStr
          ? `${r.pathname}?filter=${encodeURIComponent(filterStr)}`
          : r.pathname;
        r.replace(url, undefined, { shallow: true });
      }, 300),
    [],
  );

  useEffect(() => () => commit.cancel(), [commit]);

  // Hydrate state from the URL once the router has parsed the query string.
  useEffect(() => {
    if (!router.isReady || hydratedRef.current) return;
    hydratedRef.current = true;

    const raw =
      typeof router.query.filter === "string" ? router.query.filter : "";
    if (!raw) return;

    const parsed = parseFilter(raw);
    if (parsed.collective) {
      setCollective(parsed.collective);
    }
    if (parsed.text) {
      setSearchText(parsed.text);
      openSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Mirror state back into the URL. The collective is only encoded while a
  // query is active, so browsing without searching keeps the URL clean.
  useEffect(() => {
    if (!router.isReady || !hydratedRef.current) return;
    const filterStr = serializeFilter({
      text: searchText,
      collective: searchText.trim() ? collective : null,
    });
    commit(filterStr);
  }, [searchText, collective, router.isReady, commit]);

  return { searchText, setSearchText };
}
