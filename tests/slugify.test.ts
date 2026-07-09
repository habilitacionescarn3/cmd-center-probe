import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("normalizes accented characters", () => {
    expect(slugify("Aplicação de Pagamentos")).toBe("aplicacao-de-pagamentos");
  });

  it("collapses special characters", () => {
    expect(slugify("Checkout//API__v2")).toBe("checkout-api-v2");
  });

  it("trims hyphens at boundaries", () => {
    expect(slugify("--payments--")).toBe("payments");
  });
});
