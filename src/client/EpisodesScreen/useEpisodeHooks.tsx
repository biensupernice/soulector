import { trpc } from "@/utils/trpc";

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

  return eps.filter((e) => e.id === id)?.[0] || null;
}

export function useGetEpisode(id: string) {
  const utils = trpc.useUtils();
  const getData = utils["episodes.all"].getData;

  const eps = getData({ collective: "all" }) ?? [];
  return eps.filter((e) => e.id === id)[0];
}
