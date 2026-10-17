import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--bp-font-jakarta" });
const inter = Inter({ subsets: ["latin"], variable: "--bp-font-inter" });

/** Font variables plus tokens; also applied to portaled content (dialogs) that renders outside the page root. */
export const bpRootClass = `bp-root ${jakarta.variable} ${inter.variable}`;
