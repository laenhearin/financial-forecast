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
  description: string;
  href: string;
  icon: LucideIcon;
}

/** Sidebar links, in display order. Adding a page means one entry here plus its route folder. */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Home", href: ROUTES.home, icon: Home,
    description: "See your balances, upcoming money changes, and a quick overview of your financial forecast.",
  },
  {
    label: "Weather calendar", href: ROUTES.calendar, icon: CalendarDays,
    description: "Explore daily projected balances, income, bills, and planned purchases to spot tight days ahead.",
  },
  {
    label: "Purchase advisor", href: ROUTES.purchaseAdvisor, icon: ShoppingCart,
    description: "Try a purchase amount and date to see how it could affect your balance before adding it to your calendar.",
  },
  {
    label: "Forecast Fund", href: ROUTES.bigPurchase, icon: Target,
    description: "Plan savings for a bigger purchase, compare deadlines, and see how much to set aside.",
  },
  {
    label: "Storm solver", href: ROUTES.stormSolver, icon: Umbrella,
    description: "Find upcoming cash shortfalls and explore ways to adjust your spending or bill timing.",
  },
  {
    label: "Swipe and Shine", href: ROUTES.cashBack, icon: CreditCard,
    description: "Compare cash-back rewards across your cards and find which card earns the most for each spending category.",
  },
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
