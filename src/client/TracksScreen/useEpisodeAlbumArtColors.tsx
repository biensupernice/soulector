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
    }
  );

  useEffect(() => {
    if (data) {
      document.documentElement.style.setProperty(
        "--accent",
        data.rgb.join(" ")
      );
    }
  }, [data]);
}
