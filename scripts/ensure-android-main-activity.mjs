import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const activityPath = join(
  "android",
  "app",
  "src",
  "main",
  "java",
  "net",
  "beeprojects",
  "devices",
  "MainActivity.java"
);

if (!existsSync(join("android", "app", "src", "main", "AndroidManifest.xml"))) {
  console.error("Android platform is not initialized. Run: npm run android:add");
  process.exit(1);
}

if (!existsSync(activityPath)) {
  mkdirSync(dirname(activityPath), { recursive: true });
  writeFileSync(
    activityPath,
    [
      "package net.beeprojects.devices;",
      "",
      "import com.getcapacitor.BridgeActivity;",
      "",
      "public class MainActivity extends BridgeActivity {",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  console.log("Created missing Android MainActivity.");
} else {
  console.log("Android MainActivity is present.");
}
