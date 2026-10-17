import "server-only";

/** Raw Nessie fields. Convert money at the application boundary, not in these helpers. */
export interface NessieRecord { _id: string; [field: string]: unknown }
export interface NessieAddress {
  street_number: string; street_name: string; city: string; state: string; zip: string;
}
export type NessieAccountType = "Checking" | "Savings" | "Credit Card";
export type NessieBillStatus = "pending" | "cancelled" | "completed" | "recurring";

function id(value: string): string {
  if (!/^(?:[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(value)) {
    throw new Error("Expected a Nessie record ID (UUID or 24 hexadecimal characters).");
  }
  return encodeURIComponent(value);
}

function date(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("Expected a valid YYYY-MM-DD calendar date.");
  }
  return value;
}

async function request(path: string, method = "GET", body?: object): Promise<unknown> {
  const base = process.env.NESSIE_BASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.NESSIE_API_KEY?.trim();
  if (base !== "https://prod-api.nessieisreal.com") {
    throw new Error("Set NESSIE_BASE_URL=https://prod-api.nessieisreal.com in .env.local.");
  }
  if (!key) throw new Error("Set NESSIE_API_KEY in .env.local.");
  const url = new URL(path, base);
  url.searchParams.set("key", key);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method, headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    text = await response.text();
  } catch {
    // Fetch errors can include the full URL/key. Never forward them or retry a write automatically.
    throw new Error("Nessie network/timeout/redirect failure. Read records before retrying a write.");
  }
  if (!response.ok) throw new Error(`Nessie HTTP ${response.status} (${method}). Upstream body withheld to protect credentials.`);
  if (!text.trim()) return null; // DELETE may return 204; POST may return plain text.
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

async function records(path: string): Promise<NessieRecord[]> {
  const value = await request(path);
  if (!Array.isArray(value) || !value.every(row => row && typeof row === "object" && typeof row._id === "string")) {
    throw new Error("Unexpected Nessie list response; expected records with _id fields.");
  }
  return value;
}

export const getCustomers = () => records("/customers");
export const getCustomerById = (customerId: string) => request(`/customers/${id(customerId)}`);
export const createCustomer = (firstName: string, lastName: string, address: NessieAddress) =>
  request("/customers", "POST", { first_name: firstName, last_name: lastName, address });
export const getCustomerAccounts = (customerId: string) => records(`/customers/${id(customerId)}/accounts`);
export const getAccountById = (accountId: string) => request(`/accounts/${id(accountId)}`);
export const createAccount = (customerId: string, type: NessieAccountType, nickname: string, balance: number, rewards = 0) =>
  request(`/customers/${id(customerId)}/accounts`, "POST", { type, nickname, balance, rewards });
export const updateAccountNickname = (accountId: string, nickname: string) => request(`/accounts/${id(accountId)}`, "PUT", { nickname });
export const deleteAccount = (accountId: string) => request(`/accounts/${id(accountId)}`, "DELETE");
export const getCustomerBills = (customerId: string) => records(`/customers/${id(customerId)}/bills`);
export const getAccountBills = (accountId: string) => records(`/accounts/${id(accountId)}/bills`);
export const createBill = (accountId: string, payee: string, nickname: string, amount: number, paymentDate: string,
  status: NessieBillStatus = "recurring", recurringDate = 1) =>
  request(`/accounts/${id(accountId)}/bills`, "POST", {
    status, payee, nickname, payment_amount: amount, payment_date: date(paymentDate), recurring_date: recurringDate,
  });
export const deleteBill = (billId: string) => request(`/bills/${id(billId)}`, "DELETE");
export const getAccountDeposits = (accountId: string) => records(`/accounts/${id(accountId)}/deposits`);
export const getAccountWithdrawals = (accountId: string) => records(`/accounts/${id(accountId)}/withdrawals`);
export const createDeposit = (accountId: string, amount: number, description: string,
  transactionDate = new Date().toISOString().slice(0, 10), status = "completed") =>
  request(`/accounts/${id(accountId)}/deposits`, "POST", {
    medium: "balance", transaction_date: date(transactionDate), status, amount, description,
  });
/** Fields from the current docs' withdrawal example, verified by the seed's read-back. */
export const createWithdrawal = (accountId: string, amount: number, description: string, transactionDate: string) =>
  request(`/accounts/${id(accountId)}/withdrawals`, "POST", {
    medium: "balance", transaction_date: date(transactionDate), status: "completed", amount, description,
  });
export const getAccountLoans = (accountId: string) => records(`/accounts/${id(accountId)}/loans`);
export const createLoan = (accountId: string, type: string, amount: number, monthlyPayment: number,
  creditScore: number, description: string, status = "approved") =>
  request(`/accounts/${id(accountId)}/loans`, "POST", {
    type, status, credit_score: creditScore, monthly_payment: monthlyPayment, amount, description,
  });
export const getMerchants = () => records("/merchants");
export const getMerchantById = (merchantId: string) => request(`/merchants/${id(merchantId)}`);
export const getPurchaseById = (purchaseId: string) => request(`/purchase/${id(purchaseId)}`);
export const getATMs = () => records("/atms");
export const getBranches = () => records("/branches");
