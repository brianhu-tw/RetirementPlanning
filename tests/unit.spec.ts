import { test, expect, Page } from "@playwright/test";

// Helper: navigate with __TEST__ flag and return the __FIRE__ bridge
async function fire(page: Page) {
  await page.addInitScript(() => {
    (window as any).__TEST__ = true;
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__FIRE__);
  return (fn: string, ...args: any[]) =>
    page.evaluate(
      ([fn, args]) => {
        const f = (window as any).__FIRE__;
        return f[fn](...args);
      },
      [fn, args] as const
    );
}

// Helper: set "current age" by filling birthYear = currentYear - age
async function setAge(page: Page, age: number) {
  const year = new Date().getFullYear() - age;
  await page.locator("#p_birthYear").fill(String(year));
  await page.locator("#p_birthYear").blur();
}

// ─── clamp ───
test.describe("clamp", () => {
  test("clamps below min", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", -5, 0, 100)).toBe(0);
  });

  test("clamps above max", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", 150, 0, 100)).toBe(100);
  });

  test("returns value when in range", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", 50, 0, 100)).toBe(50);
  });

  test("treats NaN as min", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", NaN, 10, 100)).toBe(10);
  });

  test("boundary: exact min", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", 0, 0, 80)).toBe(0);
  });

  test("boundary: exact max", async ({ page }) => {
    const call = await fire(page);
    expect(await call("clamp", 80, 0, 80)).toBe(80);
  });
});

// ─── stripCommas / addCommas ───
test.describe("stripCommas", () => {
  test("removes commas", async ({ page }) => {
    const call = await fire(page);
    expect(await call("stripCommas", "1,234,567")).toBe("1234567");
  });

  test("no-op on plain string", async ({ page }) => {
    const call = await fire(page);
    expect(await call("stripCommas", "500000")).toBe("500000");
  });

  test("empty string", async ({ page }) => {
    const call = await fire(page);
    expect(await call("stripCommas", "")).toBe("");
  });
});

test.describe("addCommas", () => {
  test("formats integer", async ({ page }) => {
    const call = await fire(page);
    expect(await call("addCommas", 1234567)).toBe("1,234,567");
  });

  test("formats with decimal", async ({ page }) => {
    const call = await fire(page);
    expect(await call("addCommas", 1234.56)).toBe("1,234.56");
  });

  test("small number no comma", async ({ page }) => {
    const call = await fire(page);
    expect(await call("addCommas", 999)).toBe("999");
  });

  test("zero", async ({ page }) => {
    const call = await fire(page);
    expect(await call("addCommas", 0)).toBe("0");
  });

  test("negative number", async ({ page }) => {
    const call = await fire(page);
    expect(await call("addCommas", -1234567)).toBe("-1,234,567");
  });
});

// ─── hexAlpha ───
test.describe("hexAlpha", () => {
  test("converts hex to rgba", async ({ page }) => {
    const call = await fire(page);
    expect(await call("hexAlpha", "#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)");
  });

  test("handles blue", async ({ page }) => {
    const call = await fire(page);
    expect(await call("hexAlpha", "#0000ff", 1)).toBe("rgba(0,0,255,1)");
  });

  test("handles without hash", async ({ page }) => {
    const call = await fire(page);
    // The function does replace("#", ""), so without hash should also work
    expect(await call("hexAlpha", "6366f1", 0.19)).toBe("rgba(99,102,241,0.19)");
  });
});

// ─── simulate ───
test.describe("simulate", () => {
  let call: ReturnType<typeof fire> extends Promise<infer R> ? R : never;

  test.beforeEach(async ({ page }) => {
    call = await fire(page);
  });

  test("feasible scenario: high income, low expense", async ({ page }) => {
    // Set DOM values for currentAge
    await setAge(page, 30);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.simulate(50, {
        assets: 0,
        income: 1_000_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      });
    });
    expect(result.feasible).toBe(true);
    expect(result.ages[0]).toBe(30);
    expect(result.ages[result.ages.length - 1]).toBe(90);
    expect(result.reals.length).toBe(result.ages.length);
  });

  test("infeasible scenario: zero income, high expense", async ({ page }) => {
    await setAge(page, 30);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.simulate(40, {
        assets: 100_000,
        income: 0,
        expenses: 500_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      });
    });
    expect(result.feasible).toBe(false);
    expect(result.minPort).toBeLessThan(0);
  });

  test("custom return rate is used", async ({ page }) => {
    await setAge(page, 30);
    const [r1, r2] = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 1_000_000,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      };
      const r1 = f.simulate(50, p, 0.05);
      const r2 = f.simulate(50, p, 0.12);
      return [r1, r2];
    });
    // Higher return rate should yield bigger final portfolio
    const last1 = r1.reals[r1.reals.length - 1];
    const last2 = r2.reals[r2.reals.length - 1];
    expect(last2).toBeGreaterThan(last1);
  });

  test("income override changes the result", async ({ page }) => {
    await setAge(page, 25);
    const [rBase, rOverride] = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 0,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      };
      const rBase = f.simulate(50, p);
      const rOverride = f.simulate(50, p, undefined, {
        startAge: 35,
        amount: 2_000_000,
      });
      return [rBase, rOverride];
    });
    // With income boost at age 35, the portfolio at retirement should be larger
    const retIdx = 50 - 25; // index for age 50
    expect(rOverride.reals[retIdx]).toBeGreaterThan(rBase.reals[retIdx]);
  });
});

