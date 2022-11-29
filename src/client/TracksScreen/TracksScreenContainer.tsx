import { trpc } from "@/utils/trpc";
import { sample } from "lodash-es";
import ReactGA from "react-ga";
import {
  MutationKey,
  MutationFunction,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useMutation,
  useIsMutating,
  useQueryClient,
} from "react-query";
import { usePlayerActions, usePlayerStore } from "./PlayerStore";
import { useEpisodes } from "./TracksStore";

export function useTracksScreenContainer() {
  const currentTrackId = usePlayerStore((state) => state.currentTrackId);
  const playing = usePlayerStore((state) => state.playing);
  const volume = usePlayerStore((state) => state.volume);
  const currentTrackStreamUrls = usePlayerStore(
    (state) => state.currentTrackStreamUrls
  );

  const playerActions = usePlayerActions();

  const { data: episodes } = useEpisodes();

  const { mutate } = usePlayEpisodeMutation();

  async function onTrackClick(episodeId: string) {
    if (episodes) {
      const episode = episodes.find((e) => e._id === episodeId);
      ReactGA.event({
        category: "User",
        action: "Track Click",
        label: episode && episode.name ? episode.name : episodeId,
      });

      playerActions.loadTrack(episodeId);

      mutate(episodeId, {
        onSuccess(data) {
          playerActions.setCurrentTrackStreamUrls(data);
        },
      });
    }
  }

  function onRandomClick() {
    ReactGA.event({
      category: "Action",
      action: "Play Random",
    });

    let episode = sample(episodes);
    if (episode) {
      playerActions.loadTrack(episode._id);
      mutate(episode._id, {
        onSuccess(data) {
          playerActions.setCurrentTrackStreamUrls(data);
        },
      });
    }
  }

  return {
    playing,
    volume,
    currentTrackId,
    onTrackClick,
    onRandomClick,
    currentTrackStreamUrls,
  };
}

export function usePlayEpisodeMutation() {
  const { fetchQuery } = trpc.useContext();
  return useCustomMutation(
    "playEpisode",
    async (episodeId: string) => {
      const query = await fetchQuery(
        [
          "episode.getFakeStreamUrl",
          {
            episodeId: episodeId,
          },
        ],
        {
          staleTime: Infinity,
        }
      );

      return query;
    },
    {
      onError: (err, va) => console.error(err, va),
    }
  );
}

export const useCustomMutation = <
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown
>(
  mutationKey: MutationKey,
  mutationFn: MutationFunction<TData, TVariables>,
  options?: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    "mutationKey" | "mutationFn"
  >
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const queryClient = useQueryClient();
  const query = useQuery<TData, TError>(
    ["CustomMutation", mutationKey],
    async () => await Promise.resolve(false as unknown as TData),
    { retry: false, cacheTime: Infinity, staleTime: Infinity }
  );
  const queryError = useQuery<TError, TData>(
    ["CustomMutationError", mutationKey],
    async () => await Promise.resolve(false as unknown as TError),
    { retry: false, cacheTime: Infinity, staleTime: Infinity }
  );
  const mutation = useMutation<TData, TError, TVariables, TContext>(
    mutationKey,
    async (...params) => {
      queryClient.setQueryData(["CustomMutationError", mutationKey], false);
      return await mutationFn(...params);
    },
    {
      ...options,
      onSuccess: (data, variables, context) => {
        queryClient.setQueryData(["CustomMutation", mutationKey], data);
        if (options?.onSuccess) options.onSuccess(data, variables, context);
      },
      onError: (err, variables, context) => {
        queryClient.setQueryData(["CustomMutationError", mutationKey], err);
        if (options?.onError) options.onError(err, variables, context);
      },
    }
  );
  const isLoading = useIsMutating(mutationKey);

  // We need typecasting here due the ADT about the mutation result, and as we're using a data not related to the mutation result
  // The typescript can't infer the type correctly.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    ...mutation,
    data: query.data,
    isLoading: !!isLoading,
    error: queryError.data,
    isError: !!queryError.data,
  } as UseMutationResult<TData, TError, TVariables, TContext>;
};
