import type { LucideIcon } from "lucide-react";
import { Home, CalendarDays, ShoppingCart, Target, Umbrella, CreditCard } from "lucide-react";

/** Every in-app route. Link to these instead of writing paths inside components. */
export const ROUTES = {
  home: "/",
  profile: "/profile",
  calendar: "/calendar",
  purchaseAdvisor: "/purchase-advisor",
  bigPurchase: "/big-purchase",
  stormSolver: "/storm-solver",
  cashBack: "/cash-back",
} as const;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Sidebar links, in display order. Adding a page means one entry here plus its route folder. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: ROUTES.home, icon: Home },
  { label: "Weather calendar", href: ROUTES.calendar, icon: CalendarDays },
  { label: "Purchase advisor", href: ROUTES.purchaseAdvisor, icon: ShoppingCart },
  { label: "Forecast Fund", href: ROUTES.bigPurchase, icon: Target },
  { label: "Storm solver", href: ROUTES.stormSolver, icon: Umbrella },
  { label: "Swipe and Shine", href: ROUTES.cashBack, icon: CreditCard },
];

/** "/" matches only itself; other items also match their sub-pages ("/big-purchase/new"). */
export function matchesNavHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The single active href for a pathname: the longest matching item, or null. */
export function getActiveHref(pathname: string, items: readonly Pick<NavItem, "href">[] = NAV_ITEMS): string | null {
  let active: string | null = null;
  for (const { href } of items) {
    if (matchesNavHref(pathname, href) && (active === null || href.length > active.length)) active = href;
  }
  return active;
}