// ─── findEarliest ───
test.describe("findEarliest", () => {
  test("returns retirement age for normal scenario", async ({ page }) => {
    const call = await fire(page);
    // Set age to 25
    await setAge(page, 25);
    const earliest = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.findEarliest({
        assets: 500_000,
        income: 1_000_000,
        expenses: 400_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 80,
      });
    });
    expect(earliest).toBeGreaterThanOrEqual(25);
    expect(earliest).toBeLessThan(80);
  });

  test("returns null when retirement is impossible", async ({ page }) => {
    await fire(page);
    await setAge(page, 30);
    const earliest = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.findEarliest({
        assets: 0,
        income: 300_000,
        expenses: 600_000,
        nomReturn: 0.02,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 80,
      });
    });
    expect(earliest).toBeNull();
  });

  test("boundary: already wealthy enough to retire immediately", async ({ page }) => {
    await fire(page);
    await setAge(page, 40);
    const earliest = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.findEarliest({
        assets: 100_000_000,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 80,
      });
    });
    expect(earliest).toBe(40); // can retire right now
  });
});

// ─── calcYearLoanPayment ───
test.describe("calcYearLoanPayment", () => {
  test("empty loans returns 0", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcYearLoanPayment", [], 0)).toBe(0);
  });

  test("null/undefined loans returns 0", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcYearLoanPayment", null, 0)).toBe(0);
    expect(await call("calcYearLoanPayment", undefined, 0)).toBe(0);
  });

  test("single loan full year (12 months active)", async ({ page }) => {
    const call = await fire(page);
    // balance=4,800,000 at 0% for 240 months → mp=20,000; yearIndex=0 → active=12
    const loans = [{ name: "房貸", balance: 4_800_000, rate: 0, remainingMonths: 240 }];
    expect(await call("calcYearLoanPayment", loans, 0)).toBe(20000 * 12);
  });

  test("loan expires mid-first-year", async ({ page }) => {
    const call = await fire(page);
    // balance=60,000 at 0% for 6 months → mp=10,000; yearIndex=0 → active=min(12,6)=6
    const loans = [{ name: "信貸", balance: 60_000, rate: 0, remainingMonths: 6 }];
    expect(await call("calcYearLoanPayment", loans, 0)).toBe(10000 * 6);
  });

  test("loan already expired", async ({ page }) => {
    const call = await fire(page);
    // balance=90,000 at 0% for 6 months → mp=15,000; yearIndex=1 → monthStart=12 > 6 → 0
    const loans = [{ name: "已還清", balance: 90_000, rate: 0, remainingMonths: 6 }];
    expect(await call("calcYearLoanPayment", loans, 1)).toBe(0);
  });

  test("loan partially active in second year", async ({ page }) => {
    const call = await fire(page);
    // balance=75,000 at 0% for 15 months → mp=5,000; yearIndex=1 → monthStart=12, active=min(12,15-12)=3
    const loans = [{ name: "車貸", balance: 75_000, rate: 0, remainingMonths: 15 }];
    expect(await call("calcYearLoanPayment", loans, 1)).toBe(5000 * 3);
  });

  test("multiple loans sum correctly", async ({ page }) => {
    const call = await fire(page);
    const loans = [
      { name: "房貸", balance: 4_800_000, rate: 0, remainingMonths: 240 },
      { name: "信貸", balance: 60_000, rate: 0, remainingMonths: 6 },
    ];
    // yearIndex=0: loan1 active=12 (mp=20000), loan2 active=6 (mp=10000)
    expect(await call("calcYearLoanPayment", loans, 0)).toBe(20000 * 12 + 10000 * 6);
  });

  test("integer years work correctly", async ({ page }) => {
    const call = await fire(page);
    // balance=240,000 at 0% for 24 months → mp=10,000; yearIndex=1 → active=12
    const loans = [{ name: "信貸", balance: 240_000, rate: 0, remainingMonths: 24 }];
    expect(await call("calcYearLoanPayment", loans, 1)).toBe(10000 * 12);
    // yearIndex=2 → monthStart=24, active=max(0,24-24)=0
    expect(await call("calcYearLoanPayment", loans, 2)).toBe(0);
  });
});

