import { AppRouter } from "@/pages/api/trpc/[trpc]";
import { createReactQueryHooks } from "@trpc/react";
import { inferProcedureInput, inferProcedureOutput } from "@trpc/server";

export const trpc = createReactQueryHooks<AppRouter>();

/**
 * This is a helper method to infer the output of a query resolver
 * @example type HelloOutput = inferQueryOutput<'hello'>
 */
export type inferQueryOutput<
  TRouteKey extends keyof AppRouter["_def"]["queries"]
> = inferProcedureOutput<AppRouter["_def"]["queries"][TRouteKey]>;

/**
 * This is a helper method to infer the output of a query resolver
 * @example type HelloOutput = inferQueryOutput<'hello'>
 */
export type inferQueryInput<
  TRouteKey extends keyof AppRouter["_def"]["queries"]
> = inferProcedureInput<AppRouter["_def"]["queries"][TRouteKey]>;
