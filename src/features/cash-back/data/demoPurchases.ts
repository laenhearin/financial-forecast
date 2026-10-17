// EDIT HERE. Demo card purchases for the Cash Back Maximizer, authored in dollars.
// This is fixture data, not a real customer or live bank data. Alex Rivera matches the Big Purchase
// demo customer. Several gas and grocery purchases sit on the wrong card on purpose, so the
// wrong-card flags and the "money left on the table" total show clearly in the demo.
// Three merchants are not in the keyword list (Lakeside Bowl, Home Depot, Oak Street Barbers),
// so they exercise the AI classifier. Run npm test after editing: the demo-lock test checks the story.

/** Card ids from cards/library.ts. */
type DemoCard = "everyday-1" | "road-rewards" | "market-fresh";
export type DemoPurchaseInput = [date: string, merchant: string, dollars: number, card: DemoCard];

export const DEMO_CUSTOMER = "Alex Rivera";
export const DEMO_AS_OF_DATE = "2026-10-17";
export const DEMO_OWNED_CARD_IDS: DemoCard[] = ["everyday-1", "road-rewards", "market-fresh"];

export const DEMO_PURCHASES: DemoPurchaseInput[] = [
  // Gas: Road Rewards pays 4%, but Alex often grabs the 1% card.
  ["2026-07-22", "Shell", 38.4, "road-rewards"],
  ["2026-07-30", "Exxon", 41.15, "everyday-1"],
  ["2026-08-06", "Chevron", 36.8, "road-rewards"],
  ["2026-08-14", "Wawa", 44.2, "everyday-1"],
  ["2026-08-21", "Shell", 39.75, "market-fresh"],
  ["2026-08-29", "BP", 42.1, "road-rewards"],
  ["2026-09-05", "Shell", 40.6, "everyday-1"],
  ["2026-09-13", "RaceTrac", 37.9, "road-rewards"],
  ["2026-09-20", "Exxon", 45.3, "everyday-1"],
  ["2026-09-27", "Shell", 41.85, "everyday-1"],
  ["2026-10-04", "Chevron", 39.2, "market-fresh"],
  ["2026-10-10", "Wawa", 43.5, "everyday-1"],
  ["2026-10-16", "Shell", 38.95, "road-rewards"],

  // Groceries: Market Fresh pays 3% up to $300 a month.
  ["2026-07-20", "Publix", 96.4, "market-fresh"],
  ["2026-07-26", "Trader Joe's", 72.15, "everyday-1"],
  ["2026-08-02", "Publix", 104.3, "market-fresh"],
  ["2026-08-09", "Aldi", 68.9, "road-rewards"],
  ["2026-08-16", "Publix", 98.75, "market-fresh"],
  ["2026-08-23", "Whole Foods", 84.6, "everyday-1"],
  ["2026-08-30", "Publix", 91.2, "market-fresh"],
  ["2026-09-06", "Kroger", 88.45, "everyday-1"],
  ["2026-09-12", "Publix", 102.8, "market-fresh"],
  ["2026-09-19", "Trader Joe's", 76.3, "everyday-1"],
  ["2026-09-26", "Publix", 95.1, "road-rewards"],
  ["2026-10-03", "Aldi", 71.65, "everyday-1"],
  ["2026-10-09", "Publix", 99.4, "market-fresh"],
  ["2026-10-15", "Whole Foods", 86.25, "everyday-1"],

  // Dining: every card Alex owns pays 1% here, which is what the new-card suggestion picks up on.
  ["2026-07-21", "Chipotle", 14.85, "everyday-1"],
  ["2026-07-24", "Starbucks", 6.75, "everyday-1"],
  ["2026-07-28", "Satchel's Pizza", 38.4, "road-rewards"],
  ["2026-08-01", "Chick-fil-A", 12.6, "everyday-1"],
  ["2026-08-05", "Panera Bread", 16.2, "everyday-1"],
  ["2026-08-08", "Domino's", 27.9, "everyday-1"],
  ["2026-08-12", "Starbucks", 7.25, "market-fresh"],
  ["2026-08-17", "Dragonfly Sushi", 48.6, "everyday-1"],
  ["2026-08-22", "Chipotle", 15.3, "everyday-1"],
  ["2026-08-27", "Starbucks", 6.95, "everyday-1"],
  ["2026-09-02", "Satchel's Pizza", 41.2, "everyday-1"],
  ["2026-09-07", "Panera Bread", 17.45, "road-rewards"],
  ["2026-09-11", "Chick-fil-A", 13.1, "everyday-1"],
  ["2026-09-16", "Starbucks", 7.4, "everyday-1"],
  ["2026-09-21", "Dragonfly Sushi", 52.3, "everyday-1"],
  ["2026-09-25", "Chipotle", 15.75, "everyday-1"],
  ["2026-09-30", "Domino's", 29.4, "everyday-1"],
  ["2026-10-05", "Starbucks", 7.1, "everyday-1"],
  ["2026-10-08", "Satchel's Pizza", 39.8, "everyday-1"],
  ["2026-10-12", "Panera Bread", 18.25, "everyday-1"],
  ["2026-10-14", "Chick-fil-A", 12.95, "road-rewards"],

  // Streaming
  ["2026-07-25", "Netflix", 15.49, "everyday-1"],
  ["2026-08-03", "Spotify", 11.99, "everyday-1"],
  ["2026-08-25", "Netflix", 15.49, "everyday-1"],
  ["2026-09-03", "Spotify", 11.99, "everyday-1"],
  ["2026-09-25", "Netflix", 15.49, "everyday-1"],
  ["2026-10-03", "Spotify", 11.99, "everyday-1"],

  // Online shopping, drugstores, travel
  ["2026-07-31", "Amazon", 54.2, "everyday-1"],
  ["2026-08-19", "Amazon", 32.75, "everyday-1"],
  ["2026-09-09", "Amazon", 61.4, "road-rewards"],
  ["2026-09-29", "Etsy", 28, "everyday-1"],
  ["2026-10-13", "Amazon", 45.9, "everyday-1"],
  ["2026-08-11", "CVS Pharmacy", 23.45, "everyday-1"],
  ["2026-09-23", "Walgreens", 18.7, "everyday-1"],
  ["2026-09-06", "Uber", 18.4, "everyday-1"],
  ["2026-10-01", "Lyft", 14.2, "everyday-1"],

  // Entertainment and other (three merchants here are not in the keyword list)
  ["2026-08-15", "AMC Theatres", 31.5, "everyday-1"],
  ["2026-09-14", "Lakeside Bowl", 42, "everyday-1"],
  ["2026-10-02", "Lakeside Bowl", 38.5, "everyday-1"],
  ["2026-10-11", "Ticketmaster", 68, "everyday-1"],
  ["2026-09-01", "Home Depot", 64.3, "everyday-1"],
  ["2026-08-26", "Oak Street Barbers", 28, "everyday-1"],
  ["2026-10-07", "Oak Street Barbers", 28, "everyday-1"],
];
