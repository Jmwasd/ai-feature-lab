import { createMemoryTradeRepository } from "./memory-repository";
import { describeTradeRepositoryContract } from "./repository.contract";

describeTradeRepositoryContract("in-memory", () => createMemoryTradeRepository());
