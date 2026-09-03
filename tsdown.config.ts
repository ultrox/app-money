import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    outDir: "dist/core",
    format: "esm",
    target: "es2022",
    platform: "neutral",
    dts: { sourcemap: true },
    minify: true,
    sourcemap: true,
    clean: true,
    deps: {
      onlyBundle: [],
      onlyImport: [],
    },
    tsconfig: "tsconfig.build.json",
  },
  {
    entry: { index: "src/money.effect.ts" },
    outDir: "dist/effect",
    format: "esm",
    target: "es2022",
    platform: "neutral",
    dts: { sourcemap: true },
    minify: true,
    sourcemap: true,
    clean: true,
    deps: {
      onlyBundle: [],
      onlyImport: ["effect"],
    },
    tsconfig: "tsconfig.build.json",
  },
]);
