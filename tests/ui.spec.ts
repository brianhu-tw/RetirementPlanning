import { test, expect, Page } from "@playwright/test";

// Helper: go to page with test bridge enabled
async function setup(page: Page) {
  await page.addInitScript(() => {
    (window as any).__TEST__ = true;
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__FIRE__);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Default value placeholder styling (touched-state)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("default value placeholder styling", () => {
  test("untouched age field has placeholder-style class", async ({ page }) => {
    await setup(page);
    const cls = await page.locator("#p_age").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(true);
  });

  test("untouched income field has placeholder-style class", async ({ page }) => {
    await setup(page);
    const cls = await page.locator("#p_income").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(true);
  });

  test("inflation field NEVER has placeholder-style class (excluded)", async ({ page }) => {
    await setup(page);
    const cls = await page.locator("#p_inflation").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("typing into a field removes placeholder-style", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("30");
    await page.waitForTimeout(200);
    const cls = await page.locator("#p_age").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("touched state persists across reload", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("30");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    const cls = await page.locator("#p_age").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("user explicitly entering default value (22) still counts as touched", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("22");
    await page.waitForTimeout(200);
    const cls = await page.locator("#p_age").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("placeholder-style class produces italic style", async ({ page }) => {
    await setup(page);
    const fontStyle = await page.locator("#p_age").evaluate(el => getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe("italic");
  });

  test("reset button clears touched state (fields revert to placeholder-style)", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("30");
    await page.waitForTimeout(200);
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(300);
    const cls = await page.locator("#p_age").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(true);
  });

  test("other untouched fields remain placeholder when one field is touched", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("30");
    await page.waitForTimeout(200);
    // Age is now touched; income should still be placeholder
    const incomeCls = await page.locator("#p_income").evaluate(el => el.classList.contains("placeholder-style"));
    expect(incomeCls).toBe(true);
  });
});

test.describe("loan field default value placeholder styling", () => {
  test("new precise loan has placeholder-style on all default numeric fields", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    for (const field of ["balance", "rate", "remainingMonths", "gracePeriodMonths"]) {
      const cls = await row.locator(`input[data-field="${field}"]`).evaluate(el => el.classList.contains("placeholder-style"));
      expect(cls).toBe(true);
    }
  });

  test("new simple loan has placeholder-style on monthlyPayment and remainingMonths", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "simple");
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    expect(await row.locator('input[data-field="monthlyPayment"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(true);
    expect(await row.locator('input[data-field="remainingMonths"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(true);
  });

  test("typing in balance removes its class but not others'", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    await row.locator('input[data-field="balance"]').fill("100000");
    await page.waitForTimeout(200);
    expect(await row.locator('input[data-field="balance"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(false);
    expect(await row.locator('input[data-field="rate"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(true);
    expect(await row.locator('input[data-field="remainingMonths"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(true);
  });

  test("legacy loan without _touched array shows no placeholder-style", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TEST__ = true;
      localStorage.setItem("fire_loans", JSON.stringify([{
        name: "房貸", balance: 8000000, rate: 0.021, remainingMonths: 240, gracePeriodMonths: 0
      }]));
      localStorage.setItem("fire_loan_mode", "precise");
    });
    await page.goto("/");
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    const row = page.locator(".loan-row").first();
    for (const field of ["balance", "rate", "remainingMonths", "gracePeriodMonths"]) {
      const cls = await row.locator(`input[data-field="${field}"]`).evaluate(el => el.classList.contains("placeholder-style"));
      expect(cls).toBe(false);
    }
  });

  test("touched loan field state persists across reload", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    await row.locator('input[data-field="balance"]').fill("100000");
    await row.locator('input[data-field="balance"]').blur();
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    const reloadedRow = page.locator(".loan-row").first();
    expect(await reloadedRow.locator('input[data-field="balance"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(false);
    expect(await reloadedRow.locator('input[data-field="rate"]').evaluate(el => el.classList.contains("placeholder-style"))).toBe(true);
  });

  test("precise→simple auto-fill marks monthlyPayment as touched (no placeholder)", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    await switchLoanMode(page, "simple");
    await page.waitForTimeout(300);
    const mp = page.locator('.loan-row input[data-field="monthlyPayment"]');
    // Value should be auto-filled
    expect(await mp.inputValue()).toContain("40,851");
    // And it should NOT be styled as placeholder (it's a computed real value)
    expect(await mp.evaluate(el => el.classList.contains("placeholder-style"))).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P2: Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("P2: validation", () => {
  test("age > 80 shows range error", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("85");
    // Trigger recalculate by blurring
    await page.locator("#p_age").blur();
    // Wait for debounce
    await page.waitForTimeout(400);
    const err = page.locator("#err_age");
    await expect(err).toHaveText("年齡需介於 0–80 歲");
    await expect(page.locator("#p_age")).toHaveClass(/invalid/);
  });

  test("age as decimal shows integer error", async ({ page }) => {
    await setup(page);
    await page.locator("#p_age").fill("25.5");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(400);
    const err = page.locator("#err_age");
    await expect(err).toHaveText("年齡須為整數");
  });

  test("return rate > 15 shows range error", async ({ page }) => {
    await setup(page);
    // Open advanced settings first
    await page.locator("details.advanced summary").click();
    // Select 自訂 to make return-group visible
    await page.locator("#p_etf").selectOption("");
    await page.waitForTimeout(200);
    await page.locator("#p_return").fill("20");
    await page.locator("#p_return").blur();
    await page.waitForTimeout(400);
    const err = page.locator("#err_return");
    await expect(err).toHaveText("報酬率需介於 0%–15%");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P3: End-to-end user flows
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("P3: user flows", () => {
  test("default values show retirement age in conclusion", async ({ page }) => {
    await setup(page);
    const conclusion = page.locator("#conclusion");
    await expect(conclusion).toContainText("歲");
    // Should contain a strong tag with the retirement age
    const strong = conclusion.locator("strong");
    await expect(strong).toHaveCount(1);
    const text = await strong.textContent();
    // The number should be a valid age
    const age = parseInt(text!);
    expect(age).toBeGreaterThanOrEqual(22);
    expect(age).toBeLessThanOrEqual(80);
  });

  test("increasing income lowers retirement age", async ({ page }) => {
    await setup(page);
    // Get baseline retirement age
    const baseAge = await page.locator("#conclusion strong").textContent();
    const base = parseInt(baseAge!);

    // Increase income significantly
    await page.locator("#p_income").fill("2,000,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(500);

    const newAge = await page.locator("#conclusion strong").textContent();
    const updated = parseInt(newAge!);
    expect(updated).toBeLessThanOrEqual(base);
  });

  test("expenses > income shows warning", async ({ page }) => {
    await setup(page);
    await page.locator("#p_income").fill("200,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(300);
    await page.locator("#p_expenses").fill("500,000");
    await page.locator("#p_expenses").blur();
    await page.waitForTimeout(500);

    const conclusion = page.locator("#conclusion");
    // Should have warn class and show warning message
    await expect(conclusion).toHaveClass(/warn/);
  });

  test("ETF selector fills return rate", async ({ page }) => {
    await setup(page);
    // Open advanced settings
    await page.locator("details.advanced summary").click();

    // Select VOO
    await page.locator("#p_etf").selectOption("14");
    await page.waitForTimeout(400);

    const returnVal = await page.locator("#p_return").inputValue();
    expect(returnVal).toBe("14");
  });

  test("reset button restores defaults", async ({ page }) => {
    await setup(page);

    // Change some values
    await page.locator("#p_age").fill("35");
    await page.locator("#p_age").blur();
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(400);

    // Click reset
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(400);

    // Verify defaults
    expect(await page.locator("#p_age").inputValue()).toBe("22");
    expect(await page.locator("#p_income").inputValue()).toBe("546,000");
    expect(await page.locator("#p_expenses").inputValue()).toBe("320,000");
    expect(await page.locator("#p_assets").inputValue()).toBe("0");
  });

  test("chart3 canvas is visible and rendered", async ({ page }) => {
    await setup(page);
    const canvas = page.locator("#chart3");
    await expect(canvas).toBeVisible();
    // Check that chart has actually rendered (has non-zero size)
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P4: Persistence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("P4: persistence", () => {
  test("params survive reload via localStorage", async ({ page }) => {
    await setup(page);

    // Change age and income
    await page.locator("#p_age").fill("35");
    await page.locator("#p_age").blur();
    await page.locator("#p_income").fill("800,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");

    // Values should be restored
    expect(await page.locator("#p_age").inputValue()).toBe("35");
    expect(await page.locator("#p_income").inputValue()).toBe("800,000");
  });

  test("collapse state of sections persists across reload", async ({ page }) => {
    await setup(page);
    // Open loans section (add a loan so it auto-opens)
    const loansSection = page.locator("#loansSection");
    await loansSection.locator("summary").click();
    await page.waitForTimeout(100);
    expect(await loansSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    // Open advanced section
    const advSection = page.locator("details.advanced");
    await advSection.locator("summary").click();
    await page.waitForTimeout(100);
    expect(await advSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    // Now close both
    await loansSection.locator("summary").click();
    await page.waitForTimeout(100);
    await advSection.locator("summary").click();
    await page.waitForTimeout(100);
    expect(await loansSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    expect(await advSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    // Reload — should stay closed
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(300);
    expect(await loansSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    expect(await advSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  });

  test("opened section state persists across reload", async ({ page }) => {
    await setup(page);
    // Open both sections
    const loansSection = page.locator("#loansSection");
    const advSection = page.locator("details.advanced");
    await loansSection.locator("summary").click();
    await page.waitForTimeout(100);
    await advSection.locator("summary").click();
    await page.waitForTimeout(100);
    // Reload — should stay open
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(300);
    expect(await loansSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    expect(await advSection.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  });

  test("yearly table collapse state persists across reload", async ({ page }) => {
    await setup(page);
    const yearlyDetails = page.locator(".yearly-table-wrap details");
    // Open it
    await yearlyDetails.locator("summary").click();
    await page.waitForTimeout(100);
    expect(await yearlyDetails.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    // Reload — should stay open
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(300);
    expect(await yearlyDetails.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  });

  test("URL params override localStorage", async ({ page }) => {
    // First set localStorage values
    await setup(page);
    await page.locator("#p_age").fill("35");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(300);

    // Now navigate with URL params
    await page.goto("/?age=45&income=1200000&expenses=400000&return=8&inflation=2&incGrowRate=1&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    expect(await page.locator("#p_age").inputValue()).toBe("45");
    expect(await page.locator("#p_income").inputValue()).toBe("1,200,000");
    expect(await page.locator("#p_expenses").inputValue()).toBe("400,000");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P5: Loans UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Helper to switch loan mode (forward declaration for use in addLoan)
async function ensureLoanSectionOpen(page: Page) {
  const details = page.locator("#loansSection");
  const isOpen = await details.evaluate(el => (el as HTMLDetailsElement).open);
  if (!isOpen) {
    // Click the summary to open
    await details.locator("summary").click();
    await page.waitForTimeout(100);
  }
}

// Helper to add a loan in precise mode (used by existing tests)
async function addLoan(page: Page, name: string, balance: string, rate: string, months: string) {
  await ensureLoanSectionOpen(page);
  // Switch to precise mode
  await page.locator(`#loansSection .loan-mode-toggle [data-mode="precise"]`).click();
  await page.waitForTimeout(200);
  await page.locator("#addLoanBtn").click();
  const rows = page.locator(".loan-row");
  const lastRow = rows.last();
  await lastRow.locator('input[data-field="name"]').fill(name);
  await lastRow.locator('input[data-field="balance"]').fill(balance);
  await lastRow.locator('input[data-field="rate"]').fill(rate);
  await lastRow.locator('input[data-field="remainingMonths"]').fill(months);
  await lastRow.locator('input[data-field="remainingMonths"]').blur();
  await page.waitForTimeout(400);
}

test.describe("P5: loans UI", () => {
  test("add loan button creates a loan row", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const rows = page.locator(".loan-row");
    await expect(rows).toHaveCount(1);
  });

  test("delete loan button requires confirmation", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    await expect(page.locator(".loan-row")).toHaveCount(1);
    // Dismiss confirm → loan stays
    page.once("dialog", d => d.dismiss());
    await page.locator(".loan-row .loan-remove-btn").click();
    await page.waitForTimeout(200);
    await expect(page.locator(".loan-row")).toHaveCount(1);
    // Accept confirm → loan removed
    page.once("dialog", d => d.accept());
    await page.locator(".loan-row .loan-remove-btn").click();
    await page.waitForTimeout(200);
    await expect(page.locator(".loan-row")).toHaveCount(0);
  });

  test("loan shows in yearly table column", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    // Open yearly table
    await page.locator(".yearly-table-wrap details summary").click();
    // Check that 貸款 column header exists
    const headers = page.locator(".yearly-table th");
    const headerTexts = await headers.allTextContents();
    expect(headerTexts.some(h => h.includes("貸款"))).toBe(true);
    // First data row loan column (7th td)
    const firstLoanCell = page.locator(".yearly-table tbody tr:first-child td:nth-child(7)");
    const text = await firstLoanCell.textContent();
    expect(text).not.toBe("—");
    expect(text).not.toBe("0");
  });

  test("loans persist across reload", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await expect(page.locator(".loan-row")).toHaveCount(1);
    const nameVal = await page.locator('.loan-row input[data-field="name"]').inputValue();
    expect(nameVal).toBe("房貸");
    const balanceVal = await page.locator('.loan-row input[data-field="balance"]').inputValue();
    expect(balanceVal).toBe("8,000,000");
  });

  test("reset clears all loans", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    await addLoan(page, "信貸", "300,000", "3", "36");
    await expect(page.locator(".loan-row")).toHaveCount(2);
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(400);
    await expect(page.locator(".loan-row")).toHaveCount(0);
  });

  test("loans impact retirement age", async ({ page }) => {
    await setup(page);
    // Increase income so retirement is feasible even with a loan
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(500);

    // Get baseline retirement age
    const baseText = await page.locator("#conclusion strong").textContent();
    const base = parseInt(baseText!);

    // Add a moderate loan
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    await page.waitForTimeout(500);

    // Retirement age should be delayed or at least the same
    const conclusion = page.locator("#conclusion");
    const hasStrong = await conclusion.locator("strong").count();
    if (hasStrong > 0) {
      const newText = await conclusion.locator("strong").textContent();
      const updated = parseInt(newText!);
      expect(updated).toBeGreaterThanOrEqual(base);
    } else {
      // If no strong, it means retirement became impossible — that's a valid impact
      await expect(conclusion).toHaveClass(/warn/);
    }
  });

  test("loans visible without opening advanced settings", async ({ page }) => {
    await setup(page);
    // Loans section should be visible directly (not inside advanced)
    await expect(page.locator("#loansSection")).toBeVisible();
    // Open section to access add button and mode toggle
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#addLoanBtn")).toBeVisible();
  });

  test("monthly payment display updates from balance/rate/months", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    const row = page.locator(".loan-row").first();
    const display = row.locator(".loan-monthly-display");
    await expect(display).toBeVisible();
    const text = await display.textContent();
    // calcMonthlyPayment(8_000_000, 0.021, 240/12=20) = 40,851
    expect(text).toContain("40,851");
  });

  test("loan balance clears '0' on focus", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator(`#loansSection .loan-mode-toggle [data-mode="precise"]`).click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    const balance = page.locator('.loan-row input[data-field="balance"]');
    await expect(balance).toHaveValue("0");
    await balance.focus();
    await expect(balance).toHaveValue("");
  });

  test("loan rate clears '0' on focus", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator(`#loansSection .loan-mode-toggle [data-mode="precise"]`).click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    const rate = page.locator('.loan-row input[data-field="rate"]');
    await expect(rate).toHaveValue("0");
    await rate.focus();
    await expect(rate).toHaveValue("");
  });

  test("loan remainingMonths clears '0' on focus", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator(`#loansSection .loan-mode-toggle [data-mode="precise"]`).click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    const months = page.locator('.loan-row input[data-field="remainingMonths"]');
    await expect(months).toHaveValue("0");
    await months.focus();
    await expect(months).toHaveValue("");
  });

  test("loan balance restores '0' on empty blur", async ({ page }) => {
    await setup(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const balance = page.locator('.loan-row input[data-field="balance"]');
    await balance.focus();
    await expect(balance).toHaveValue("");
    await balance.blur();
    await expect(balance).toHaveValue("0");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P6: Loan collapsible + dual mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Helper to switch loan mode
async function switchLoanMode(page: Page, mode: "simple" | "precise") {
  await ensureLoanSectionOpen(page);
  await page.locator(`#loansSection .loan-mode-toggle [data-mode="${mode}"]`).click();
  await page.waitForTimeout(200);
}

// Precise mode helper — uses balance/rate/remainingMonths fields
async function addLoanPrecise(page: Page, name: string, balance: string, rate: string, months: string) {
  await switchLoanMode(page, "precise");
  await page.locator("#addLoanBtn").click();
  const lastRow = page.locator(".loan-row").last();
  await lastRow.locator('input[data-field="name"]').fill(name);
  await lastRow.locator('input[data-field="balance"]').fill(balance);
  await lastRow.locator('input[data-field="rate"]').fill(rate);
  await lastRow.locator('input[data-field="remainingMonths"]').fill(months);
  await lastRow.locator('input[data-field="remainingMonths"]').blur();
  await page.waitForTimeout(400);
}

// Simple mode helper
async function addLoanSimple(page: Page, name: string, monthlyPayment: string, months: string) {
  await switchLoanMode(page, "simple");
  await page.locator("#addLoanBtn").click();
  const lastRow = page.locator(".loan-row").last();
  const nameInput = lastRow.locator('input[data-field="name"]');
  if (await nameInput.count() > 0) {
    await nameInput.fill(name);
  } else {
    // Lazy name: single loan in simple mode hides name field. Set via JS bridge.
    await page.evaluate((n) => {
      const fire = (window as any).__FIRE__;
      if (fire && fire.loans && fire.loans[0]) {
        fire.loans[0].name = n;
        fire.saveLoans?.();
      }
    }, name);
  }
  await lastRow.locator('input[data-field="monthlyPayment"]').fill(monthlyPayment);
  await lastRow.locator('input[data-field="remainingMonths"]').fill(months);
  await lastRow.locator('input[data-field="remainingMonths"]').blur();
  await page.waitForTimeout(400);
}

test.describe("P6: loan collapsible + dual mode", () => {
  test("loan section is collapsed by default", async ({ page }) => {
    await setup(page);
    const details = page.locator("#loansSection");
    await expect(details).not.toHaveAttribute("open", "");
    // Summary label should still be visible when collapsed
    await expect(page.locator("#loansSection summary .loan-label")).toBeVisible();
  });

  test("expanded section shows toolbar with mode toggle and add button", async ({ page }) => {
    await setup(page);
    await page.locator("#loansSection summary").click();
    await expect(page.locator(".loan-toolbar")).toBeVisible();
    await expect(page.locator("#addLoanBtn")).toBeVisible();
    await expect(page.locator('.loan-mode-toggle [data-mode="simple"]')).toBeVisible();
    await expect(page.locator('.loan-mode-toggle [data-mode="precise"]')).toBeVisible();
  });

  test("default mode is simple", async ({ page }) => {
    await setup(page);
    await page.locator("#loansSection summary").click();
    const simpleBtn = page.locator('#loansSection .loan-mode-toggle [data-mode="simple"]');
    await expect(simpleBtn).toHaveClass(/active/);
  });

  test("simple mode shows name, monthlyPayment, remainingMonths", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    // Add 2 loans so name field is shown (lazy name: 1 loan hides name)
    await page.locator("#addLoanBtn").click();
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    await expect(row.locator('input[data-field="name"]')).toBeVisible();
    await expect(row.locator('input[data-field="monthlyPayment"]')).toBeVisible();
    await expect(row.locator('input[data-field="remainingMonths"]')).toBeVisible();
    // Should NOT have balance or rate fields
    await expect(row.locator('input[data-field="balance"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="rate"]')).toHaveCount(0);
  });

  test("precise mode shows manual entry fields (balance/rate/remainingMonths/grace)", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await switchLoanMode(page, "precise");
    const row = page.locator(".loan-row").first();
    await expect(row.locator('input[data-field="balance"]')).toBeVisible();
    await expect(row.locator('input[data-field="rate"]')).toBeVisible();
    await expect(row.locator('input[data-field="remainingMonths"]')).toBeVisible();
    await expect(row.locator('input[data-field="gracePeriodMonths"]')).toBeVisible();
    // time-based fields are gone
    await expect(row.locator('input[data-field="deductionDay"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="startDate"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="principal"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="totalMonths"]')).toHaveCount(0);
    // monthly-display element still exists
    await expect(row.locator('.loan-monthly-display')).toHaveCount(1);
  });

  test("precise→simple auto-fills monthlyPayment from calculation", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    // Switch to simple — monthlyPayment should be auto-filled
    await switchLoanMode(page, "simple");
    const mp = page.locator('.loan-row input[data-field="monthlyPayment"]');
    const val = await mp.inputValue();
    // calcMonthlyPayment(8_000_000, 0.021, 20) ≈ 40,851
    expect(val).toContain("40,851");
  });

  test("simple→precise preserves monthlyPayment in monthly display", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await switchLoanMode(page, "precise");
    // Monthly display should show the carried-over 40,000 (not "—" or 0)
    const display = page.locator('.loan-row .loan-monthly-display');
    await expect(display).toContainText("40,000");
  });

  // ──────────────────────────────────────────────────────────────
  // Mode-switch invariants (three scenarios)
  // ──────────────────────────────────────────────────────────────
  test("Case 1: simple→precise preserves data and retirement age", async ({ page }) => {
    await setup(page);
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(300);
    const beforeAge = await page.locator("#conclusion strong").textContent();

    await switchLoanMode(page, "precise");
    await page.waitForTimeout(300);

    // remainingMonths preserved in DOM
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("240");
    // Monthly display carries over from simple mode
    await expect(page.locator('.loan-row .loan-monthly-display')).toContainText("40,000");
    // Simulation invariant: retirement age unchanged
    const afterAge = await page.locator("#conclusion strong").textContent();
    expect(afterAge).toBe(beforeAge);
  });

  test("Case 2: precise→simple auto-fills monthlyPayment and preserves retirement age", async ({ page }) => {
    await setup(page);
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    await page.waitForTimeout(300);
    const beforeAge = await page.locator("#conclusion strong").textContent();

    await switchLoanMode(page, "simple");
    await page.waitForTimeout(300);

    // monthlyPayment auto-filled (~40,851)
    const mp = await page.locator('.loan-row input[data-field="monthlyPayment"]').inputValue();
    expect(mp).toContain("40,851");
    // remainingMonths preserved
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("240");
    // Simulation invariant: retirement age unchanged
    const afterAge = await page.locator("#conclusion strong").textContent();
    expect(afterAge).toBe(beforeAge);
  });

  test("Case 3: simple→precise→simple round-trip preserves monthlyPayment", async ({ page }) => {
    await setup(page);
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(300);
    const beforeAge = await page.locator("#conclusion strong").textContent();

    await switchLoanMode(page, "precise");
    await page.waitForTimeout(200);
    await switchLoanMode(page, "simple");
    await page.waitForTimeout(300);

    // monthlyPayment must still be the original 40,000 (not overwritten to 0)
    const mp = await page.locator('.loan-row input[data-field="monthlyPayment"]').inputValue();
    expect(mp).toBe("40,000");
    // remainingMonths preserved
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("240");
    // Simulation invariant: retirement age unchanged after round-trip
    const afterAge = await page.locator("#conclusion strong").textContent();
    expect(afterAge).toBe(beforeAge);
  });

  test("simple mode loan affects retirement age", async ({ page }) => {
    await setup(page);
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(500);

    const baseText = await page.locator("#conclusion strong").textContent();
    const base = parseInt(baseText!);

    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(500);

    const conclusion = page.locator("#conclusion");
    const hasStrong = await conclusion.locator("strong").count();
    if (hasStrong > 0) {
      const newText = await conclusion.locator("strong").textContent();
      const updated = parseInt(newText!);
      expect(updated).toBeGreaterThanOrEqual(base);
    } else {
      await expect(conclusion).toHaveClass(/warn/);
    }
  });

  test("loan mode persists across reload", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await ensureLoanSectionOpen(page);
    const preciseBtn = page.locator('#loansSection .loan-mode-toggle [data-mode="precise"]');
    await expect(preciseBtn).toHaveClass(/active/);
  });

  test("section auto-opens when loans exist on load", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    const details = page.locator("#loansSection");
    await expect(details).toHaveAttribute("open", "");
  });

  test("reset also resets loanMode to simple", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(400);
    // Open section and check mode
    await ensureLoanSectionOpen(page);
    const simpleBtn = page.locator('#loansSection .loan-mode-toggle [data-mode="simple"]');
    await expect(simpleBtn).toHaveClass(/active/);
  });

  test("new loan starts with empty name + placeholder (no auto-name)", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const name1 = page.locator('.loan-row').first().locator('input[data-field="name"]');
    await expect(name1).toHaveValue("");
    expect(await name1.getAttribute("placeholder")).toBe("未命名貸款");
  });

  test("multiple loans can all have empty names (no uniqueness enforced)", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    await page.locator("#addLoanBtn").click();
    await page.locator("#addLoanBtn").click();
    const names = await page.locator('.loan-row input[data-field="name"]').allTextContents();
    const values = await Promise.all(
      (await page.locator('.loan-row input[data-field="name"]').all()).map(el => el.inputValue())
    );
    expect(values).toEqual(["", "", ""]);
  });

  test("placeholder has italic style for visual distinction", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const fontStyle = await page.locator('.loan-row input[data-field="name"]').first().evaluate(el => {
      // Access ::placeholder pseudo via getComputedStyle with pseudo argument
      return getComputedStyle(el, "::placeholder").fontStyle;
    });
    expect(fontStyle).toBe("italic");
  });

  test("header row shows column labels once, per-row labels hidden", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    // Add a 2nd loan so name column appears (lazy name: 1 loan hides name)
    await addLoanSimple(page, "車貸", "10,000", "60");
    // Header row should exist with column labels
    const header = page.locator(".loan-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("名稱");
    await expect(header).toContainText("每月還款");
    await expect(header).toContainText("剩餘期數");
    // Per-row labels should be hidden (display:none on desktop)
    const rowLabel = page.locator(".loan-row label").first();
    await expect(rowLabel).toBeHidden();
  });

  test("precise mode header shows correct columns including grace and monthly", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const header = page.locator(".loan-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("名稱");
    await expect(header).toContainText("餘額");
    await expect(header).toContainText("年利率");
    await expect(header).toContainText("剩餘期數");
    await expect(header).toContainText("寬限期");
    await expect(header).toContainText("月付額");
  });

  test("monthly display is a separate column in precise mode", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-monthly-display');
    await expect(display).toHaveCount(1);
    await expect(display).toContainText("40,851");
  });

  test("editing balance updates monthly display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-monthly-display');
    await expect(display).toContainText("40,851");
    const balance = page.locator('.loan-row input[data-field="balance"]');
    await balance.fill("4,000,000");
    await balance.blur();
    await page.waitForTimeout(300);
    await expect(display).toContainText("20,425");
  });

  test("editing remainingMonths updates monthly display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-monthly-display');
    const remaining = page.locator('.loan-row input[data-field="remainingMonths"]');
    await remaining.fill("360");
    await remaining.blur();
    await page.waitForTimeout(300);
    const text = await display.textContent();
    expect(text).toContain("29,971");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Simple mode lazy name field
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("simple mode lazy name", () => {
  test("1 筆貸款不顯示名稱欄", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    // simple mode is default
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator(".loan-row").count()).toBe(1);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(0);
  });

  test("1 筆貸款 header 不顯示名稱 label", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const headerText = await page.locator(".loan-header").innerText();
    expect(headerText).not.toContain("名稱");
  });

  test("2 筆貸款顯示名稱欄（每一筆）", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator(".loan-row").count()).toBe(2);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(2);
  });

  test("2 筆貸款 header 顯示名稱 label", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const headerText = await page.locator(".loan-header").innerText();
    expect(headerText).toContain("名稱");
  });

  test("加第二筆貸款時 focus 第一筆名稱欄", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(300);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const row = el.closest(".loan-row");
      return {
        field: el.getAttribute("data-field"),
        index: row ? row.getAttribute("data-index") : null,
      };
    });
    expect(focused?.field).toBe("name");
    expect(focused?.index).toBe("0");
  });

  test("從 2 筆刪到 1 筆 → 名稱欄消失", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(2);

    page.once("dialog", d => d.accept());
    await page.locator(".loan-row").last().locator(".loan-remove-btn").click();
    await page.waitForTimeout(300);

    expect(await page.locator(".loan-row").count()).toBe(1);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(0);
  });

  test("精準模式不受影響：1 筆貸款仍顯示名稱欄", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator(`#loansSection .loan-mode-toggle [data-mode="precise"]`).click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P7: Loan name XSS safety
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("P7: loan name escaping", () => {
  test("loan name with double-quote renders correctly", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    // Use precise mode so name field is always visible
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const nameInput = page.locator('.loan-row input[data-field="name"]');
    await nameInput.fill('貸款"test');
    await nameInput.blur();
    await page.waitForTimeout(300);

    // Re-render by switching mode back and forth (stays in precise after second switch)
    await switchLoanMode(page, "simple");
    await switchLoanMode(page, "precise");

    // The input should still contain the name with the quote
    const val = await page.locator('.loan-row input[data-field="name"]').inputValue();
    expect(val).toBe('貸款"test');
  });

  test("loan name with HTML chars does not break rendering", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const nameInput = page.locator('.loan-row input[data-field="name"]');
    await nameInput.fill('<script>alert(1)</script>');
    await nameInput.blur();
    await page.waitForTimeout(300);

    // Re-render
    await switchLoanMode(page, "simple");
    await switchLoanMode(page, "precise");

    // Should have exactly 1 loan row (not broken HTML)
    await expect(page.locator(".loan-row")).toHaveCount(1);
    const val = await page.locator('.loan-row input[data-field="name"]').inputValue();
    expect(val).toBe('<script>alert(1)</script>');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// F1: Table formula tooltips
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("F1: table formula tooltips", () => {
  test("nominal first row has '初始資產' formula", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(3)");
    await expect(cell).toHaveAttribute("data-formula", /初始資產/);
  });

  test("real asset first row has '初始資產' formula", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(4)");
    await expect(cell).toHaveAttribute("data-formula", /初始資產/);
  });

  test("nominal second row references previous year values", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:nth-child(2) td:nth-child(3)");
    const formula = await cell.getAttribute("data-formula");
    expect(formula).not.toBeNull();
    expect(formula).toContain("前年");
    expect(formula).toContain("收入");
    expect(formula).toContain("支出");
  });

  test("expense column has inflation-based formula", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    // Second row expense — should reference previous year
    const cell = page.locator(".yearly-table tbody tr:nth-child(2) td:nth-child(6)");
    const formula = await cell.getAttribute("data-formula");
    expect(formula).not.toBeNull();
    expect(formula).toContain("前年");
    expect(formula).toContain("×");
  });

  test("return column has rate formula when assets > 0", async ({ page }) => {
    await setup(page);
    await page.locator("#p_assets").fill("10,000,000");
    await page.locator("#p_assets").blur();
    await page.waitForTimeout(500);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(8)");
    const formula = await cell.getAttribute("data-formula");
    expect(formula).not.toBeNull();
    expect(formula).toContain("年初");
    expect(formula).toContain("×");
    expect(formula).toContain("%");
  });

  test("loan column has formula when loans exist", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(500);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(7)");
    const formula = await cell.getAttribute("data-formula");
    expect(formula).not.toBeNull();
    expect(formula).toContain("房貸");
    expect(formula).toContain("40,000/月");
  });

  test("dash cells have no data-formula", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    // Last row income column shows "—" and should have no formula
    const lastRow = page.locator(".yearly-table tbody tr:last-child");
    const incCell = lastRow.locator("td:nth-child(5)");
    await expect(incCell).toHaveText("—");
    expect(await incCell.getAttribute("data-formula")).toBeNull();
  });

  test("hover shows tooltip bubble with formula content (after delay)", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    // First row nominal column has formula "初始資產"
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(3)");
    await cell.hover();
    // At 100ms the bubble should NOT be visible yet (hover delay is 300ms)
    await page.waitForTimeout(100);
    await expect(page.locator(".tip-bubble")).toHaveCount(0);
    // After 300ms total the bubble should appear
    await page.waitForTimeout(250);
    const bubble = page.locator(".tip-bubble");
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("初始資產");
  });

  test("info-tip hover uses CSS ::after, not JS bubble", async ({ page }) => {
    await setup(page);
    const tip = page.locator(".info-tip").first();
    await tip.hover();
    await page.waitForTimeout(200);
    // CSS ::after handles desktop tooltip; JS .tip-bubble should NOT appear
    await expect(page.locator(".tip-bubble")).toHaveCount(0);
  });

  test("click event does not toggle off hover-created formula bubble", async ({ page }) => {
    await setup(page);
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    const cell = page.locator(".yearly-table tbody tr:first-child td:nth-child(3)");
    // Hover to show bubble (300ms delay)
    await cell.hover();
    await page.waitForTimeout(400);
    await expect(page.locator(".tip-bubble")).toBeVisible();
    // Fire click event — should NOT dismiss hover bubble
    await cell.dispatchEvent("click");
    await page.waitForTimeout(100);
    await expect(page.locator(".tip-bubble")).toBeVisible();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIRE ratio includes loans (revised definition)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("FIRE ratio with loans", () => {
  test("FIRE ratio with no loans is assets / expenses", async ({ page }) => {
    await setup(page);
    await page.locator("#p_assets").fill("10,000,000");
    await page.locator("#p_assets").blur();
    await page.locator("#p_expenses").fill("400,000");
    await page.locator("#p_expenses").blur();
    await page.waitForTimeout(500);

    // 10,000,000 / 400,000 = 25.0
    const text = await page.locator(".metric-card:nth-child(3) .value").textContent();
    expect(text).toContain("25.0");
  });

  test("FIRE ratio with loans is assets / (expenses + yearLoan)", async ({ page }) => {
    await setup(page);
    await page.locator("#p_assets").fill("10,000,000");
    await page.locator("#p_assets").blur();
    await page.locator("#p_expenses").fill("400,000");
    await page.locator("#p_expenses").blur();
    await page.waitForTimeout(300);

    // Add loan 40k/month for 240 months → yearLoan = 480,000
    // New ratio: 10,000,000 / (400,000 + 480,000) = 10,000,000 / 880,000 = 11.4
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(500);

    const text = await page.locator(".metric-card:nth-child(3) .value").textContent();
    expect(text).toContain("11.4");
  });

  test("FIRE ratio info-tip mentions loans are now included", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await page.waitForTimeout(500);
    const tip = page.locator(".metric-card:nth-child(3) .info-tip");
    const tipText = await tip.getAttribute("data-tip");
    expect(tipText).toContain("貸款");
    // The tooltip should NOT use the old "暫時性" wording (which implied exclusion)
    expect(tipText).not.toContain("暫時性");
  });

  test("expenses field has info-tip clarifying loans are excluded", async ({ page }) => {
    await setup(page);
    // Locate info-tip adjacent to the 支出 (expenses) label or field group
    const tip = page.locator('label[for="p_expenses"] .info-tip, #p_expenses + .info-tip, .field[data-field="expenses"] .info-tip').first();
    // Fallback: any info-tip in the same group as p_expenses
    const tipText = await page.locator('#p_expenses').evaluate(el => {
      const group = el.closest("label, .field, div");
      if (!group) return null;
      const tipEl = group.querySelector(".info-tip");
      return tipEl ? tipEl.getAttribute("data-tip") : null;
    });
    expect(tipText).toBeTruthy();
    expect(tipText).toContain("貸款");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// F2: 支出成長率 + ETF 收合 + 手機版兩欄
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("F2: expense growth rate", () => {
  test("p_expGrowRate field exists and defaults to 0", async ({ page }) => {
    await setup(page);
    await page.locator("details.advanced summary").click();
    const input = page.locator("#p_expGrowRate");
    await expect(input).toBeVisible();
    expect(await input.inputValue()).toBe("0");
  });

  test("p_expGrowRate clears on focus and restores on empty blur", async ({ page }) => {
    await setup(page);
    await page.locator("details.advanced summary").click();
    const input = page.locator("#p_expGrowRate");
    // Focus should clear the default "0"
    await input.focus();
    expect(await input.inputValue()).toBe("");
    // Blur empty → restores "0"
    await input.blur();
    expect(await input.inputValue()).toBe("0");
  });

  test("expense formula tooltip shows separate inflation and growth multipliers", async ({ page }) => {
    await setup(page);
    // Set non-zero expense growth rate
    await page.locator("details.advanced summary").click();
    await page.locator("#p_expGrowRate").fill("2");
    await page.locator("#p_expGrowRate").blur();
    await page.waitForTimeout(500);
    // Open yearly table
    await page.locator(".yearly-table-wrap details summary").click();
    await page.waitForTimeout(300);
    // Second row expense column
    const cell = page.locator(".yearly-table tbody tr:nth-child(2) td:nth-child(6)");
    const formula = await cell.getAttribute("data-formula");
    expect(formula).not.toBeNull();
    // Should show two separate multipliers, not a combined one
    expect(formula).toContain("通膨");
    expect(formula).toContain("支出成長");
  });

  test("setting expGrowRate > 0 delays retirement", async ({ page }) => {
    await setup(page);
    // Get baseline
    const baseText = await page.locator("#conclusion strong").textContent();
    const base = parseInt(baseText!);

    // Set expense growth rate
    await page.locator("details.advanced summary").click();
    await page.locator("#p_expGrowRate").fill("2");
    await page.locator("#p_expGrowRate").blur();
    await page.waitForTimeout(500);

    const conclusion = page.locator("#conclusion");
    const hasStrong = await conclusion.locator("strong").count();
    if (hasStrong > 0) {
      const newText = await conclusion.locator("strong").textContent();
      const updated = parseInt(newText!);
      expect(updated).toBeGreaterThanOrEqual(base);
    } else {
      // Retirement became impossible — valid impact
      await expect(conclusion).toHaveClass(/warn/);
    }
  });
});

test.describe("F2: ETF return-group visibility", () => {
  test("ETF defaults to 0050 and return-group is hidden", async ({ page }) => {
    await setup(page);
    await page.locator("details.advanced summary").click();
    const etf = page.locator("#p_etf");
    expect(await etf.inputValue()).toBe("12.5");
    const returnGroup = page.locator("#return-group");
    await expect(returnGroup).toBeHidden();
  });

  test("selecting 自訂 shows return-group", async ({ page }) => {
    await setup(page);
    await page.locator("details.advanced summary").click();
    await page.locator("#p_etf").selectOption("");
    await page.waitForTimeout(300);
    const returnGroup = page.locator("#return-group");
    await expect(returnGroup).toBeVisible();
  });

  test("selecting back to ETF hides return-group and sets correct rate", async ({ page }) => {
    await setup(page);
    await page.locator("details.advanced summary").click();
    // First go to custom
    await page.locator("#p_etf").selectOption("");
    await page.waitForTimeout(300);
    await expect(page.locator("#return-group")).toBeVisible();
    // Select VOO
    await page.locator("#p_etf").selectOption("14");
    await page.waitForTimeout(300);
    await expect(page.locator("#return-group")).toBeHidden();
    expect(await page.locator("#p_return").inputValue()).toBe("14");
  });
});

test.describe("F2: mobile advanced two-column grid", () => {
  test("advanced param-grid uses two-column layout on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setup(page);
    await page.locator("details.advanced summary").click();
    const grid = page.locator(".advanced .param-grid");
    const cols = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // Should have exactly two columns (two values separated by space)
    const colValues = cols.split(/\s+/).filter(Boolean);
    expect(colValues.length).toBe(2);
  });
});

test.describe("mobile precise loan layout", () => {
  test("rate/remaining/grace all on one row on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await switchLoanMode(page, "precise");
    const row = page.locator(".loan-row").first();
    const rateBox = await row.locator(".loan-cell-rate").boundingBox();
    const remainingBox = await row.locator(".loan-cell-remaining").boundingBox();
    const graceBox = await row.locator(".loan-cell-grace").boundingBox();
    expect(rateBox).not.toBeNull();
    expect(remainingBox).not.toBeNull();
    expect(graceBox).not.toBeNull();
    // All three on the same Y
    expect(Math.abs(rateBox!.y - remainingBox!.y)).toBeLessThan(2);
    expect(Math.abs(remainingBox!.y - graceBox!.y)).toBeLessThan(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mobile info-tip tooltip behavior
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("mobile info-tip tooltips", () => {
  test("tapping info-tip shows tooltip bubble on mobile", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    const tip = page.locator("label[for='p_assets'] .info-tip");
    await tip.tap();
    await page.waitForTimeout(200);
    const bubble = page.locator(".tip-bubble");
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText("投資的總金額");
    await ctx.close();
  });

  test("tapping info-tip inside label does NOT focus the input", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    const tip = page.locator("label[for='p_assets'] .info-tip");
    await tip.tap();
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).not.toBe("p_assets");
    await ctx.close();
  });

  test("info-tip touch target is at least 44px", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    const tip = page.locator("label[for='p_assets'] .info-tip");
    const box = await tip.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await ctx.close();
  });

  test("second tap closes tooltip without triggering label or summary", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    const tip = page.locator("label[for='p_assets'] .info-tip");
    // First tap: show tooltip
    await tip.tap();
    await page.waitForTimeout(200);
    await expect(page.locator(".tip-bubble")).toBeVisible();
    // Second tap: close tooltip
    await tip.tap();
    await page.waitForTimeout(200);
    // Tooltip should be gone
    await expect(page.locator(".tip-bubble")).toHaveCount(0);
    // Input should NOT be focused (label default action blocked)
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).not.toBe("p_assets");
    await ctx.close();
  });

  test("second tap on loans info-tip does not toggle details", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    // Open loans section first
    await page.locator("#loansSection summary").tap();
    await page.waitForTimeout(200);
    const wasOpen = await page.locator("#loansSection").evaluate(el => (el as HTMLDetailsElement).open);
    expect(wasOpen).toBe(true);
    // First tap on loans info-tip
    const tip = page.locator("#loansSection .info-tip");
    await tip.tap();
    await page.waitForTimeout(200);
    await expect(page.locator(".tip-bubble")).toBeVisible();
    // Second tap — should close tooltip but NOT toggle the details
    await tip.tap();
    await page.waitForTimeout(200);
    const stillOpen = await page.locator("#loansSection").evaluate(el => (el as HTMLDetailsElement).open);
    expect(stillOpen).toBe(true);
    await ctx.close();
  });

  test("no horizontal overflow on mobile viewport", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await setup(page);
    // Also open loans section and add a loan to test with more content
    await page.locator("#loansSection summary").click();
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
    await ctx.close();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PWA: manifest, meta tags, service worker
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("PWA setup", () => {
  test("link rel=manifest exists and points to manifest.json", async ({ page }) => {
    await setup(page);
    const link = page.locator('link[rel="manifest"]');
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute("href");
    expect(href).toBe("manifest.json");
  });

  test("apple-mobile-web-app-capable meta exists", async ({ page }) => {
    await setup(page);
    const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(meta).toHaveCount(1);
    expect(await meta.getAttribute("content")).toBe("yes");
  });

  test("apple-touch-icon link exists", async ({ page }) => {
    await setup(page);
    const link = page.locator('link[rel="apple-touch-icon"]');
    await expect(link).toHaveCount(1);
    expect(await link.getAttribute("href")).toContain("icon");
  });

  test("manifest.json is valid and has required fields", async ({ page }) => {
    await setup(page);
    const resp = await page.request.get("/manifest.json");
    expect(resp.ok()).toBe(true);
    const manifest = await resp.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    // Check icon sizes
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  test("service worker registration script exists", async ({ page }) => {
    await setup(page);
    const swScript = await page.evaluate(() => {
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        if (s.textContent && s.textContent.includes("serviceWorker") && s.textContent.includes("register")) {
          return true;
        }
      }
      return false;
    });
    expect(swScript).toBe(true);
  });

  test("sw.js is accessible", async ({ page }) => {
    await setup(page);
    const resp = await page.request.get("/sw.js");
    expect(resp.ok()).toBe(true);
    const text = await resp.text();
    expect(text).toContain("install");
    expect(text).toContain("fetch");
    expect(text).toContain("caches");
  });

  test("icon PNGs are accessible", async ({ page }) => {
    await setup(page);
    const resp192 = await page.request.get("/icons/icon-192.png");
    expect(resp192.ok()).toBe(true);
    expect(resp192.headers()["content-type"]).toContain("image/png");
    const resp512 = await page.request.get("/icons/icon-512.png");
    expect(resp512.ok()).toBe(true);
    expect(resp512.headers()["content-type"]).toContain("image/png");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Grace period (寬限期) UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("grace period UI", () => {
  test("precise mode directly shows grace period input (no checkbox)", async ({ page }) => {
    await setup(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    await expect(graceInput).toBeVisible();
    expect(await graceInput.inputValue()).toBe("0");
    // No checkbox should exist
    await expect(page.locator('.loan-row .grace-toggle')).toHaveCount(0);
  });

  test("simple mode does not show grace period input", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    await expect(graceInput).toHaveCount(0);
  });

  test("filling grace period months shows dual monthly display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    // Grace input should already be visible — fill it directly
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // Should show grace period amount AND normal amount
    const display = page.locator('.loan-row .loan-monthly-display');
    const text = await display.textContent();
    expect(text).toContain("寬限");
    // Grace monthly = 8,000,000 × 0.021 / 12 = 14,000
    expect(text).toContain("14,000");
  });

  test("grace period 0 shows normal monthly payment", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    expect(await graceInput.inputValue()).toBe("0");
    // Monthly display should show normal payment, no 寬限 text
    const display = page.locator('.loan-row .loan-monthly-display');
    const text = await display.textContent();
    expect(text).not.toContain("寬限");
    expect(text).toContain("40,851");
  });

  test("grace period persists across reload", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // Reload
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(300);
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    expect(await graceInput.inputValue()).toBe("36");
  });

  test("precise→simple switch uses grace period monthly for auto-fill", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // Switch to simple — monthlyPayment should be auto-filled with current grace payment
    await switchLoanMode(page, "simple");
    const mp = page.locator('.loan-row input[data-field="monthlyPayment"]');
    const val = await mp.inputValue();
    // Grace payment = 8,000,000 × 0.021 / 12 = 14,000
    expect(val).toContain("14,000");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared link protection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("shared link protection", () => {
  test("URL params do not overwrite localStorage", async ({ page }) => {
    // Set own values
    await setup(page);
    await page.locator("#p_age").fill("35");
    await page.locator("#p_age").blur();
    await page.locator("#p_income").fill("1,500,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(400);

    // Open shared link with different values
    await page.goto("/?age=45&income=900000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    // Screen shows URL values
    expect(await page.locator("#p_age").inputValue()).toBe("45");
    expect(await page.locator("#p_income").inputValue()).toBe("900,000");

    // localStorage should still have own values (not shared)
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("fire_params");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved.p_age).toBe("35");
    expect(saved.p_income).toBe("1,500,000");
  });

  test("URL params persist on reload", async ({ page }) => {
    await page.addInitScript(() => { (window as any).__TEST__ = true; });
    await page.goto("/?age=45&income=900000&shared=1");
    await page.waitForFunction(() => (window as any).__FIRE__);
    expect(page.url()).toContain("shared=1");

    // Reload
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);

    // Still shows shared values
    expect(await page.locator("#p_age").inputValue()).toBe("45");
    expect(page.url()).toContain("shared=1");
  });

  test("editing a field in shared view does NOT save to localStorage", async ({ page }) => {
    // Save own values first
    await setup(page);
    await page.locator("#p_age").fill("28");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=40&income=800000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    // Edit a field
    await page.locator("#p_age").fill("42");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(400);

    // localStorage should still have own values (edits were NOT saved)
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("fire_params");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved.p_age).toBe("28");
  });

  test("removing URL params restores localStorage values", async ({ page }) => {
    // Save own values first
    await setup(page);
    await page.locator("#p_age").fill("28");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=45&income=900000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_age").inputValue()).toBe("45");

    // Navigate without URL params → restores own values
    await page.goto("/");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_age").inputValue()).toBe("28");
  });

  test("shared banner visible when URL params present, hidden otherwise", async ({ page }) => {
    await setup(page);
    await expect(page.locator("#shared-banner")).toBeHidden();

    await page.goto("/?age=30&income=600000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");
    await expect(page.locator("#shared-banner")).toBeVisible();
  });

  test("clicking back-to-my-data clears URL and restores own values", async ({ page }) => {
    // Save own values
    await setup(page);
    await page.locator("#p_age").fill("28");
    await page.locator("#p_age").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=50&income=2000000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_age").inputValue()).toBe("50");
    await expect(page.locator("#shared-banner")).toBeVisible();

    // Click button
    await page.locator("#shared-banner button").click();
    await page.waitForTimeout(400);

    // Own values restored, banner gone, URL clean
    expect(await page.locator("#p_age").inputValue()).toBe("28");
    await expect(page.locator("#shared-banner")).toBeHidden();
    expect(page.url()).not.toContain("age=");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mobile drag label offset
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("mobile drag label offset", () => {
  test("mobile touch drag on retirement handle updates summary", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => { (window as any).__TEST__ = true; });
    await page.goto("/");
    await page.waitForFunction(() => (window as any).__FIRE__);

    // Scroll chart into view
    await page.locator("#chart3").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Get initial retirement age from summary
    const summaryBefore = await page.locator("#c3Summary").textContent();

    // Get handle page coordinates via evaluate (accounts for scroll + canvas offset)
    const pos = await page.evaluate(() => {
      const f = (window as any).__FIRE__;
      const hp = f.c3RetireHandlePos();
      const canvas = document.getElementById("chart3")!;
      const rect = canvas.getBoundingClientRect();
      // hp.x/hp.y are chart pixel coords (same as CSS pixels for ratio=1 in test)
      return { x: rect.left + hp.x, y: rect.top + hp.y };
    }) as { x: number; y: number };

    // Dispatch pointer events directly on canvas for reliable touch simulation
    await page.evaluate(({ startX, startY }) => {
      const canvas = document.getElementById("chart3")!;
      const rect = canvas.getBoundingClientRect();
      const cx = startX - rect.left, cy = startY - rect.top;
      const opts = (x: number, y: number) => ({
        bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch"
      });
      canvas.dispatchEvent(new PointerEvent("pointerdown", opts(startX, startY)));
      // Move right by 80px in steps
      for (let i = 1; i <= 8; i++) {
        canvas.dispatchEvent(new PointerEvent("pointermove", opts(startX + i * 10, startY)));
      }
      canvas.dispatchEvent(new PointerEvent("pointerup", opts(startX + 80, startY)));
    }, { startX: pos.x, startY: pos.y });
    await page.waitForTimeout(300);

    // Summary should have changed
    const summaryAfter = await page.locator("#c3Summary").textContent();
    expect(summaryAfter).not.toBe(summaryBefore);
    await ctx.close();
  });
});