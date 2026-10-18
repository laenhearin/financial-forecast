import { expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addDays } from "@/lib/dates";
import { buildReportData } from "../buildReportData";
import { DEFAULT_SECTIONS } from "../sections";
import type { ReportTransaction } from "../types";

// Optional integration/performance check; ordinary unit tests mock the heavy renderer.
it.skipIf(process.env.REPORT_PDF_SMOKE !== "1")(
  "renders a full year and caps 1,005 transactions in a real PDF",
  async () => {
    const [{ renderToBuffer }, { ReportDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/reports/pdf/ReportDocument"),
    ]);
    const transactions: ReportTransaction[] = Array.from(
      { length: 1005 },
      (_, i) => ({
        date: addDays("2026-01-01", i % 365),
        kind: i % 10 === 0 ? "income" : "spending",
        amountCents: 10000 + i,
        label: "Test fixture merchant",
        category: `Category ${i % 8}`,
        accountLabel: "Checking",
        accountNumber: "123456789012",
      }),
    );
    const start = performance.now();
    const data = buildReportData({
      config: {
        preset: "this-year",
        range: { start: "2026-01-01", end: "2026-12-31" },
        sections: { ...DEFAULT_SECTIONS, transactions: true },
        compareToPrevious: true,
      },
      today: "2026-12-31",
      customerName: "PDF performance fixture",
      sourceLabel: "Test fixture - not live data",
      snapshotCents: 100000,
      history: [],
      transactions,
      forecast: [],
      bufferCents: 50000,
    });
    const buffer = await renderToBuffer(<ReportDocument data={data} />);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(data.transactions?.rows).toHaveLength(1000);
    expect(data.transactions?.totalCount).toBe(1005);
    expect(JSON.stringify(data)).not.toContain("123456789012");
    await writeFile(join(tmpdir(), "reports-performance.pdf"), buffer);
    await writeFile(
      join(tmpdir(), "reports-performance.json"),
      JSON.stringify({
        elapsedMs: Math.round(performance.now() - start),
        bytes: buffer.length,
      }),
    );
    console.info(
      `Report benchmark: ${Math.round(performance.now() - start)} ms; ${buffer.length} bytes; 1,005 inputs, 1,000 printed rows.`,
    );
  },
  30000,
);
