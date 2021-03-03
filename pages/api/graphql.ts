import { NextApiRequest, NextApiResponse } from "next";
import { gqlserver } from "../../server-core/gqlserver";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default (req: NextApiRequest, res: NextApiResponse) => {
  return gqlserver(req, res);
};
