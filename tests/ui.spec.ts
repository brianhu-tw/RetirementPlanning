import { test, expect, Page } from "@playwright/test";

// Helper: go to page with test bridge enabled
async function setup(page: Page) {
  await page.addInitScript(() => {
    (window as any).__TEST__ = true;
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__FIRE__);
}

// Helper: set "current age" by filling birthYear = currentYear - age
async function setAge(page: Page, age: number) {
  const year = new Date().getFullYear() - age;
  await page.locator("#p_birthYear").fill(String(year));
  await page.locator("#p_birthYear").blur();
}
// Helper: convert age to corresponding birthYear (for inputValue/saved comparisons)
const ageToBirthYear = (age: number) => String(new Date().getFullYear() - age);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Default value placeholder styling (touched-state)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("default value placeholder styling", () => {
  test("untouched age field has placeholder-style class", async ({ page }) => {
    await setup(page);
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
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
    await page.locator("#p_birthYear").fill("30");
    await page.waitForTimeout(200);
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("touched state persists across reload", async ({ page }) => {
    await setup(page);
    await page.locator("#p_birthYear").fill("30");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("user explicitly entering default value (22) still counts as touched", async ({ page }) => {
    await setup(page);
    await page.locator("#p_birthYear").fill("22");
    await page.waitForTimeout(200);
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("placeholder-style class produces italic style", async ({ page }) => {
    await setup(page);
    const fontStyle = await page.locator("#p_birthYear").evaluate(el => getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe("italic");
  });

  test("reset button clears touched state (fields revert to placeholder-style)", async ({ page }) => {
    await setup(page);
    await setAge(page, 30);
    await page.waitForTimeout(200);
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(300);
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(true);
  });

  test("other untouched fields remain placeholder when one field is touched", async ({ page }) => {
    await setup(page);
    await page.locator("#p_birthYear").fill("30");
    await page.waitForTimeout(200);
    // Age is now touched; income should still be placeholder
    const incomeCls = await page.locator("#p_income").evaluate(el => el.classList.contains("placeholder-style"));
    expect(incomeCls).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// birthYear input + age derived + migration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("birthYear field", () => {
  test("預設出生年 = 今年 - 22", async ({ page }) => {
    await setup(page);
    const yr = new Date().getFullYear();
    expect(await page.locator("#p_birthYear").inputValue()).toBe(String(yr - 22));
  });

  test("ageDerived 顯示「= X 歲」", async ({ page }) => {
    await setup(page);
    // 預設應該是 = 22 歲
    await expect(page.locator("#ageDerived")).toHaveText("= 22 歲");
    // 改變出生年 → derived 跟著更新
    await setAge(page, 35);
    await expect(page.locator("#ageDerived")).toHaveText("= 35 歲");
  });

  test("舊版 localStorage p_age 自動遷移為 p_birthYear", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TEST__ = true;
      localStorage.setItem("fire_params", JSON.stringify({ p_age: "35", p_income: "1,000,000" }));
    });
    await page.goto("/");
    await page.waitForFunction(() => (window as any).__FIRE__);
    const yr = new Date().getFullYear();
    expect(await page.locator("#p_birthYear").inputValue()).toBe(String(yr - 35));
  });

  test("舊版 fire_touched_fields 的 p_age 遷移為 p_birthYear（觸碰狀態保留）", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TEST__ = true;
      localStorage.setItem("fire_touched_fields", JSON.stringify(["p_age", "p_income"]));
      // 同時 seed 對應的 params，否則 p_birthYear 會是預設值
      localStorage.setItem("fire_params", JSON.stringify({ p_age: "35", p_income: "1,000,000" }));
    });
    await page.goto("/");
    await page.waitForFunction(() => (window as any).__FIRE__);
    // touched 標記已遷移：localStorage 內為 p_birthYear 而非 p_age
    const touched = await page.evaluate(() => {
      const raw = localStorage.getItem("fire_touched_fields");
      return raw ? JSON.parse(raw) : [];
    });
    expect(touched).toContain("p_birthYear");
    expect(touched).not.toContain("p_age");
    expect(touched).toContain("p_income"); // 其他欄位不受影響
    // 視覺上：p_birthYear 不應有 placeholder-style（觸碰狀態被保留）
    const cls = await page.locator("#p_birthYear").evaluate(el => el.classList.contains("placeholder-style"));
    expect(cls).toBe(false);
  });

  test("舊版 URL ?age= 自動遷移", async ({ page }) => {
    await page.addInitScript(() => { (window as any).__TEST__ = true; });
    await page.goto("/?age=30&shared=1");
    await page.waitForFunction(() => (window as any).__FIRE__);
    const yr = new Date().getFullYear();
    expect(await page.locator("#p_birthYear").inputValue()).toBe(String(yr - 30));
  });

  test("reset 後 ageDerived 跟著刷新", async ({ page }) => {
    await setup(page);
    await setAge(page, 50);
    await expect(page.locator("#ageDerived")).toHaveText("= 50 歲");
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(300);
    await expect(page.locator("#ageDerived")).toHaveText("= 22 歲");
  });
});

// Helper: setup with pre-seeded loans + lastUpdated timestamp.
// Seeds only on first load (sessionStorage flag) so page.reload() doesn't overwrite changes.
async function setupWithStaleLoans(page: Page, monthsAgo: number, loanData: any[]) {
  const ms = monthsAgo * 30 * 24 * 60 * 60 * 1000;
  const oldISO = new Date(Date.now() - ms).toISOString();
  await page.addInitScript(([loans, ts]) => {
    (window as any).__TEST__ = true;
    if (!sessionStorage.getItem("_seeded")) {
      localStorage.setItem("fire_loans", JSON.stringify(loans));
      localStorage.setItem("fire_loan_mode", "simple");
      localStorage.setItem("fire_loans_last_updated", ts);
      sessionStorage.setItem("_seeded", "1");
    }
  }, [loanData, oldISO] as [any, string]);
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__FIRE__);
}

test.describe("loan staleness banner", () => {
  test("banner hidden when there are no loans", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("banner hidden right after adding a first loan (timestamp = now)", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("banner hidden when loans exist but lastUpdated is recent (<1 month)", async ({ page }) => {
    await setupWithStaleLoans(page, 0, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("banner shown when lastUpdated is 3+ months ago", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeVisible();
    expect(await page.locator("#loanStaleN").inputValue()).toBe("3");
  });

  test("clicking 套用 X 期 advances all loans by X and hides banner", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerApply").click();
    await page.waitForTimeout(300);
    // 3 months advanced → 240 - 3 = 237
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("237");
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("更新 also shows toast", async ({ page }) => {
    await setupWithStaleLoans(page, 2, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerApply").click();
    const toast = page.locator("#toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("更新");
  });

  test("clicking 我自己改 dismisses banner without changing loans", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerDismiss").click();
    await page.waitForTimeout(200);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
    // Loan unchanged
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("240");
  });

  test("editing a loan field updates timestamp (banner stays hidden afterwards)", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    // Edit field → should update timestamp (which is already now, so still fresh)
    await page.locator('.loan-row input[data-field="monthlyPayment"]').fill("50,000");
    await page.locator('.loan-row input[data-field="monthlyPayment"]').blur();
    await page.waitForTimeout(300);
    // Verify timestamp was updated to a recent value
    const ts = await page.evaluate(() => localStorage.getItem("fire_loans_last_updated"));
    expect(ts).toBeTruthy();
    const diff = Date.now() - new Date(ts!).getTime();
    expect(diff).toBeLessThan(10_000); // within 10s of now
  });

  test("apply 套用 updates timestamp so banner won't reappear on reload", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerApply").click();
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("banner has editable N input pre-filled with elapsed months", async ({ page }) => {
    await setupWithStaleLoans(page, 4, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    const n = page.locator("#loanStaleN");
    await expect(n).toBeVisible();
    expect(await n.inputValue()).toBe("4");
  });

  test("editing N then 套用 uses the edited value (not the original elapsed)", async ({ page }) => {
    await setupWithStaleLoans(page, 5, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleN").fill("2");
    await page.locator("#loanStaleBannerApply").click();
    await page.waitForTimeout(300);
    // Only 2 期 applied → 240 - 2 = 238
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("238");
  });

  test("N=0 in input → 套用 is a no-op (banner stays, loans unchanged)", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleN").fill("0");
    await page.locator("#loanStaleBannerApply").click();
    await page.waitForTimeout(300);
    const rm = await page.locator('.loan-row input[data-field="remainingMonths"]').inputValue();
    expect(rm).toBe("240");
  });

  test("N input rejects negative numbers (sanitized to non-negative)", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleN").fill("-5");
    await page.waitForTimeout(100);
    const v = await page.locator("#loanStaleN").inputValue();
    const n = parseInt(v || "0", 10);
    expect(n).toBeGreaterThanOrEqual(0);
  });

  test("N input rejects decimals (sanitized to integer)", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleN").fill("2.5");
    await page.waitForTimeout(100);
    const v = await page.locator("#loanStaleN").inputValue();
    expect(v).not.toContain(".");
  });

  test("dismiss 我自己改 updates timestamp so banner won't reappear on reload", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerDismiss").click();
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  // ── #1: multi-loan batch apply ──
  test("更新 advances all 3 loans by N (simple + precise + grace mix)", async ({ page }) => {
    await setupWithStaleLoans(page, 2, [
      { name: "信貸", monthlyPayment: 10_000, balance: 0, rate: 0, remainingMonths: 60 },
      { name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 },
      { name: "車貸", monthlyPayment: 0, balance: 1_000_000, rate: 0, remainingMonths: 36, gracePeriodMonths: 12 },
    ]);
    // Switch to precise to see all three rows render with their precise fields
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#loanStaleN").fill("2");
    await page.locator("#loanStaleBannerApply").click();
    await page.waitForTimeout(300);
    const rms = await page.locator('.loan-row input[data-field="remainingMonths"]').evaluateAll(els => (els as HTMLInputElement[]).map(el => el.value));
    expect(rms).toEqual(["58", "238", "34"]);
    // 信貸 (simple fallback): balance stays 0
    // 房貸 (no grace): balance decreased by 2*20k = 40k → 4,760,000
    // 車貸 (grace=12): grace consumes both months → balance unchanged, grace 10
    const graces = await page.locator('.loan-row input[data-field="gracePeriodMonths"]').evaluateAll(els => (els as HTMLInputElement[]).map(el => el.value));
    expect(graces[2]).toBe("10");
  });

  // ── #2: sharedView banner stays hidden ──
  test("sharedView mode keeps banner hidden even with stale timestamp", async ({ page }) => {
    const loans = [{ name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }];
    const url = `/?shared=1&age=22&loans=${encodeURIComponent(JSON.stringify(loans))}&loanMode=simple`;
    await page.addInitScript(() => {
      (window as any).__TEST__ = true;
      if (!sessionStorage.getItem("_seeded")) {
        const ts = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem("fire_loans_last_updated", ts);
        sessionStorage.setItem("_seeded", "1");
      }
    });
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  // ── #3: removing a loan updates timestamp ──
  test("removing a loan updates the timestamp", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    // Pretend timestamp is old
    await page.evaluate(() => {
      const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem("fire_loans_last_updated", old);
    });
    // Accept the confirm() for delete
    page.on("dialog", d => d.accept());
    await page.locator(".loan-remove-btn").first().click();
    await page.waitForTimeout(300);
    const ts = await page.evaluate(() => localStorage.getItem("fire_loans_last_updated"));
    expect(ts).toBeTruthy();
    const diff = Date.now() - new Date(ts!).getTime();
    expect(diff).toBeLessThan(10_000);
  });

  // ── #4: reset button clears timestamp and hides banner ──
  test("重設為預設值 clears lastUpdated timestamp and hides banner", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeVisible();
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(400);
    const ts = await page.evaluate(() => localStorage.getItem("fire_loans_last_updated"));
    expect(ts).toBeNull();
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  // ── #5: N > 120 clamps to 120 ──
  test("N > 120 in input is clamped to 120", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleN").fill("200");
    await page.waitForTimeout(100);
    expect(await page.locator("#loanStaleN").inputValue()).toBe("120");
  });

  // ── #7: banner appears above the loan list in DOM ──
  test("banner sits above #loanList in DOM order", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    const bannerFollowedByList = await page.evaluate(() => {
      const banner = document.getElementById("loanStaleBanner");
      const list = document.getElementById("loanList");
      if (!banner || !list) return false;
      // Node.DOCUMENT_POSITION_FOLLOWING = 4
      return (banner.compareDocumentPosition(list) & 4) !== 0;
    });
    expect(bannerFollowedByList).toBe(true);
  });

  // ── #8: banner descriptive text ──
  test("banner descriptive text uses '上次更新：' wording", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator(".loan-stale-text")).toContainText("上次更新");
    await expect(page.locator(".loan-stale-text")).toContainText("個月前");
  });

  // ── #9: button labels ──
  test("button labels are '更新' and '取消'", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    expect((await page.locator("#loanStaleBannerApply").textContent())?.trim()).toBe("更新");
    expect((await page.locator("#loanStaleBannerDismiss").textContent())?.trim()).toBe("取消");
  });

  // ── #10: editing a loan field updates timestamp to ~now ──
  test("editing balance updates timestamp to within seconds of now", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 0, balance: 4_800_000, rate: 0, remainingMonths: 240, gracePeriodMonths: 0 }
    ]);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator('.loan-row input[data-field="balance"]').fill("3,000,000");
    await page.locator('.loan-row input[data-field="balance"]').blur();
    await page.waitForTimeout(300);
    const ts = await page.evaluate(() => localStorage.getItem("fire_loans_last_updated"));
    expect(ts).toBeTruthy();
    const diff = Date.now() - new Date(ts!).getTime();
    expect(diff).toBeLessThan(10_000);
  });

  // ── #11: boundary at 30 days ──
  test("29 days ago → banner hidden (under 1 month threshold)", async ({ page }) => {
    await setupWithStaleLoans(page, 29 / 30, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
  });

  test("exactly 30 days ago → banner visible (≥1 month)", async ({ page }) => {
    await setupWithStaleLoans(page, 1, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeVisible();
  });

  // ── #12: dismiss, time advances, banner reappears ──
  test("after dismiss, 31 more days pass → banner reappears", async ({ page }) => {
    await setupWithStaleLoans(page, 3, [
      { name: "房貸", monthlyPayment: 40000, balance: 0, rate: 0, remainingMonths: 240 }
    ]);
    await ensureLoanSectionOpen(page);
    await page.locator("#loanStaleBannerDismiss").click();
    await page.waitForTimeout(200);
    await expect(page.locator("#loanStaleBanner")).toBeHidden();
    // Now simulate time passing
    await page.evaluate(() => {
      const ts = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem("fire_loans_last_updated", ts);
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__FIRE__);
    await ensureLoanSectionOpen(page);
    await expect(page.locator("#loanStaleBanner")).toBeVisible();
    expect(await page.locator("#loanStaleN").inputValue()).toBe("1");
  });
});

// ── #6: loan input font-size sanity ──
test.describe("loan input font-size", () => {
  test("loan inputs are smaller (0.9rem) than main param inputs (1rem)", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    const loanFontSize = await page.locator('.loan-row input[data-field="monthlyPayment"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const mainFontSize = await page.locator("#p_birthYear").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(loanFontSize).toBeLessThan(mainFontSize);
    // 0.9rem ≈ 14.4px at default 16px root
    expect(loanFontSize).toBeCloseTo(14.4, 1);
  });

  test("ETF select font-size is 0.9rem (smaller than numeric input 1rem)", async ({ page }) => {
    await setup(page);
    // Open advanced section to ensure #p_etf is visible
    await page.locator("details.advanced summary").click();
    const selectFontSize = await page.locator("#p_etf").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const inputFontSize = await page.locator("#p_birthYear").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(selectFontSize).toBeLessThan(inputFontSize);
    expect(selectFontSize).toBeCloseTo(14.4, 1);
  });
});

test.describe("loan field default value placeholder styling", () => {
  test("new precise loan has placeholder-style on all default numeric fields", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    const row = page.locator(".loan-row").first();
    // gracePeriodMonths 預設摺疊成 + 按鈕，不在這裡檢查
    for (const field of ["balance", "rate", "remainingMonths"]) {
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
  test("出生年超出範圍時顯示 range error", async ({ page }) => {
    await setup(page);
    // 85 is way below min birthYear (currentYear - 80)
    await page.locator("#p_birthYear").fill("85");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);
    const err = page.locator("#err_birthYear");
    const yr = new Date().getFullYear();
    await expect(err).toHaveText(`出生年需介於 ${yr - 80}–${yr} 之間`);
    await expect(page.locator("#p_birthYear")).toHaveClass(/invalid/);
  });

  test("出生年為小數時顯示 integer error", async ({ page }) => {
    await setup(page);
    await page.locator("#p_birthYear").fill("2004.5");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);
    const err = page.locator("#err_birthYear");
    await expect(err).toHaveText("出生年須為整數");
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
    await page.locator("#p_etf").selectOption("14.2");
    await page.waitForTimeout(400);

    const returnVal = await page.locator("#p_return").inputValue();
    expect(returnVal).toBe("14.2");
  });

  test("reset button restores defaults", async ({ page }) => {
    await setup(page);

    // Change some values
    await page.locator("#p_birthYear").fill("35");
    await page.locator("#p_birthYear").blur();
    await page.locator("#p_income").fill("1,000,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(400);

    // Click reset
    page.on("dialog", d => d.accept());
    await page.locator("#resetBtn").click();
    await page.waitForTimeout(400);

    // Verify defaults
    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(22));
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
    await page.locator("#p_birthYear").fill("35");
    await page.locator("#p_birthYear").blur();
    await page.locator("#p_income").fill("800,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");

    // Values should be restored
    expect(await page.locator("#p_birthYear").inputValue()).toBe("35");
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
    await page.locator("#p_birthYear").fill("35");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(300);

    // Now navigate with URL params
    await page.goto("/?age=45&income=1200000&expenses=400000&return=8&inflation=2&incGrowRate=1&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(45));
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

  test("annual payment display updates from balance/rate/months", async ({ page }) => {
    await setup(page);
    await addLoan(page, "房貸", "8,000,000", "2.1", "240");
    const row = page.locator(".loan-row").first();
    const display = row.locator(".loan-annual-display");
    await expect(display).toBeVisible();
    const text = await display.textContent();
    // calcMonthlyPayment(8M, 0.021, 20) = 40,851 → annual = 490,212
    expect(text).toContain("490,212");
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
    // gracePeriodMonths 預設摺疊成 + 按鈕
    await expect(row.locator('.loan-grace-add')).toBeVisible();
    // time-based fields are gone
    await expect(row.locator('input[data-field="deductionDay"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="startDate"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="principal"]')).toHaveCount(0);
    await expect(row.locator('input[data-field="totalMonths"]')).toHaveCount(0);
    // annual-display element still exists
    await expect(row.locator('.loan-annual-display')).toHaveCount(1);
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

  test("simple→precise preserves monthlyPayment as annual display", async ({ page }) => {
    await setup(page);
    await addLoanSimple(page, "房貸", "40,000", "240");
    await switchLoanMode(page, "precise");
    // Annual display should show carried-over monthly × 12 = 480,000
    const display = page.locator('.loan-row .loan-annual-display');
    await expect(display).toContainText("480,000");
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
    // Annual display = monthly × 12 = 480,000
    await expect(page.locator('.loan-row .loan-annual-display')).toContainText("480,000");
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
    await expect(header).toContainText("年繳");
  });

  test("annual display is a separate column in precise mode", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-annual-display');
    await expect(display).toHaveCount(1);
    // monthly 40,851 × 12 = 490,212
    await expect(display).toContainText("490,212");
  });

  test("editing balance updates annual display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-annual-display');
    await expect(display).toContainText("490,212");
    const balance = page.locator('.loan-row input[data-field="balance"]');
    await balance.fill("4,000,000");
    await balance.blur();
    await page.waitForTimeout(300);
    // monthly 20,425 × 12 = 245,100
    await expect(display).toContainText("245,100");
  });

  test("editing remainingMonths updates annual display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    const display = page.locator('.loan-row .loan-annual-display');
    const remaining = page.locator('.loan-row input[data-field="remainingMonths"]');
    await remaining.fill("360");
    await remaining.blur();
    await page.waitForTimeout(300);
    const text = await display.textContent();
    // monthly 29,971 × 12 = 359,652
    expect(text).toContain("359,652");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Simple mode lazy name field
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("loan name field", () => {
  test("simple 模式 1 筆貸款顯示名稱欄", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator(".loan-row").count()).toBe(1);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(1);
  });

  test("simple 模式 1 筆貸款 header 顯示名稱 label", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const headerText = await page.locator(".loan-header").innerText();
    expect(headerText).toContain("名稱");
  });

  test("simple 模式 2 筆貸款顯示名稱欄（每一筆）", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    expect(await page.locator(".loan-row").count()).toBe(2);
    expect(await page.locator('.loan-row input[data-field="name"]').count()).toBe(2);
  });

  test("精準模式 1 筆貸款顯示名稱欄", async ({ page }) => {
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
    expect(await etf.inputValue()).toBe("12.6");
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
    await page.locator("#p_etf").selectOption("14.2");
    await page.waitForTimeout(300);
    await expect(page.locator("#return-group")).toBeHidden();
    expect(await page.locator("#p_return").inputValue()).toBe("14.2");
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
    // First tap on loans summary info-tip (the one in the section header)
    const tip = page.locator("#loansSection summary .info-tip");
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
  test("precise mode 新增貸款時寬限期顯示「+ 寬限期」按鈕（無 input）", async ({ page }) => {
    await setup(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    // 預設摺疊：button 可見、input 不存在
    await expect(page.locator('.loan-row .loan-grace-add')).toBeVisible();
    await expect(page.locator('.loan-row input[data-field="gracePeriodMonths"]')).toHaveCount(0);
  });

  test("點擊「+ 寬限期」→ input 出現並 focus", async ({ page }) => {
    await setup(page);
    await switchLoanMode(page, "precise");
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
    // button 消失、input 出現並 focus
    await expect(page.locator('.loan-row .loan-grace-add')).toHaveCount(0);
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    await expect(graceInput).toBeVisible();
    const focusedField = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('data-field'));
    expect(focusedField).toBe("gracePeriodMonths");
  });

  test("寬限期填值後改回 0 → 還原成 + 按鈕", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    // 展開填 36
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // 改回 0
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("0");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // 還原成按鈕
    await expect(page.locator('.loan-row .loan-grace-add')).toBeVisible();
    await expect(page.locator('.loan-row input[data-field="gracePeriodMonths"]')).toHaveCount(0);
  });

  test("點開「+ 寬限期」但沒填值就 blur → 立即還原", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
    // 不填值，blur（focus 別的欄位）
    await page.locator('.loan-row input[data-field="balance"]').focus();
    await page.waitForTimeout(400);
    // 還原成按鈕
    await expect(page.locator('.loan-row .loan-grace-add')).toBeVisible();
  });

  test("simple mode does not show grace period input", async ({ page }) => {
    await setup(page);
    await ensureLoanSectionOpen(page);
    await page.locator("#addLoanBtn").click();
    await page.waitForTimeout(200);
    const graceInput = page.locator('.loan-row input[data-field="gracePeriodMonths"]');
    await expect(graceInput).toHaveCount(0);
  });

  test("filling grace period months shows annual display", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);
    // Should show grace period annual + normal annual
    const display = page.locator('.loan-row .loan-annual-display');
    const text = await display.textContent();
    expect(text).toContain("寬限");
    expect(text).toContain("之後");
    // grace annual = 8,000,000 × 0.021 = 168,000
    expect(text).toContain("168,000");
  });

  test("年繳 info-tip 顯示對應月繳（驗證用）", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "4,686,026", "2.19", "326");

    // precise 模式有 balance + rate → 永遠顯示 info-tip
    await expect(page.locator('.loan-cell-annual .info-tip')).toHaveCount(1);

    // 沒寬限：tooltip 顯示單一月繳近似值
    let dataTip = await page.locator('.loan-cell-annual .info-tip').getAttribute('data-tip');
    expect(dataTip).toContain('/月');
    expect(dataTip).not.toContain('寬限');

    // 加寬限期 → tooltip 變成「寬限 → 之後」格式
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').fill("36");
    await page.locator('.loan-row input[data-field="gracePeriodMonths"]').blur();
    await page.waitForTimeout(400);

    dataTip = await page.locator('.loan-cell-annual .info-tip').getAttribute('data-tip');
    expect(dataTip).toContain('寬限');
    expect(dataTip).toContain('之後');
    expect(dataTip).toContain('/月');
    // grace monthly = 4,686,026 × 0.0219 / 12 = 8,552
    expect(dataTip).toContain('8,552');
  });

  test("grace period 0 shows annual amount only", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "240");
    // 寬限期摺疊狀態 → input 不存在，「+ 寬限期」按鈕可見
    await expect(page.locator('.loan-row .loan-grace-add')).toBeVisible();
    // Annual display: no 寬限, just annual value
    const display = page.locator('.loan-row .loan-annual-display');
    const text = await display.textContent();
    expect(text).not.toContain("寬限");
    // monthly ≈ 40,851 → annual ≈ 490,212
    expect(text).toContain("490,212");
  });

  test("grace period persists across reload", async ({ page }) => {
    await setup(page);
    await addLoanPrecise(page, "房貸", "8,000,000", "2.1", "360");
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
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
    await page.locator('.loan-row .loan-grace-add').click();
    await page.waitForTimeout(200);
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
    await page.locator("#p_birthYear").fill("35");
    await page.locator("#p_birthYear").blur();
    await page.locator("#p_income").fill("1,500,000");
    await page.locator("#p_income").blur();
    await page.waitForTimeout(400);

    // Open shared link with different values
    await page.goto("/?age=45&income=900000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    // Screen shows URL values
    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(45));
    expect(await page.locator("#p_income").inputValue()).toBe("900,000");

    // localStorage should still have own values (not shared)
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("fire_params");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved.p_birthYear).toBe("35");
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
    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(45));
    expect(page.url()).toContain("shared=1");
  });

  test("editing a field in shared view does NOT save to localStorage", async ({ page }) => {
    // Save own values first
    await setup(page);
    await page.locator("#p_birthYear").fill("28");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=40&income=800000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");

    // Edit a field
    await page.locator("#p_birthYear").fill("42");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);

    // localStorage should still have own values (edits were NOT saved)
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("fire_params");
      return raw ? JSON.parse(raw) : null;
    });
    expect(saved.p_birthYear).toBe("28");
  });

  test("removing URL params restores localStorage values", async ({ page }) => {
    // Save own values first
    await setup(page);
    await page.locator("#p_birthYear").fill("28");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=45&income=900000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(45));

    // Navigate without URL params → restores own values
    await page.goto("/");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_birthYear").inputValue()).toBe("28");
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
    await page.locator("#p_birthYear").fill("28");
    await page.locator("#p_birthYear").blur();
    await page.waitForTimeout(400);

    // Open shared link
    await page.goto("/?age=50&income=2000000&shared=1");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await page.locator("#p_birthYear").inputValue()).toBe(ageToBirthYear(50));
    await expect(page.locator("#shared-banner")).toBeVisible();

    // Click button
    await page.locator("#shared-banner button").click();
    await page.waitForTimeout(400);

    // Own values restored, banner gone, URL clean
    expect(await page.locator("#p_birthYear").inputValue()).toBe("28");
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