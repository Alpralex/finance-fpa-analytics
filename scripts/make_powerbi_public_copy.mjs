// Builds powerbi/public/AtlanticaFPA_Public: the same report and model without the row-level security roles.
// Power BI "Publish to web" refuses models with RLS, so the public link is published from this copy.
// Run from the repo root after build_powerbi_report.mjs: node scripts/make_powerbi_public_copy.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve("powerbi");
const DST = path.resolve("powerbi/public");
const NAME = "AtlanticaFPA_Public";

fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });
const skip = (p) => /[\\/]\.pbi([\\/]|$)/.test(p);
fs.cpSync(path.join(SRC, "AtlanticaFPA.Report"), path.join(DST, `${NAME}.Report`), { recursive: true, filter: (p) => !skip(p) });
fs.cpSync(path.join(SRC, "AtlanticaFPA.SemanticModel"), path.join(DST, `${NAME}.SemanticModel`), { recursive: true, filter: (p) => !skip(p) });

const model = path.join(DST, `${NAME}.SemanticModel`, "definition");
// Drop the roles and the user-to-entity mapping table, which only serves them.
fs.rmSync(path.join(model, "roles"), { recursive: true, force: true });
fs.rmSync(path.join(model, "tables", "security_entity_access.tmdl"), { force: true });
const modelTmdl = path.join(model, "model.tmdl");
let m = fs.readFileSync(modelTmdl, "utf8");
m = m.split(/\r?\n/).filter((l) => !/^ref role /.test(l) && !/^ref table security_entity_access\s*$/.test(l)).join("\n");
m = m.replace(/,\s*"security_entity_access"/, "");
fs.writeFileSync(modelTmdl, m);
for (const f of fs.readdirSync(path.join(model, "tables"))) {
  const t = fs.readFileSync(path.join(model, "tables", f), "utf8");
  if (t.includes("security_entity_access")) throw new Error(`${f} still references security_entity_access`);
}

// Point the report at the copied model and give both items their own identity.
const pbir = path.join(DST, `${NAME}.Report`, "definition.pbir");
fs.writeFileSync(pbir, fs.readFileSync(pbir, "utf8").replace("../AtlanticaFPA.SemanticModel", `../${NAME}.SemanticModel`));
for (const kind of ["Report", "SemanticModel"]) {
  const p = path.join(DST, `${NAME}.${kind}`, ".platform");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.metadata.displayName = NAME;
  j.config.logicalId = crypto.randomUUID();
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
const pbip = JSON.parse(fs.readFileSync(path.join(SRC, "AtlanticaFPA.pbip"), "utf8"));
pbip.artifacts = [{ report: { path: `${NAME}.Report` } }];
fs.writeFileSync(path.join(DST, `${NAME}.pbip`), JSON.stringify(pbip, null, 2) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), DST)}/${NAME}.pbip`);
