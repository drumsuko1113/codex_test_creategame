# CLAUDE.md

## Project Overview

ブラウザ将棋ゲーム「将棋倶楽部2.4」のモノレポプロジェクト。

- `app/`: ブラウザUI (React + Vite + TypeScript)
- `core/`: 将棋ルールエンジン (TypeScript)
- `bot/`: CPU対戦ロジック (ランダムBot)
- `server/`: バックエンドAPIサーバー (Node.js HTTP + WebSocket + PostgreSQL)
- `docs/`: 設計・ルールドキュメント

## Common Commands

```bash
npm install          # 依存パッケージのインストール
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run test         # テスト実行 (vitest run)
```

## Git Branch Strategy (Mandatory)

git-flow スタイルのワークフローを採用しています。

1. `main`
   - 本番用ブランチ。直接コミット禁止。
2. `develop`
   - 開発統合ブランチ。すべての feature ブランチは `develop` から作成する。
   - 直接コミット/プッシュ禁止。PR マージのみ。
3. `feature/*`
   - 1ブランチ1機能。命名: `feature/<feature-name>`。
   - マージ先は常に `develop`。

## Required Workflow

1. 作業開始前にローカルの `develop` を最新化する。
2. `develop` から新しい `feature/*` ブランチを作成する。
3. スコープ内の機能のみを実装する。
4. `feature/*` → `develop` へ PR を作成する。
5. `main` へのマージはリリースプロセスを通じてのみ行う。
6. `develop` へ直接コミットしない。

## Issue Implementation Protocol (Mandatory)

1. issue は1つずつ対応し、issue ごとに専用ブランチを作成する。
2. ブランチ名に issue 番号を含める（例: `feature/issue-58-<topic>`）。
3. 実装前に、対象 issue の具体的な要件を確認する。
4. TDD をデフォルトとする:
   - テストを先に書き、対象の振る舞いで失敗することを確認する。
   - テストが通る最小限の変更を実装する。
   - テストを維持しながらリファクタリングする。
5. CI 関連の issue は厳密な TDD をスキップしてもよい。
6. 実装後、必ずリグレッションテスト (`npm test`) とビルド確認 (`npm run build`) を実行する。
7. 複数の issue を1つのブランチにまとめない。

## Operational Rules

1. `main` に直接新機能を実装しない。
2. 誤ったブランチで作業を始めた場合、続行前に適切な `feature/*` ブランチに切り替える。
3. コミットは小さく、機能単位にまとめる。

## Reporting Rules (Mandatory)

1. 実装サマリー・PR 説明文・コメントにローカル絶対パス（例: `C:\...`）を含めない。
2. 常にリポジトリ相対パス（例: `server/src/app.ts`）を使用する。
3. PR のタイトル・説明文・レビューコメントは日本語で記述する。
