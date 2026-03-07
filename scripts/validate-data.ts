import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { KNOWN_DATA_FILES, validateDataFile, type ValidationIssue } from "../src/data/schemas.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const dataDir = path.join(workspaceRoot, "public", "data");

function formatIssue(issue: ValidationIssue): string {
  return `- ${issue.file} :: ${issue.path} :: ${issue.message}`;
}

async function main() {
  const dataFiles = (await readdir(dataDir)).filter((name) => name.endsWith(".json")).sort();
  const issues: ValidationIssue[] = [];

  for (const fileName of dataFiles) {
    const fullPath = path.join(dataDir, fileName);
    const raw = await readFile(fullPath, "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      issues.push({
        file: fileName,
        path: fileName,
        message: `Invalid JSON: ${(error as Error).message}`,
      });
      continue;
    }

    issues.push(...validateDataFile(fileName, parsed));
  }

  const unknownSchemaFiles = KNOWN_DATA_FILES.filter((fileName) => !dataFiles.includes(fileName));
  for (const fileName of unknownSchemaFiles) {
    issues.push({
      file: fileName,
      path: fileName,
      message: "Schema registered but JSON file is missing in public/data",
    });
  }

  if (issues.length > 0) {
    console.error("Data validation failed.\n");
    issues.forEach((issue) => console.error(formatIssue(issue)));
    process.exit(1);
  }

  console.log(`Data validation passed for ${dataFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(`Validation crashed: ${(error as Error).message}`);
  process.exit(1);
});
