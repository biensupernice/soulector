import { trpc } from "@/utils/trpc";
import { usePlayerStore } from "./PlayerStore";
import { useEffect } from "react";

export function useEpisodeAlbumArtColors() {
  const currentEpisodeId = usePlayerStore((state) => state.currentEpisodeId);

  const { data } = trpc["episode.getAccentColor"].useQuery(
    { episodeId: currentEpisodeId },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      enabled: currentEpisodeId !== undefined,
    }
  );

  useEffect(() => {
    if (data) {
      const rgbString = data.rgb.join(" ");

      const [h, s, l] = data.hsl;
      const hslString = `${h * 360} ${s * 100}% ${l * 100}%`;

      document.documentElement.style.setProperty("--accent", hslString);
    }
  }, [data]);
}
