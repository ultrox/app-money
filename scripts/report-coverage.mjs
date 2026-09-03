import { appendFile, readFile } from "node:fs/promises";
import process from "node:process";

const summary = JSON.parse(await readFile("coverage/coverage-summary.json", "utf8"));
const metrics = ["lines", "statements", "functions", "branches"];

const rows = metrics.map((metric) => {
  const value = summary.total[metric];
  return `| ${metric[0].toUpperCase()}${metric.slice(1)} | ${value.covered} / ${value.total} | ${value.pct.toFixed(2)}% |`;
});

const markdown = [
  "## Test coverage",
  "",
  "| Metric | Covered | Coverage |",
  "| --- | ---: | ---: |",
  ...rows,
  "",
  "The full HTML and LCOV reports are available in the `coverage-report` artifact.",
  "",
].join("\n");

process.stdout.write(markdown);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
}