test.describe("calcYearLoanPayment precise fallback to monthlyPayment", () => {
  test("balance=0 + monthlyPayment>0 → uses monthlyPayment (simple→precise switch)", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40_000, balance: 0, rate: 0, remainingMonths: 240 }];
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(40_000 * 12);
  });

  test("balance=0 + monthlyPayment=0 → 0", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ balance: 0, rate: 0, remainingMonths: 240, monthlyPayment: 0 }];
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(0);
  });

  test("balance>0 ignores monthlyPayment (balance/rate wins)", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ balance: 4_800_000, rate: 0, remainingMonths: 240, monthlyPayment: 99_999 }];
    // Computed from balance: 4_800_000/240 = 20_000 monthly
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(20_000 * 12);
  });

  test("balance=0 + monthlyPayment>0 expires at remainingMonths boundary", async ({ page }) => {
    const call = await fire(page);
    // 6 months remaining, monthlyPayment 10000 → year 0 = 60k, year 1 = 0
    const loans = [{ monthlyPayment: 10_000, balance: 0, rate: 0, remainingMonths: 6 }];
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(60_000);
    expect(await call("calcYearLoanPayment", loans, 1, "precise")).toBe(0);
  });
});

// ─── simulate with loans ───
test.describe("simulate with loans", () => {
  test("loans reduce portfolio compared to no-loans", async ({ page }) => {
    await fire(page);
    await setAge(page, 30);
    const [noLoan, withLoan] = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 1_000_000,
        income: 1_000_000,
        expenses: 400_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      };
      const loans = [{ name: "房貸", balance: 4_800_000, rate: 0, remainingMonths: 240 }];
      const noLoan = f.simulate(50, p);
      const withLoan = f.simulate(50, p, undefined, undefined, loans);
      return [noLoan, withLoan];
    });
    // With loans, portfolio should be smaller at every point
    const retIdx = 50 - 30;
    expect(withLoan.reals[retIdx]).toBeLessThan(noLoan.reals[retIdx]);
  });

  test("simulate returns yearLoanPayments array", async ({ page }) => {
    await fire(page);
    await setAge(page, 30);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 0,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      };
      const loans = [{ name: "信貸", balance: 300_000, rate: 0, remainingMonths: 30 }];
      return f.simulate(50, p, undefined, undefined, loans);
    });
    expect(result.yearLoanPayments).toBeDefined();
    expect(result.yearLoanPayments.length).toBe(result.ages.length);
    // Year 0: full 12 months → 120000
    expect(result.yearLoanPayments[0]).toBe(120000);
    // Year 2: remainingMonths=30, monthStart=24, active=min(12,6)=6
    expect(result.yearLoanPayments[2]).toBe(60000);
    // Year 3: monthStart=36 > 30 → 0
    expect(result.yearLoanPayments[3]).toBe(0);
  });

  test("expGrowRate increases expenses beyond pure inflation", async ({ page }) => {
    await fire(page);
    await setAge(page, 30);
    const [noGrow, withGrow] = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const base = {
        assets: 1_000_000,
        income: 1_000_000,
        expenses: 400_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        expGrowRate: 0,
        deathAge: 90,
      };
      const grow = { ...base, expGrowRate: 0.02 };
      const noGrow = f.simulate(50, base);
      const withGrow = f.simulate(50, grow);
      return [noGrow, withGrow];
    });
    // With expGrowRate, year 10 expense should be larger
    expect(withGrow.yearExpenses[10]).toBeGreaterThan(noGrow.yearExpenses[10]);
    // And portfolio should be smaller
    expect(withGrow.reals[10]).toBeLessThan(noGrow.reals[10]);
  });

  test("loan payments are not inflation-adjusted", async ({ page }) => {
    await fire(page);
    await setAge(page, 30);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 5_000_000,
        income: 1_000_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.05,
        incGrowRate: 0,
        deathAge: 90,
      };
      const loans = [{ name: "房貸", balance: 4_800_000, rate: 0, remainingMonths: 240 }];
      return f.simulate(50, p, undefined, undefined, loans);
    });
    // Loan payment should be the same nominal amount every year (240000)
    // for years where the loan is fully active
    expect(result.yearLoanPayments[0]).toBe(240000);
    expect(result.yearLoanPayments[5]).toBe(240000);
    expect(result.yearLoanPayments[10]).toBe(240000);
  });
});

// ─── findEarliest with loans ───
test.describe("findEarliest with loans", () => {
  test("loans delay retirement age", async ({ page }) => {
    await fire(page);
    await setAge(page, 25);
    const [noLoan, withLoan] = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const p = {
        assets: 500_000,
        income: 1_000_000,
        expenses: 400_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 80,
      };
      const loans = [{ name: "房貸", balance: 6_000_000, rate: 0, remainingMonths: 240 }];
      const noLoan = f.findEarliest(p);
      const withLoan = f.findEarliest(p, undefined, undefined, loans);
      return [noLoan, withLoan];
    });
    expect(noLoan).not.toBeNull();
    expect(withLoan).not.toBeNull();
    expect(withLoan).toBeGreaterThan(noLoan);
  });
});

