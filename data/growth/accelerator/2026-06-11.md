# Revenue Accelerator 2026-06-11

Scope: `https://rrih.github.io/` only.

## Revenue Gap

- Target monthly revenue: 50,000 JPY
- Target daily revenue: 1,666.67 JPY
- Actual recorded revenue: 2 JPY
- Actual daily pace: 0.07 JPY/day
- 28-day pageviews: 51
- Current RPM: 39.22 JPY
- Required monthly PV at current RPM: 1,274,860

## Top Actions

### 1. Build Take-Home Pay Calculator

- Type: new-high-cpc-tool
- Target: /tools/take-home-pay-calculator/
- Automation mode: draft-pr
- Priority: 100
- Rationale: annual salary to net income calculator with tax and social insurance breakdown. CPC tier: high; potential: high; effort: medium; policy risk: medium. Income and tax tools can attract higher-value finance queries than generic developer utilities.

### 2. Build Overtime Pay Calculator

- Type: new-high-cpc-tool
- Target: /tools/overtime-pay-calculator/
- Automation mode: draft-pr
- Priority: 99
- Rationale: calculate overtime pay from hourly wage, monthly salary, and premium rate. CPC tier: high; potential: high; effort: medium; policy risk: medium. Labor and salary queries have stable search demand and stronger commercial advertiser fit.

### 3. Build Furusato Tax Limit Calculator

- Type: new-high-cpc-tool
- Target: /tools/furusato-tax-limit-calculator/
- Automation mode: draft-pr
- Priority: 98
- Rationale: estimate furusato tax donation limit from income and family profile. CPC tier: high; potential: high; effort: high; policy risk: medium. Tax-saving queries are monetizable, but the calculation needs careful testing and disclaimers.

### 4. Build Mortgage Prepayment Calculator

- Type: new-high-cpc-tool
- Target: /tools/mortgage-prepayment-calculator/
- Automation mode: draft-pr
- Priority: 97
- Rationale: compare mortgage balance, interest savings, and repayment-period reduction. CPC tier: high; potential: high; effort: high; policy risk: medium. Mortgage queries can have strong RPM, but the tool needs accurate amortization logic.

### 5. Build Retirement Allowance Tax Calculator

- Type: new-high-cpc-tool
- Target: /tools/retirement-allowance-tax-calculator/
- Automation mode: draft-pr
- Priority: 96
- Rationale: estimate retirement allowance deduction and taxable retirement income. CPC tier: high; potential: medium; effort: medium; policy risk: medium. Retirement and tax planning searches are commercially relevant and evergreen.

### 6. Rewrite title/meta for query: css animation generator

- Type: ctr-rewrite
- Target: css animation generator
- Automation mode: draft-pr
- Priority: 70
- Rationale: 61 impressions, 0% CTR, average position 27.2.

### 7. Expand existing tool page: https://rrih.github.io/tools/animation-generator/

- Type: existing-page-expansion
- Target: https://rrih.github.io/tools/animation-generator/
- Automation mode: auto-pr
- Priority: 60
- Rationale: 660 impressions and 2 clicks in the latest GSC window. Add supporting copy, FAQ, and internal links without changing ad density.

### 8. Expand existing tool page: https://rrih.github.io/tools/gradient-generator/

- Type: existing-page-expansion
- Target: https://rrih.github.io/tools/gradient-generator/
- Automation mode: auto-pr
- Priority: 59
- Rationale: 431 impressions and 0 clicks in the latest GSC window. Add supporting copy, FAQ, and internal links without changing ad density.

## Automation Boundary

- `auto-pr`: may be implemented automatically only when deterministic tests and allowlists pass.
- `draft-pr`: Codex may create a PR, but calculation-heavy or policy-sensitive changes need review before merge.
- `issue-only`: record the blocker or recommendation without changing production.
