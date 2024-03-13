import { inferQueryOutput, trpc } from "@/utils/trpc";

export type ITrack = inferQueryOutput<"episodes.all">[number];

export function useEpisodes() {
    return  trpc.proxy.episodes.all.useQuery({ collective: "all" }, {
        refetchOnWindowFocus: false,
    });
}

export function useEpisode(id: string | undefined) {
  const { getQueryData } = trpc.useContext();

  if (!id) {
    return null;
  }
  const eps = getQueryData(["episodes.all"]) ?? [];

  return eps.filter((e) => e._id === id)?.[0] || null;
}

export function useGetEpisode(id: string) {
  const { getQueryData } = trpc.useContext();

  const eps = getQueryData(["episodes.all", { collective: "all" }]) ?? [];
  return eps.filter((e) => e._id === id)[0];
}
