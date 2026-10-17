import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts", migrate: "src/cli/migrate.ts", "create-admin": "src/cli/create-admin.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  sourcemap: true,
  // The shared package ships as TypeScript source, so it is bundled in; real dependencies stay external.
  noExternal: ["@peterhouse/shared"],
});
