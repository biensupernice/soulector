import {
  MutationKey,
  MutationFunction,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useMutation,
  useIsMutating,
  useQueryClient,
} from "@tanstack/react-query";

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
  const query = useQuery<TData, TError>({
    queryKey: ["CustomMutation", mutationKey],
    queryFn: async () => false as unknown as TData,
    retry: false,
    gcTime: Infinity,
    staleTime: Infinity,
  });
  const queryError = useQuery<TError, TData>({
    queryKey: ["CustomMutationError", mutationKey],
    queryFn: async () => false as unknown as TError,
    retry: false,
    gcTime: Infinity,
    staleTime: Infinity,
  });
  const mutation = useMutation<TData, TError, TVariables, TContext>({
    mutationKey,
    mutationFn: async (variables, context) => {
      queryClient.setQueryData(["CustomMutationError", mutationKey], false);
      return await mutationFn(variables, context);
    },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(["CustomMutation", mutationKey], data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      queryClient.setQueryData(["CustomMutationError", mutationKey], err);
      options?.onError?.(err, variables, onMutateResult, context);
    },
  });
  const isMutating = useIsMutating({ mutationKey });

  // We need typecasting here due the ADT about the mutation result, and as we're using a data not related to the mutation result
  // The typescript can't infer the type correctly.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    ...mutation,
    data: query.data,
    isPending: !!isMutating,
    error: queryError.data,
    isError: !!queryError.data,
  } as UseMutationResult<TData, TError, TVariables, TContext>;
};
