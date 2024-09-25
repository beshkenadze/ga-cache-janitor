import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules", "html", "lib", "coverage"],
    root: "./src",
  },
});
