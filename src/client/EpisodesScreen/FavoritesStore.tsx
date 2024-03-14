import { useEffect } from "react";
import create from "zustand";

export type FavoritesStore = {
  favorites: string[];
  favoritesIndex: Set<string>;
  isFavorite: (id: string) => boolean;
  isFavoriteFast: (id: string) => boolean;
  addFavorite: (episodeId: string) => void;
  removeFavorite: (episodeId: string) => void;
  loadFavorites: () => void;
  persistFavorites: () => void;
};

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  favoritesIndex: new Set<string>(),
  isFavorite: (id: string) => get().favorites.includes(id),
  isFavoriteFast: (id: string) => get().favoritesIndex.has(id),
  persistFavorites: () => {
    localStorage.setItem("favorites", JSON.stringify(get().favorites));
  },
  loadFavorites: () => {
    const favorites = localStorage.getItem("favorites");
    if (favorites) {
      const faves = JSON.parse(favorites) as string[];
      set({
        favorites: faves,
      });
      const index = get().favoritesIndex;
      for (const f of faves) {
        index.add(f);
      }
    }
  },
  addFavorite(episodeId: string) {
    set({
      favorites: [...get().favorites, episodeId],
    });

    get().favoritesIndex.add(episodeId);

    get().persistFavorites();
  },
  removeFavorite(episodeId: string) {
    set({
      favorites: get().favorites.filter((id) => id !== episodeId),
    });

    get().favoritesIndex.delete(episodeId);

    get().persistFavorites();
  },
}));

export const useFavoritesCount = () =>
  useFavoritesStore((s) => s.favorites.length);

export const useIsFavoriteFast = () => useFavoritesStore((s) => s.isFavorite);

export function useFavorites() {
  const favorites = useFavoritesStore((state) => state.favorites);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites);

  useEffect(() => {
    loadFavorites();
  }, []);

  return {
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
  };
}
