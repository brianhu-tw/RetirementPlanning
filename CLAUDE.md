# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A retirement planning simulator ("幾歲能退休？") — a single-page Traditional Chinese (zh-TW) web app. Everything lives in one file: `index.html` (inline CSS + HTML + JS), no build step, no bundler, CDN-loaded Chart.js 4.x.

## Development

Open `index.html` directly in a browser or use any local HTTP server.

### Test

```bash
npm test                                    # run all Playwright tests
npx playwright test tests/unit.spec.ts      # run only unit tests
npx playwright test tests/ui.spec.ts        # run only UI tests
npx playwright test -g "clamp"              # run tests matching a name
```

Tests require the dev server on port 3000 (`npx serve . -l 3000`); Playwright starts it automatically via `playwright.config.ts`.

### Architecture

- All JS lives inside a single `DOMContentLoaded` closure in `index.html` (~2800 lines total: CSS → HTML → JS)
- Key pure functions: `clamp`, `stripCommas`/`addCommas`, `hexAlpha`, `simulate`, `findEarliest`, `c3Returns`
- Input helpers: `initMoneyInput(el, opts)` for money fields, `initNumberInput(el, opts)` for numeric fields — see `/input-fields` skill for full spec
- `simulate(retireAge, params, customReturn?, incomeOverride?, loans?, lMode?)` — core simulation engine, returns `{feasible, ages[], reals[], minPort}`
- `findEarliest(params)` — binary-searches for the earliest feasible retirement age
- `recalculate()` — reads DOM inputs, runs simulation, updates chart and conclusion
- Tests access internals via `window.__TEST__` flag which exposes `window.__FIRE__` bridge with all key functions
- `tests/unit.spec.ts` — pure function tests (via `page.evaluate` against the `__FIRE__` bridge)
- `tests/ui.spec.ts` — DOM interaction / validation / persistence tests

### TDD 開發流程

**每次修改功能都必須遵守以下流程，沒有例外：**

1. **先寫測試** — 在 `tests/` 下新增或修改對應的 test case，描述預期行為。測試應該會失敗（紅燈）。
2. **再寫實作** — 只寫剛好讓測試通過的最少程式碼。
3. **跑測試確認綠燈** — 執行 `npm test`，全部通過才繼續。
4. **重構（可選）** — 改善程式碼品質，跑測試確認沒壞。

**規則：**
- 不准在測試失敗的狀態下 commit。
- 新增函數 → 必須有對應的 unit test。
- 修改 UI 行為 → 必須有對應的 UI test。
- 修 bug → 先寫一個能重現 bug 的測試，再修。

## Design Philosophy

### 「具體金額」vs「模型估算」原則

使用者輸入的數字分兩類，UX 處理方式必須**完全不同**：

| 類別 | 例子 | 使用者狀態 | 容錯空間 |
|---|---|---|---|
| **具體金額** | 月繳房貸、薪資、現有資產、貸款餘額 | 看對帳單就有正確答案 | **0** — 對不起來就破壞整站信任 |
| **模型估算** | 通膨率、報酬率、未來消費成長 | 沒人知道正確答案 | 高 — 合理預設即可 |

**處理原則：**
- 「具體金額」**不能用「差不多就好」「年度加總一樣」搪塞**。使用者口袋少多少錢是鐵的事實，跟我們算出來的對不起來，使用者只會懷疑整個網站。
- 我們提供試算表本身就是「精準」承諾。一旦顯示具體數字（如月繳款），那個數字就必須能對帳，或者必須提供 override 路徑讓使用者填實際值。
- 「模型估算」可以用模糊概念帶過，因為使用者本來就沒有「正確答案」可比對。

### UX 飽和度限制

- 頁面說明文字、tooltip、i 圖示已達飽和。**新增說明只會造成資訊爆炸災難**。
- 不能用「加一行小字解釋誤差」當作解法。
- 解決方案必須整合到既有輸入流程的視覺語言中（例如 placeholder-style、欄位本身的可編輯性暗示），不能依賴額外文字。

### 不精準場景的處理 checklist

當某個顯示的「具體金額」可能與使用者實際數字不符（例如浮動利率、日計息、銀行進位導致的房貸月繳差異），必須：

1. 提供 override 欄位讓使用者直接填實際值
2. Override 欄位本身的視覺呈現要**邀請編輯**（例如 placeholder-style 灰字顯示計算值）
3. 不依賴 tooltip / 警語 / 註腳說明
4. 模擬可以用月度近似，但**顯示給使用者的具體金額**必須優先使用 override 值

## Rules

- All UI text is in Traditional Chinese (zh-TW). Maintain this convention.
- **禁止直接執行 `git push` 或部署。** 所有推送都必須透過 `/deploy` 指令（預設 minor bump，可傳 `major`）。指令會自動跑測試、bump footer 版本號、commit、push。使用者說「改」只代表修改程式碼，不代表授權推送。
