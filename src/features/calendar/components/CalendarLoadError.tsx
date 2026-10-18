import { TriangleAlert } from "lucide-react";
import { panelClass } from "./ui";

/** Shown when the scenario fails to load; lists validation details when there are any. */
export function CalendarLoadError({ message, details, title = "Weather Calendar" }: { message: string; details: string[]; title?: string }) {
  return (
    <div className="mx-auto w-full max-w-300 px-5 py-12 md:px-10">
      <h1 className="page-title">{title}</h1>
      <div role="alert" className={`${panelClass} mt-7 border-neg`}>
        <p className="flex items-center gap-2 text-body font-semibold text-primary">
          <TriangleAlert aria-hidden className="size-4.5 text-neg" strokeWidth={1.75} />
          We couldn&apos;t load your data
        </p>
        <p className="mt-2 text-caption text-secondary">{message}</p>
        {details.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-caption text-secondary">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
