import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";
import { DBURL } from "../../env.ts";

const client = postgres(DBURL, { prepare: false });

export const db = drizzle(client, { schema });