// ─── calcMonthlyPayment ───
test.describe("calcMonthlyPayment", () => {
  test("zero interest: balance / total months", async ({ page }) => {
    const call = await fire(page);
    // 100萬, 0% rate, 10 years → 100萬 / 120 = 8333
    expect(await call("calcMonthlyPayment", 1_000_000, 0, 10)).toBe(8333);
  });

  test("normal interest rate", async ({ page }) => {
    const call = await fire(page);
    // 800萬, 2.1%, 20 years → standard amortization formula
    const result = await call("calcMonthlyPayment", 8_000_000, 0.021, 20);
    // Expected: ~40,618 (verified with standard mortgage calculator)
    expect(result).toBeGreaterThan(40000);
    expect(result).toBeLessThan(42000);
  });

  test("zero balance returns 0", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcMonthlyPayment", 0, 0.05, 10)).toBe(0);
  });

  test("negative balance returns 0", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcMonthlyPayment", -100, 0.05, 10)).toBe(0);
  });

  test("zero years returns 0", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcMonthlyPayment", 1_000_000, 0.05, 0)).toBe(0);
  });

  test("negative rate treated as zero interest", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcMonthlyPayment", 1_200_000, -0.01, 10)).toBe(10000);
  });

  test("short loan: 1 year at 5%", async ({ page }) => {
    const call = await fire(page);
    // 120萬, 5%, 1 year (12 months)
    const result = await call("calcMonthlyPayment", 1_200_000, 0.05, 1);
    // Should be close to 102,728
    expect(result).toBeGreaterThan(102000);
    expect(result).toBeLessThan(103000);
  });
});

// ─── calcYearLoanPayment with mode ───
test.describe("calcYearLoanPayment with mode", () => {
  test("mode='simple' uses monthlyPayment directly", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    // simple mode: 40000 * 12 = 480000
    expect(await call("calcYearLoanPayment", loans, 0, "simple")).toBe(40000 * 12);
  });

  test("mode=undefined backward-compat uses balance/rate (precise)", async ({ page }) => {
    const call = await fire(page);
    // balance=4,800,000 at 0% for 240 months → mp=20,000; yearIndex=0 → 20000*12
    const loans = [{ name: "房貸", monthlyPayment: 99999, balance: 4_800_000, rate: 0, remainingMonths: 240 }];
    expect(await call("calcYearLoanPayment", loans, 0)).toBe(20000 * 12);
  });

  test("mode='simple' respects remainingMonths expiry", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "信貸", monthlyPayment: 10000, balance: 0, rate: 0, remainingMonths: 6 }];
    // yearIndex=0: active=min(12,6)=6 → 10000*6=60000
    expect(await call("calcYearLoanPayment", loans, 0, "simple")).toBe(10000 * 6);
    // yearIndex=1: monthStart=12 > 6 → 0
    expect(await call("calcYearLoanPayment", loans, 1, "simple")).toBe(0);
  });
});

// ─── simulate with explicit startAge (pure function) ───
test.describe("simulate with startAge param", () => {
  test("uses p.startAge instead of DOM when provided", async ({ page }) => {
    await fire(page);
    // Set DOM age to 30 but pass startAge 40 in params
    await setAge(page, 30);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.simulate(50, {
        assets: 1_000_000,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
        startAge: 40,
      });
    });
    // Should start from age 40, not 30
    expect(result.ages[0]).toBe(40);
    expect(result.ages.length).toBe(51); // 40..90 inclusive
  });

  test("falls back to currentAge() when startAge is omitted", async ({ page }) => {
    await fire(page);
    await setAge(page, 25);
    const result = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      return f.simulate(50, {
        assets: 0,
        income: 500_000,
        expenses: 300_000,
        nomReturn: 0.07,
        inflation: 0.03,
        incGrowRate: 0,
        deathAge: 90,
      });
    });
    // Should still start from DOM age 25
    expect(result.ages[0]).toBe(25);
  });
});

// ─── c3Returns ───
test.describe("c3Returns", () => {
  test("returns base ±2%", async ({ page }) => {
    const call = await fire(page);
    const result = await call("c3Returns", { nomReturn: 0.07 }) as number[];
    expect(result[0]).toBeCloseTo(0.05, 10);
    expect(result[1]).toBeCloseTo(0.07, 10);
    expect(result[2]).toBeCloseTo(0.09, 10);
  });

  test("handles 0% return", async ({ page }) => {
    const call = await fire(page);
    const result = await call("c3Returns", { nomReturn: 0 }) as number[];
    expect(result[0]).toBeCloseTo(-0.02, 10);
    expect(result[1]).toBeCloseTo(0, 10);
    expect(result[2]).toBeCloseTo(0.02, 10);
  });

  test("handles 15% return", async ({ page }) => {
    const call = await fire(page);
    const result = await call("c3Returns", { nomReturn: 0.15 }) as number[];
    expect(result[0]).toBeCloseTo(0.13, 10);
    expect(result[1]).toBeCloseTo(0.15, 10);
    expect(result[2]).toBeCloseTo(0.17, 10);
  });
});

// ─── escAttr ───
test.describe("escAttr", () => {
  test("escapes &, \", <, >", async ({ page }) => {
    const call = await fire(page);
    expect(await call("escAttr", '&"<>')).toBe("&amp;&quot;&lt;&gt;");
  });

  test("passes through normal text unchanged", async ({ page }) => {
    const call = await fire(page);
    expect(await call("escAttr", "hello 前年 123")).toBe("hello 前年 123");
  });
});

