import { Result } from "@expo/results";
import { MicronParams, Response } from "@yotie/micron";
import { UnauthorizedError } from "./errorTypes";

export interface IApiErrorResponse {
  type: string;
  message?: string;
}

export function createErrorResponse(
  type: string,
  message?: string
): IApiErrorResponse {
  return {
    type: type,
    message: message,
  };
}

export function mapErrorToResponse<T extends Error>(
  error: T,
  micronParams: MicronParams
): Response {
  if (error instanceof UnauthorizedError) {
    return micronParams.res
      .status(403)
      .send(createErrorResponse(UnauthorizedError.name, error.message));
  }

  return micronParams.error(error.message);
}

export function responseFromResult<T>(
  serviceResult: Result<T>,
  micronParams: MicronParams
): Response {
  if (serviceResult.ok) {
    return micronParams.ok(serviceResult.value);
  }
  const err = serviceResult.reason;
  return mapErrorToResponse(err, micronParams);
}
