# AWS Budgets Cost Alert Setup

Issue: `#45`

## Goal
- Monthly cost threshold alerts at `$10` and `$30`.
- Delivery to email and SNS.

## Budget Spec
- Budget type: `Cost budget`
- Period: `Monthly`
- Amount: `USD 50`
- Time unit: `Recurring budget`

## Alerts
1. `actual >= 10 USD`
- Notification:
  - Email: platform owner
  - SNS topic: `arn:aws:sns:ap-northeast-1:<account-id>:budget-alerts`

2. `actual >= 30 USD`
- Notification:
  - Email: platform owner + on-call
  - SNS topic: `arn:aws:sns:ap-northeast-1:<account-id>:budget-alerts`

## Validation Checklist
- Budget status is `Active`.
- Alert history contains a test delivery.
- SNS subscription is confirmed.
