import { trpc } from "@/utils/trpc";
import { usePlayerStore } from "./PlayerStore";
import { useEffect } from "react";

export function useEpisodeAlbumArtColors() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);

  const { data } = trpc.useQuery(
    ["episode.getAccentColor", { episodeId: currentTrackId }],
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      enabled: currentTrackId !== undefined,
    }
  );

  useEffect(() => {
    if (data) {
      const rgbString = data.rgb.join(" ");

      const [h, s, l] = data.hsl;
      const hslString = `${h*360} ${s*100}% ${l*100}%`;

      document.documentElement.style.setProperty("--accent", hslString);
    }
  }, [data]);
}
