import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const args = process.argv.slice(2);

const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const root = path.resolve(option("--root") ?? process.cwd());
const shouldCheck = args.includes("--check");
const outputPath = option("--json");
const comparisonPath = option("--compare");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const budget = await readJson(path.join(root, "size-budget.json"));
const comparison = comparisonPath ? await readJson(path.resolve(comparisonPath)) : undefined;

const report = { files: {} };
for (const [relativePath, limits] of Object.entries(budget.files)) {
  const contents = await readFile(path.join(root, relativePath));
  report.files[relativePath] = {
    raw: contents.byteLength,
    gzip: gzipSync(contents, { level: 9 }).byteLength,
    brotli: brotliCompressSync(contents, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).byteLength,
    limits,
  };
}

const bytes = (value) => `${(value / 1000).toFixed(2)} kB`;
const delta = (value) => {
  if (value === undefined) return "n/a";
  if (value === 0) return "—";
  return `${value > 0 ? "+" : "−"}${bytes(Math.abs(value))}`;
};

const rows = [];
const failures = [];
for (const [relativePath, measurements] of Object.entries(report.files)) {
  const previous = comparison?.files?.[relativePath];
  const exceeded = Object.entries(measurements.limits).filter(
    ([metric, limit]) => measurements[metric] > limit,
  );

  for (const [metric, limit] of exceeded) {
    failures.push(
      `${relativePath} ${metric} is ${bytes(measurements[metric])}; budget is ${bytes(limit)}`,
    );
  }

  rows.push(
    `| \`${relativePath}\` | ${bytes(measurements.raw)} | ${bytes(measurements.gzip)} | ${bytes(measurements.brotli)} | ${delta(previous ? measurements.brotli - previous.brotli : undefined)} | ${bytes(measurements.limits.brotli)} | ${exceeded.length === 0 ? "✅" : "❌"} |`,
  );
}

const markdown = [
  "## Bundle size",
  "",
  "| Asset | Raw | gzip | Brotli | Brotli change | Budget | Status |",
  "| --- | ---: | ---: | ---: | ---: | ---: | :---: |",
  ...rows,
  "",
].join("\n");

process.stdout.write(markdown);

if (outputPath) {
  await writeFile(path.resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}

if (shouldCheck && failures.length > 0) {
  process.stderr.write(`\nSize budget exceeded:\n- ${failures.join("\n- ")}\n`);
  process.exitCode = 1;
}
