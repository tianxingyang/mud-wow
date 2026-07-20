import type { CharacterRepository } from "../../modules/world/character/ports/repository.js";

export const repository: CharacterRepository = {
  load: () => "character",
};
