export function invariant(condition: any, message?: string): asserts condition {
  if (condition) {
    return;
  }
  throw new Error(`${message || ""}`);
}

export function createInvariant<P extends Error>(
  createError: (message?: string) => P
) {
  return function invariant(
    condition: any,
    message?: string
  ): asserts condition {
    if (condition) {
      return;
    }
    // Condition not passed
    throw createError(`${message || ""}`);
  };
}

export class UnauthorizedError extends Error {}
export const unauthorizedInvariant = createInvariant(
  (message) => new UnauthorizedError(message)
);
