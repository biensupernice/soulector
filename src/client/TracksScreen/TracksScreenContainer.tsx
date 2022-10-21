import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import ReactGA from "react-ga";
import { usePlayerStore } from "./PlayerStore";
import { useEpisodes } from "./TracksStore";

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const play = usePlayerStore((state) => state.play);
  const { client, setQueryData } = trpc.useContext();
  const { data: episodes } = useEpisodes();

  async function onTrackClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e._id === episodeId);
      ReactGA.event({
        category: "User",
        action: "Track Click",
        label: episode && episode.name ? episode.name : episodeId,
      });

      const query = await client.query("episode.getFakeStreamUrl", {
        episodeId: episodeId,
      });
      setQueryData(["episode.getFakeStreamUrl", { episodeId }], query);

      play(episodeId);
    }
  }

  function onRandomClick() {
    ReactGA.event({
      category: "Action",
      action: "Play Random",
    });

    let episode = sample(episodes);
    if (episode) {
      play(episode._id);
    }
  }

  return {
    currentTrackId,
    onTrackClick,
    onRandomClick,
  };
}
