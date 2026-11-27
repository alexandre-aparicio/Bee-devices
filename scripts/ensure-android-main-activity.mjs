import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const packageName = "net.beeprojects.devices";
const activityPath = join(
  "android",
  "app",
  "src",
  "main",
  "java",
  ...packageName.split("."),
  "MainActivity.java"
);

if (existsSync(activityPath)) {
  console.log("Android MainActivity already exists.");
  process.exit(0);
}

if (!existsSync(join("android", "app", "src", "main", "AndroidManifest.xml"))) {
  console.error(
    "Android platform is not initialized. Run `npx cap add android` first."
  );
  process.exit(1);
}

mkdirSync(dirname(activityPath), { recursive: true });
writeFileSync(
  activityPath,
  `package ${packageName};

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
}
`,
  "utf8"
);

console.log(`Created missing Android activity: ${activityPath}`);