// ─── buildLoanFormula ───
test.describe("buildLoanFormula", () => {
  test("single loan full year in simple mode", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    const result = await call("buildLoanFormula", loans, 0, "simple");
    expect(result).toContain("房貸");
    expect(result).toContain("40,000/月");
    expect(result).toContain("12月");
    expect(result).toContain("480,000");
  });

  test("single loan partial year", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "信貸", monthlyPayment: 10000, balance: 60000, rate: 0, remainingMonths: 6 }];
    const result = await call("buildLoanFormula", loans, 0, "simple");
    expect(result).toContain("信貸");
    expect(result).toContain("10,000/月");
    expect(result).toContain("6月");
    expect(result).toContain("60,000");
  });

  test("multiple loans show per-loan breakdown and total", async ({ page }) => {
    const call = await fire(page);
    const loans = [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 },
      { name: "信貸", monthlyPayment: 10000, balance: 0, rate: 0, remainingMonths: 36 },
    ];
    const result = await call("buildLoanFormula", loans, 0, "simple");
    expect(result).toContain("房貸");
    expect(result).toContain("信貸");
    expect(result).toContain("合計");
    expect(result).toContain("600,000"); // 480,000 + 120,000
  });

  test("loan expired returns empty string", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "已還清", monthlyPayment: 10000, balance: 0, rate: 0, remainingMonths: 6 }];
    const result = await call("buildLoanFormula", loans, 1, "simple");
    expect(result).toBe("");
  });

  test("empty array returns empty string", async ({ page }) => {
    const call = await fire(page);
    expect(await call("buildLoanFormula", [], 0, "simple")).toBe("");
  });

  test("precise mode uses calculated monthly payment", async ({ page }) => {
    const call = await fire(page);
    // balance=4,800,000 at 0% for 240 months → mp=20,000 (calculated)
    const loans = [{ name: "房貸", monthlyPayment: 99999, balance: 4_800_000, rate: 0, remainingMonths: 240 }];
    const result = await call("buildLoanFormula", loans, 0, "precise");
    expect(result).toContain("房貸");
    expect(result).toContain("20,000/月"); // calculated, not 99,999
    expect(result).toContain("240,000");   // 20,000 * 12
  });
});

// ─── calcGraceMonthlyPaymentRange (按日計息範圍) ───
test.describe("calcGraceMonthlyPaymentRange", () => {
  test("回傳 28/31 天範圍 (中信房貸案例)", async ({ page }) => {
    const call = await fire(page);
    // 4,686,026 × 0.0219 / 365 = 281.1615 daily
    // min (28 days) = round(281.1615 × 28) = 7,873
    // max (31 days) = round(281.1615 × 31) = 8,716
    const result = await call("calcGraceMonthlyPaymentRange", 4_686_026, 0.0219);
    expect(result).toEqual({ min: 7873, max: 8716 });
  });

  test("min 永遠小於 max（28 < 31 天）", async ({ page }) => {
    const call = await fire(page);
    const r = await call("calcGraceMonthlyPaymentRange", 8_000_000, 0.021) as { min: number; max: number };
    expect(r.min).toBeLessThan(r.max);
  });

  test("balance = 0 → {0, 0}", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcGraceMonthlyPaymentRange", 0, 0.0219)).toEqual({ min: 0, max: 0 });
  });

  test("rate = 0 → {0, 0}", async ({ page }) => {
    const call = await fire(page);
    expect(await call("calcGraceMonthlyPaymentRange", 5_000_000, 0)).toEqual({ min: 0, max: 0 });
  });

  test("年度總額 = balance × rate（28/30/31 天加總後）", async ({ page }) => {
    const call = await fire(page);
    // 平年: 7 × 31天 + 4 × 30天 + 1 × 28天 = 365 天
    // daily = balance × rate / 365
    // 年總 = daily × 365 = balance × rate
    const balance = 5_000_000;
    const rate = 0.02;
    const r = await call("calcGraceMonthlyPaymentRange", balance, rate) as { min: number; max: number };
    const daily = balance * rate / 365;
    const m30 = Math.round(daily * 30);
    // 加總 = min × 1 + max × 7 + m30 × 4 ≈ balance × rate
    const annual = r.min * 1 + r.max * 7 + m30 * 4;
    const expected = balance * rate;
    // 允許進位誤差 ≤ 12 元（每月最多 ±0.5 元 × 12）
    expect(Math.abs(annual - expected)).toBeLessThanOrEqual(12);
  });
});

