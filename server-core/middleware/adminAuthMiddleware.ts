import { createMiddleware } from "@yotie/micron";
import { unauthorizedInvariant } from "../crosscutting/errorTypes";

const MANAGEMENT_SECRET =
  process.env.MANAGEMENT_SECRET || "managementSecretNotProvided";

export const adminAuth = createMiddleware((micronParams, next) => {
  const token = micronParams.req.headers["authorization"]?.split(" ")[1];

  unauthorizedInvariant(
    token === MANAGEMENT_SECRET,
    "You can't do these kind of actions"
  );

  return next();
});
