import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  // 앱인토스 콘솔에 등록한 appName과 같아야 번들을 업로드할 수 있어요. (변경 불가)
  appName: "tkkmkk",
  webView: {},
  // 위치·사진 같은 기기 권한을 쓰게 되면 여기에 추가해요.
  permissions: [],
  webBundleDir: "dist",
});
