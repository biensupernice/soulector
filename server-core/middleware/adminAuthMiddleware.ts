import { createMiddleware } from "@yotie/micron";
import { unauthorizedInvariant } from "../crosscutting/errorTypes";

export const adminAuth = createMiddleware((micronParams, next) => {
  const token = micronParams.req.headers["authorization"]?.split(" ")[1];

  unauthorizedInvariant(
    token === "secretAdminToken",
    "You can't do these kind of actions"
  );

  return next();
});
