import { inferQueryOutput, trpc } from "@/utils/trpc";

export type ITrack = inferQueryOutput<"episodes.all">[number];

export function useEpisodes() {
  return trpc.useQuery(["episodes.all"], {
    refetchOnWindowFocus: false,
  });
}

export function useEpisode(id: string | undefined) {
  if (!id) {
    return null;
  }

  const { data: queryRes } = trpc.useQuery(["episodes.all"], {
    refetchOnWindowFocus: false,
    select: (episodes) => {
      return episodes.filter((t) => t._id === id);
    },
  });

  return queryRes?.[0] || null;
}

export function useEpisodeStreamUrls(episodeId: string | undefined) {
  // if (!episodeId) {
  //   return null;
  // }

  return trpc.useQuery(
    [
      "episode.getFakeStreamUrl",
      {
        episodeId: episodeId!,
      },
    ],
    {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      enabled: Boolean(episodeId),
    }
  );
}

// idk
export function useFetchEpisodeStreamUrls(episodeId: string) {
  const { client } = trpc.useContext();

  const { refetch } = trpc.useQuery(
    [
      "episode.getFakeStreamUrl",
      {
        episodeId: episodeId,
      },
    ],
    {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      enabled: false,
    }
  );

  return refetch;
}