// ─── preciseAnnualPaymentText (precise 模式年繳顯示) ───
test.describe("preciseAnnualPaymentText", () => {
  test("無寬限：回傳年繳 = 月繳 × 12", async ({ page }) => {
    const call = await fire(page);
    // 4,800,000 / 240 = 20,000/月 (利率 0)，年繳 = 240,000
    const loan = { name: "房貸", balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toContain("240,000");
    expect(result).not.toContain("寬限");
  });

  test("有寬限：寬限期年繳 = balance × rate，之後 = monthly × 12", async ({ page }) => {
    const call = await fire(page);
    // 寬限年繳 = 6,000,000 × 0.02 = 120,000
    const loan = { name: "房貸", balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toContain("寬限");
    expect(result).toContain("之後");
    expect(result).toContain("120,000");
  });

  test("中信案例（4,686,026 / 2.19%）寬限年繳 = 102,624", async ({ page }) => {
    const call = await fire(page);
    const loan = { name: "房貸", balance: 4_686_026, rate: 0.0219, remainingMonths: 326, gracePeriodMonths: 36 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toContain("102,624");
  });

  test("balance=0 + monthlyPayment>0 (legacy)：回傳 monthlyPayment × 12", async ({ page }) => {
    const call = await fire(page);
    const loan = { name: "信貸", monthlyPayment: 12000, balance: 0, rate: 0, remainingMonths: 60 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toContain("144,000");
  });

  test("空資料 → 回傳 —", async ({ page }) => {
    const call = await fire(page);
    const loan = { name: "新貸款", balance: 0, rate: 0, remainingMonths: 0, gracePeriodMonths: 0 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toBe("—");
  });

  test("寬限期 >= 剩餘期數 → 只顯示寬限年繳，不顯示「之後」", async ({ page }) => {
    const call = await fire(page);
    // rm=1, gp=1 → 整個貸款都在寬限期
    const loan = { name: "短貸", balance: 1_000_000, rate: 0.01, remainingMonths: 1, gracePeriodMonths: 1 };
    const result = await call("preciseAnnualPaymentText", loan) as string;
    expect(result).toContain("寬限");
    expect(result).toContain("10,000");
    expect(result).not.toContain("之後");
  });
});

// ─── buildMonthlyTooltip (年繳旁的月繳等價值 tooltip) ───
test.describe("buildMonthlyTooltip", () => {
  test("無寬限：回傳「≈ X/月」", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 };
    const result = await call("buildMonthlyTooltip", loan) as string;
    expect(result).toContain("≈");
    expect(result).toContain("/月");
    expect(result).toContain("20,000");
    expect(result).not.toContain("寬限");
  });

  test("有寬限：回傳「寬限 ≈ A/月 → 之後 ≈ B/月」", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 };
    const result = await call("buildMonthlyTooltip", loan) as string;
    expect(result).toContain("寬限");
    expect(result).toContain("之後");
    expect(result).toContain("/月");
    // grace monthly = 6,000,000 × 0.02 / 12 = 10,000
    expect(result).toContain("10,000");
  });

  test("balance=0 + monthlyPayment>0 (legacy)：回傳 ≈ monthlyPayment/月", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 0, monthlyPayment: 12000, rate: 0, remainingMonths: 60 };
    const result = await call("buildMonthlyTooltip", loan) as string;
    expect(result).toContain("12,000");
    expect(result).toContain("/月");
  });

  test("空資料：回傳空字串", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 0, rate: 0, remainingMonths: 0 };
    expect(await call("buildMonthlyTooltip", loan)).toBe("");
  });

  test("寬限期 >= 剩餘期數 → tooltip 只顯示寬限月繳", async ({ page }) => {
    const call = await fire(page);
    // rm=1, gp=1 → 整個貸款都在寬限期
    const loan = { balance: 1_000_000, rate: 0.01, remainingMonths: 1, gracePeriodMonths: 1 };
    const result = await call("buildMonthlyTooltip", loan) as string;
    // 寬限月繳 = 1,000,000 × 0.01 / 12 = 833
    expect(result).toContain("833");
    expect(result).not.toContain("之後");
  });
});

