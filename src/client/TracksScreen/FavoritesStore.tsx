import { useEffect } from "react";
import create from "zustand";

export type FavoritesStore = {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  addFavorite: (trackId: string) => void;
  removeFavorite: (trackId: string) => void;
  loadFavorites: () => void;
  persistFavorites: () => void;
};

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  isFavorite: (id: string) => get().favorites.includes(id),
  persistFavorites: () => {
    localStorage.setItem("favorites", JSON.stringify(get().favorites));
  },
  loadFavorites: () => {
    const favorites = localStorage.getItem("favorites");
    if (favorites) {
      set({
        favorites: JSON.parse(favorites),
      });
    }
  },
  addFavorite(trackId: string) {
    set({
      favorites: [...get().favorites, trackId],
    });

    get().persistFavorites();
  },
  removeFavorite(trackId: string) {
    set({
      favorites: get().favorites.filter((id) => id !== trackId),
    });

    get().persistFavorites();
  },
}));

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
