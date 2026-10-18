import { StyleSheet } from "@react-pdf/renderer";
export const colors = { ink: "#20364a", muted: "#64748b", accent: "#245880", pale: "#edf5fa", line: "#dce5ed", good: "#216450", bad: "#832e43", palette: ["#245880", "#216450", "#755915", "#854326", "#832e43", "#4c255e", "#718096"], weather: ["#216450", "#245880", "#755915", "#854326", "#832e43", "#4c255e"] };
export const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 62, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.5, color: colors.ink, backgroundColor: "#ffffff" },
  title: { fontSize: 23, fontFamily: "Helvetica-Bold", marginBottom: 16, color: colors.accent },
  subtitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8 },
  caption: { fontSize: 8, color: colors.muted, marginTop: 7, lineHeight: 1.5 },
  paragraph: { marginBottom: 12, lineHeight: 1.65 },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, borderBottom: `0.5 solid ${colors.line}` },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: colors.muted },
});
