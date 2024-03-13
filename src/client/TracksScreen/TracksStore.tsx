import { EpisodeRouter } from "@/server/router";
import { trpc } from "@/utils/trpc";
import { inferRouterOutputs } from "@trpc/server";

export type RouterOutput = inferRouterOutputs<EpisodeRouter>;
export type ITrack = RouterOutput["episodes.all"][number];

export function useEpisodes() {
  return trpc["episodes.all"].useQuery(
    { collective: "all" },
    {
      refetchOnWindowFocus: false,
    }
  );
}

export function useEpisode(id: string | undefined) {
  const utils = trpc.useUtils();
  const getData = utils["episodes.all"].getData;

  if (!id) {
    return null;
  }
  const eps = getData() ?? [];

  return eps.filter((e) => e._id === id)?.[0] || null;
}

export function useGetEpisode(id: string) {
  const utils = trpc.useUtils();
  const getData = utils["episodes.all"].getData;

  const eps = getData({ collective: "all" }) ?? [];
  return eps.filter((e) => e._id === id)[0];
}
