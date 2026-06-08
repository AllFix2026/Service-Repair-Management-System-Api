import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use process.env to avoid failing commands when DATABASE_URL isn't set in some contexts
    url: process.env.DATABASE_URL ?? "",
    directUrl: process.env.DIRECT_URL ?? "",
  },
});