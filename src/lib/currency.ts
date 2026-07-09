const BR_COUNTRIES = new Set(["BR", "BRA", "BRASIL", "BRAZIL"]);
const CO_COUNTRIES = new Set(["CO", "COL", "COLOMBIA"]);
const BRL_TO_EUR_RATE = 0.18;

export type SupportedCurrency = "BRL" | "EUR";

export function inferCurrency(
  rawValue: string | null | undefined,
  country: string | null | undefined,
): SupportedCurrency {
  const normalizedValue = (rawValue ?? "").toUpperCase();
  if (normalizedValue.includes("€") || normalizedValue.includes("EUR")) {
    return "EUR";
  }
  if (normalizedValue.includes("R$") || normalizedValue.includes("BRL")) {
    return "BRL";
  }

  const normalizedCountry = (country ?? "").trim().toUpperCase();
  if (BR_COUNTRIES.has(normalizedCountry)) {
    return "BRL";
  }
  if (CO_COUNTRIES.has(normalizedCountry)) {
    return "EUR";
  }

  return "EUR";
}

export function parseCurrencyAmount(
  rawValue: string | null | undefined,
): number | null {
  if (!rawValue) {
    return null;
  }
  const cleaned = rawValue
    .replace(/[^\d.,-]/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  const commaCount = (normalized.match(/,/g) ?? []).length;
  const dotCount = (normalized.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (commaCount > 0 && dotCount === 0) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const amount = Number(normalized);
  if (Number.isNaN(amount)) {
    return null;
  }
  return amount;
}

export function toEuro(
  rawValue: string | null | undefined,
  country: string | null | undefined,
): number {
  const amount = parseCurrencyAmount(rawValue);
  if (amount === null) {
    return 0;
  }
  const currency = inferCurrency(rawValue, country);
  if (currency === "BRL") {
    return amount * BRL_TO_EUR_RATE;
  }
  return amount;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEuroShort(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
