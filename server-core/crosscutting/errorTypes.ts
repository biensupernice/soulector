export function invariant(condition: any, message?: string): asserts condition {
  if (condition) {
    return;
  }
  throw new Error(`${message || ""}`);
}

export class UnauthorizedError extends Error {
  name = "unauthorized_error";
}
export function unauthorizedInvariant(
  condition: any,
  message?: string
): asserts condition {
  if (condition) {
    return;
  }
  throw new UnauthorizedError(`${message || ""}`);
}
