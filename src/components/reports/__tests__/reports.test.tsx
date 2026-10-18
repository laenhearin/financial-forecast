// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DEFAULT_SECTIONS } from "@/lib/reports/sections";
import { resolveRange } from "@/lib/reports/dateRange";
import { buildReportData } from "@/lib/reports/buildReportData";
import type { ReportConfig } from "@/lib/reports/types";
import { ReportOptionsPanel } from "../ReportOptionsPanel";
import { ReportPreview } from "../ReportPreview";
import { useReportGenerator } from "../useReportGenerator";
import { renderReport } from "../pdf/renderReport";
vi.mock("../pdf/renderReport", () => ({ renderReport: vi.fn() }));
const today = "2026-10-17";
const initial = (): ReportConfig => ({
  range: resolveRange("last-month", today),
  preset: "last-month",
  sections: { ...DEFAULT_SECTIONS },
  compareToPrevious: true,
});
function Options() {
  const [config, setConfig] = useState(initial);
  return (
    <ReportOptionsPanel
      config={config}
      today={today}
      onChange={setConfig}
      onGenerate={() => {}}
    />
  );
}
function App() {
  const [config, setConfig] = useState(initial);
  const generator = useReportGenerator(config, () =>
    buildReportData({
      config,
      today,
      customerName: "Test",
      sourceLabel: "Test fixture",
      bufferCents: 0,
      snapshotCents: 10000,
      history: [],
      transactions: [],
      forecast: [],
    }),
  );
  return (
    <>
      <ReportOptionsPanel
        config={config}
        today={today}
        onChange={setConfig}
        onGenerate={generator.generate}
        generating={generator.state.status === "generating"}
        stale={generator.stale}
      />
      <ReportPreview
        state={generator.state}
        stale={generator.stale}
        onRetry={generator.generate}
      />
    </>
  );
}
beforeEach(() => {
  vi.mocked(renderReport).mockResolvedValue(
    new Blob(["PDF"], { type: "application/pdf" }),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:report"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("failed", { status: 503 })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("renders defaults, availability, select all and clear all", () => {
  render(<Options />);
  expect(
    (screen.getByLabelText("Range preset") as HTMLSelectElement).value,
  ).toBe("last-month");
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(7);
  expect(
    screen
      .getByRole("checkbox", { name: "Forecast calendar" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(
    screen.getByRole("button", { name: "Generate report" }),
  ).toHaveProperty("disabled", true);
  expect(screen.getByText("Select at least one section")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(10);
});
it("updates presets and rejects an invalid custom range", () => {
  render(<Options />);
  fireEvent.change(screen.getByLabelText("Range preset"), {
    target: { value: "this-month" },
  });
  expect(
    screen
      .getByRole("checkbox", { name: "Forecast calendar" })
      .getAttribute("aria-disabled"),
  ).not.toBe("true");
  fireEvent.change(screen.getByLabelText("Range preset"), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-12-31" },
  });
  expect(screen.getByRole("alert").textContent).toContain("Start date");
  expect(
    screen.getByRole("button", { name: "Generate report" }),
  ).toHaveProperty("disabled", true);
});
it("generates despite summary failure, marks changes stale and releases the blob", async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
  expect(
    await screen.findByRole("link", { name: "Download PDF" }),
  ).toBeTruthy();
  expect(vi.mocked(renderReport).mock.calls[0][0].summary?.source).toBe(
    "fallback",
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Transactions" }));
  expect(
    screen.getByText("Settings changed. Regenerate to update the preview."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy();
  expect(screen.getByTitle("Financial report PDF preview")).toBeTruthy();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");
});
it("shows Retry on PDF failure and recovers", async () => {
  vi.mocked(renderReport).mockRejectedValueOnce(new Error("renderer failed"));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(
    await screen.findByRole("link", { name: "Download PDF" }),
  ).toBeTruthy();
});
it("ignores a renderer result that finishes after unmount", async () => {
  let finish!: (blob: Blob) => void;
  vi.mocked(renderReport).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
  await waitFor(() => expect(renderReport).toHaveBeenCalled());
  view.unmount();
  finish(new Blob());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
