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

type FilterFunction = (episodes: ITrack[]) => ITrack[];

export function useFilterEpisodes(filterFunction: FilterFunction) {
  const { data } = useEpisodes();

  return filterFunction(data || []);
}
