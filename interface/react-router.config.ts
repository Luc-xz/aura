import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  basename: "/",
  buildDirectory: "dist",
  buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
    console.log("Build completed!");
  },
  ssr: false,
  prerender: [],
} satisfies Config;
