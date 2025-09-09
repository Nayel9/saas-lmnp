import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Audit: s'assurer qu'aucune clé service_role n'est exposée côté client.
 * On vérifie le fichier d'export env.ts et l'absence de motif service_role.
 */

describe("env audit", () => {
  it("n’exporte pas de service_role dans env.ts", () => {
    const file = path.join(process.cwd(), "src", "lib", "env.ts");
    const content = fs.readFileSync(file, "utf8");
    expect(content).not.toMatch(/service_role/i);
  });

  it("NEXT_PUBLIC_* ne contient pas de service_role dans process.env", () => {
    const suspect = Object.keys(process.env).filter(
      (k) => k.startsWith("NEXT_PUBLIC") && /SERVICE_ROLE/i.test(k),
    );
    expect(suspect).toHaveLength(0);
  });
});
