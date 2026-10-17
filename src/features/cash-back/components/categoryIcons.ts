import { Fuel, Package, Pill, Plane, ShoppingCart, Tag, Ticket, Tv, Utensils, type LucideIcon } from "lucide-react";
import type { Category } from "../types";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  gas: Fuel,
  groceries: ShoppingCart,
  dining: Utensils,
  streaming: Tv,
  travel: Plane,
  drugstores: Pill,
  online: Package,
  entertainment: Ticket,
  other: Tag,
};
