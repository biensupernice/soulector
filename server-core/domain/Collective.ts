import { v4 } from "uuid";
import { IEntity } from "./Episode";

export interface ICollective extends IEntity {
  name: string;
  logoUrl: string;
  externalProfileUrl: string;
  sourceUrl: string;
}

interface CollectiveOpts {
  name: string;
  logoUrl: string;
  externalProfileUrl: string;
  sourceUrl: string;
}

export function createCollective(opts: CollectiveOpts): Readonly<ICollective> {
  return {
    id: v4(),
    updatedAt: new Date(),
    createdAt: new Date(),
    name: opts.name,
    logoUrl: opts.logoUrl,
    externalProfileUrl: opts.externalProfileUrl,
    sourceUrl: opts.sourceUrl,
  };
}