// ─── calcYearLoanPayment with grace period ───
test.describe("calcYearLoanPayment with grace period", () => {
  test("全年寬限期 → 只付利息", async ({ page }) => {
    const call = await fire(page);
    // balance=6,000,000, rate=2%, grace=36 months, remaining=240
    // 寬限期月付 = 6,000,000 × 0.02 / 12 = 10,000
    // yearIndex=0 → 12 months all in grace → 10,000 × 12 = 120,000
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 }];
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(120_000);
  });

  test("寬限期跨年 — 部分寬限、部分正常攤還", async ({ page }) => {
    const call = await fire(page);
    // grace=6 months, remaining=240, balance=4,800,000, rate=0%
    // 寬限期月付 = 4,800,000 × 0 / 12 = 0
    // 正常期月付 = calcMonthlyPayment(4,800,000, 0, (240-6)/12) = 4,800,000 / 234 ≈ 20,513 → Math.round
    // yearIndex=0: 6 months grace (0 each) + 6 months normal (20,513 each)
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 6 }];
    const result = await call("calcYearLoanPayment", loans, 0, "precise");
    // 正常期月付 = round(4,800,000 / 234) = 20,513
    const normalMp = Math.round(4_800_000 / 234);
    expect(result).toBe(normalMp * 6);
  });

  test("寬限期已過 — 整年正常攤還", async ({ page }) => {
    const call = await fire(page);
    // grace=12, remaining=240 → yearIndex=1 (monthStart=12) → grace已結束
    // 正常期月付 = calcMonthlyPayment(balance, rate, (240-12)/12)
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 12 }];
    const result = await call("calcYearLoanPayment", loans, 1, "precise");
    const normalMp = Math.round(4_800_000 / ((240 - 12)));
    expect(result).toBe(normalMp * 12);
  });

  test("gracePeriodMonths=0 等同無寬限期（回歸）", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 }];
    const withGrace = await call("calcYearLoanPayment", loans, 0, "precise");
    const loansNoField = [{ name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240 }];
    const without = await call("calcYearLoanPayment", loansNoField, 0, "precise");
    expect(withGrace).toBe(without);
  });

  test("simple 模式忽略寬限期", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 }];
    // simple mode: always uses monthlyPayment regardless of grace
    expect(await call("calcYearLoanPayment", loans, 0, "simple")).toBe(40000 * 12);
  });

  test("寬限期 >= 剩餘期數 → 全部只付利息", async ({ page }) => {
    const call = await fire(page);
    // grace=240 = remaining=240 → 全部都在寬限期
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 240 }];
    // 月付 = 6,000,000 × 0.02 / 12 = 10,000
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(10_000 * 12);
    // yearIndex=19 (last year, monthStart=228, active=12): still grace
    expect(await call("calcYearLoanPayment", loans, 19, "precise")).toBe(10_000 * 12);
  });

  test("0% 利率寬限期 → 月付 = 0", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 5_000_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 24 }];
    // yearIndex=0: grace period, rate=0 → interest = 0
    expect(await call("calcYearLoanPayment", loans, 0, "precise")).toBe(0);
  });

  test("貸款已結束仍返回 0", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 6_000_000, rate: 0.02, remainingMonths: 12, gracePeriodMonths: 6 }];
    // yearIndex=1: monthStart=12 >= remainingMonths=12 → active=0
    expect(await call("calcYearLoanPayment", loans, 1, "precise")).toBe(0);
  });
});

// ─── buildLoanFormula with grace period ───
test.describe("buildLoanFormula with grace period", () => {
  test("寬限期內顯示利息範圍（依當月天數）", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 }];
    const result = await call("buildLoanFormula", loans, 0, "precise");
    expect(result).toContain("寬限");
    // daily = 6,000,000 × 0.02 / 365 = 328.767
    // min (28 days) = round(328.767 × 28) = 9,205
    // max (31 days) = round(328.767 × 31) = 10,192
    expect(result).toContain("9,205");
    expect(result).toContain("10,192");
    expect(result).toContain("~");
  });

  test("跨年時分段顯示寬限 + 攤還", async ({ page }) => {
    const call = await fire(page);
    // grace=6, yearIndex=0 → 6 months grace + 6 months normal
    const loans = [{ name: "房貸", monthlyPayment: 0, balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 6 }];
    const result = await call("buildLoanFormula", loans, 0, "precise");
    expect(result).toContain("寬限");
    expect(result).toContain("6月");
  });

  test("無寬限期時 formula 不變（回歸）", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 }];
    const resultWith = await call("buildLoanFormula", loans, 0, "simple");
    const loansNoField = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    const resultWithout = await call("buildLoanFormula", loansNoField, 0, "simple");
    expect(resultWith).toBe(resultWithout);
  });
});

