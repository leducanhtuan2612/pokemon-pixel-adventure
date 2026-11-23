import type { MapDefinition } from "../../world/types";
import { GREENLEAF } from "./greenleaf";

export const MAPS: Record<string, MapDefinition> = {
  [GREENLEAF.id]: GREENLEAF,
};

export const START_MAP_ID = GREENLEAF.id;

export function getMap(id: string | undefined): MapDefinition {
  return (id && MAPS[id]) || MAPS[START_MAP_ID];
}
