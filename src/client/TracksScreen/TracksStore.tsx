import { inferQueryOutput, trpc } from "@/utils/trpc";

export type ITrack = inferQueryOutput<"episodes.all">[number];

export function useEpisodes() {
  return trpc.useQuery(["episodes.all"]);
}

export function useEpisode(id: string | undefined) {
  const { data: queryRes } = trpc.useQuery(["episodes.all"], {
    select: (episodes) => {
      return episodes.filter((t) => t._id === id);
    },
  });

  if (!id) {
    return null;
  }

  return queryRes?.[0] || null;
}

type FilterFunction = (episodes: ITrack[]) => ITrack[];

export function useFilterEpisodes(filterFunction: FilterFunction) {
  const { data: episodes } = trpc.useQuery(["episodes.all"]);

  return filterFunction(episodes || []);
}
