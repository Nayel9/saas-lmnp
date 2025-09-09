import { FullConfig } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";

export default async function globalSetup(_config: FullConfig) {
  const cwd = process.cwd();
  if (process.env.ADMIN_SEED_EMAIL && process.env.ADMIN_SEED_PASSWORD) {
    await runNodeScript(path.join(cwd, "scripts", "ensure-admin.js")).catch(
      (e) => {
        console.warn("[globalSetup] ensure-admin échoué:", e.message);
      },
    );
  } else {
    console.warn(
      "[globalSetup] ADMIN_SEED_EMAIL/PASSWORD absents – un admin éphémère sera créé par les tests.",
    );
  }
}

function runNodeScript(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cp = spawn(process.execPath, [file], { stdio: "inherit" });
    cp.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(file + " exited with code " + code)),
    );
  });
}
