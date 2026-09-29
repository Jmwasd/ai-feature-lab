import { createMemorySavedResultRepository } from "./memory-repository";
import { describeSavedRepositoryContract } from "./repository.contract";

describeSavedRepositoryContract("in-memory", (now) => createMemorySavedResultRepository(now));