test.describe("advanceLoanByMonths", () => {
  test("N=0 → loan unchanged", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 5_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 0, monthlyPayment: 0 };
    const r = await call("advanceLoanByMonths", loan, 0) as any;
    expect(r.balance).toBe(5_000_000);
    expect(r.remainingMonths).toBe(240);
    expect(r.gracePeriodMonths).toBe(0);
  });

  test("simple mode: only remainingMonths decreases", async ({ page }) => {
    const call = await fire(page);
    const loan = { monthlyPayment: 40_000, balance: 0, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 };
    const r = await call("advanceLoanByMonths", loan, 3) as any;
    expect(r.remainingMonths).toBe(237);
    expect(r.monthlyPayment).toBe(40_000);
    expect(r.balance).toBe(0);
  });

  test("precise mode no grace: balance reduced by principal, remainingMonths decreases", async ({ page }) => {
    const call = await fire(page);
    // 0% rate, 240 months, 4.8M balance → monthly = 20,000 (all principal)
    const loan = { balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 };
    const r = await call("advanceLoanByMonths", loan, 12) as any;
    const amortPmt = Math.round(4_800_000 / 240);
    expect(r.balance).toBeCloseTo(4_800_000 - amortPmt * 12, -2);
    expect(r.remainingMonths).toBe(228);
    expect(r.gracePeriodMonths).toBe(0);
  });

  test("precise mode with grace: grace consumed, balance unchanged", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 6_000_000, rate: 0.02, remainingMonths: 240, gracePeriodMonths: 36 };
    const r = await call("advanceLoanByMonths", loan, 6) as any;
    expect(r.balance).toBe(6_000_000); // grace = no balance change
    expect(r.gracePeriodMonths).toBe(30);
    expect(r.remainingMonths).toBe(234);
  });

  test("precise mode crossing grace boundary: grace then amortize", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 6 };
    const r = await call("advanceLoanByMonths", loan, 12) as any;
    // 6 grace + 6 amortize at calcMonthlyPayment(4.8M, 0, 234/12) = round(4.8M/234)
    const amortPmt = Math.round(4_800_000 / 234);
    expect(r.balance).toBeCloseTo(4_800_000 - amortPmt * 6, -2);
    expect(r.remainingMonths).toBe(228);
    expect(r.gracePeriodMonths).toBe(0);
  });

  test("precise fallback (balance=0, monthlyPayment>0): only remainingMonths decreases", async ({ page }) => {
    const call = await fire(page);
    const loan = { monthlyPayment: 40_000, balance: 0, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 };
    const r = await call("advanceLoanByMonths", loan, 5) as any;
    expect(r.remainingMonths).toBe(235);
    expect(r.balance).toBe(0);
    expect(r.monthlyPayment).toBe(40_000);
  });

  test("N >= remainingMonths → loan ends (balance=0, remaining=0)", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 100_000, rate: 0, remainingMonths: 5, gracePeriodMonths: 0 };
    const r = await call("advanceLoanByMonths", loan, 10) as any;
    expect(r.remainingMonths).toBe(0);
    expect(r.balance).toBe(0);
  });

  test("preserves unrelated fields (name, _touched)", async ({ page }) => {
    const call = await fire(page);
    const loan = {
      name: "信貸", balance: 600_000, rate: 0, remainingMonths: 60,
      gracePeriodMonths: 0, _touched: ["balance", "rate", "remainingMonths"]
    };
    const r = await call("advanceLoanByMonths", loan, 3) as any;
    expect(r.name).toBe("信貸");
    expect(r._touched).toEqual(["balance", "rate", "remainingMonths"]);
  });

  test("N < 0 → loan unchanged (no rollback support)", async ({ page }) => {
    const call = await fire(page);
    const loan = { balance: 1_000_000, rate: 0, remainingMonths: 100, gracePeriodMonths: 0 };
    const r = await call("advanceLoanByMonths", loan, -2) as any;
    expect(r.balance).toBe(1_000_000);
    expect(r.remainingMonths).toBe(100);
  });
});

test.describe("buildLoanFormula empty name fallback", () => {
  test("uses '未命名貸款' when loan.name is empty", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 }];
    const result = await call("buildLoanFormula", loans, 0, "simple") as string;
    expect(result).toContain("未命名貸款");
  });

  test("uses '未命名貸款' when loan.name is missing entirely", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    const result = await call("buildLoanFormula", loans, 0, "simple") as string;
    expect(result).toContain("未命名貸款");
  });

  test("uses real name when provided (no fallback)", async ({ page }) => {
    const call = await fire(page);
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    const result = await call("buildLoanFormula", loans, 0, "simple") as string;
    expect(result).toContain("房貸");
    expect(result).not.toContain("未命名貸款");
  });
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// drag label offset (mobile thumb occlusion)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("retireHandleY", () => {
  test("desktop → handle near top", async ({ page }) => {
    const call = await fire(page);
    const y = await call("retireHandleY", 30, 400, false);
    expect(y).toBe(30 + 28); // top + 28
  });

  test("mobile → handle near top (same as desktop)", async ({ page }) => {
    const call = await fire(page);
    const y = await call("retireHandleY", 30, 400, true);
    expect(y).toBe(30 + 28); // top + 28
  });

  test("mobile with different chart size → tracks top", async ({ page }) => {
    const call = await fire(page);
    const y = await call("retireHandleY", 20, 300, true);
    expect(y).toBe(20 + 28);
  });
});

test.describe("incLabelY", () => {
  test("not dragging → default position above handle", async ({ page }) => {
    const call = await fire(page);
    // incY=200, iph=9, chartTop=30, dragging=false, mob=true
    const y = await call("incLabelY", 200, 9, 30, false, true);
    expect(y).toBe(200 - 9 - 26); // 165
  });

  test("dragging on mobile → lifted further above", async ({ page }) => {
    const call = await fire(page);
    const yDrag = await call("incLabelY", 200, 9, 30, true, true);
    const yNorm = await call("incLabelY", 200, 9, 30, false, true);
    expect(yDrag).toBeLessThan(yNorm);
  });

  test("dragging on mobile near top → flips below handle", async ({ page }) => {
    const call = await fire(page);
    // incY=50, iph=9, chartTop=40 → lifted would go above chart
    const y = await call("incLabelY", 50, 9, 40, true, true);
    expect(y).toBeGreaterThan(50 + 9); // below handle
  });

  test("dragging on desktop → no offset", async ({ page }) => {
    const call = await fire(page);
    const y = await call("incLabelY", 200, 13, 30, true, false);
    expect(y).toBe(200 - 13 - 26); // 161, same as not dragging
  });
});
