import { pdf } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/reports/types";
import { ReportDocument } from "./ReportDocument";
/** Imported only from the Generate event, never during server rendering. */
export async function renderReport(data: ReportData): Promise<Blob> {
  return pdf(<ReportDocument data={data} />).toBlob();
}
