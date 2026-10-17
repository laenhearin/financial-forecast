import { createCn } from "cn/config";

/**
 * Class merging that knows the app's custom text sizes (globals.css --text-*). Without this,
 * cn("text-body", "text-primary") treats text-body as a color and drops it.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["display", "figure", "lead", "body", "caption", "micro"] }] } },
});
