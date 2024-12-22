import { useRouter } from "next/router";
import { ScreenWithPlayer } from "..";

export default function EpisodeDetails() {
  const router = useRouter();
  const collectiveSlug = router.query.collective_slug;
  const episodeId = router.query.episode_id;
  return (
    <ScreenWithPlayer
      navBarSlot={
        <div className="flex w-full items-center py-3">
          <div className="flex">
            <div>{"<-"}</div>
            <div>Return to all episodes</div>
          </div>
        </div>
      }
    >
      <p>Post: {JSON.stringify({ collectiveSlug, episodeId }, null, 2)}</p>;
    </ScreenWithPlayer>
  );
}
