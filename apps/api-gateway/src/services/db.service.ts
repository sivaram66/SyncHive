import { createDb } from "@synchive/db";
import { config } from "../config";

export const db = createDb(config.databaseUrl);