import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import aitDevtools from "@apps-in-toss/devtools/unplugin";

export default defineConfig({
  // 번들 안에서 상대 경로로 파일(예: data/forecast.json)을 찾도록 해요.
  base: "./",
  plugins: [aitDevtools.vite(), react()],
});
