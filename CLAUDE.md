# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ブラウザ将棋ゲーム「将棋倶楽部2.4」のモノレポプロジェクト。

- `app/`: ブラウザUI (React 18 + Vite + TypeScript)
- `core/`: 将棋ルールエンジン (純粋TypeScript、外部依存なし)
- `bot/`: CPU対戦ロジック (ランダムBot)
- `server/`: バックエンドAPIサーバー (Node.js HTTP + WebSocket + PostgreSQL)
- `docs/`: 設計・ルールドキュメント

## Common Commands

```bash
npm install          # 依存パッケージのインストール
npm run dev          # Vite開発サーバー起動 (port 5173)
npm run build        # プロダクションビルド (→ dist/)
npm run test         # 全テスト実行 (vitest run)
npx vitest run core/tests/check.test.ts  # 単一テストファイル実行
npx tsx server/src/index.ts              # バックエンドサーバー起動 (port 3000)
```

開発時は2つのターミナルが必要: `npm run dev` (フロントエンド) + `npx tsx server/src/index.ts` (バックエンド)。
Vite dev serverが `/api` と `/health` を `http://127.0.0.1:3000` にプロキシする。

## Architecture

### パッケージ依存関係

```
app → core (型・ルール), bot (ランダム手選択)
server → core (型・ルール)
bot → core (合法手生成)
core → (依存なし)
```

パッケージ間のインポートは相対パスで行う（例: `import { ... } from "../../core/src/types"`）。npm workspaces は未使用。

### core: ゲームエンジン

純粋関数で構成。状態は不変（`tryApplyMove` は新しい `GameState` を返す）。

- `types.ts`: `GameState` = `BoardState`(9x9配列) + `HandState`(持ち駒) + `turn`
- `moveGenerator.ts`: 全合法手の網羅的探索（81マス総当たり）
- `moveExecutor.ts`: 着手適用 → 駒取り・成り・王手チェック
- `moveValidator.ts`: 駒種別の移動パターン検証
- `check.ts` / `checkmate.ts`: 王手・詰み判定
- `promotion.ts`: 成り選択・強制成り判定
- `sfen.ts`: SFEN記法のインポート/エクスポート

### server: REST API + WebSocket

- `app.ts`: HTTPリクエストハンドラ（ルーティング）
- `store.ts`: ゲーム状態管理（PostgreSQL or インメモリ）
- `realtime.ts`: WebSocketハブ（`/api/games/{gameId}/events` でブロードキャスト）
- `auth.ts` / `middleware.ts`: セッショントークン認証（Bearer token、ハッシュ保存）
- `rateLimiter.ts`: トークンバケット方式（120 req/min per IP）

主要エンドポイント:
- `POST /api/lobby/match` — 合言葉マッチング
- `POST /api/games/{gameId}/moves` — 着手送信（認証必須、楽観的バージョニング）
- `POST /api/games/{gameId}/resign` — 投了
- `GET /api/games/{gameId}` — ゲームスナップショット

### app: フロントエンド

- `App.tsx`: メインコンポーネント（ゲーム状態マシン）
- `online/`: HTTP/WebSocketクライアント、セッション管理（localStorage）
- `game/`: ボットモード判定、棋譜テキスト、千日手判定、時間制御
- `ui/`: Board, Hand, Piece, ダイアログ等のコンポーネント

2つのゲームモード: オンライン対戦（サーバー経由）、Bot対戦（ローカル）。
オンラインモードは楽観的更新 + サーバーバージョンとの整合性チェック。

### テスト構成

vitest を使用。`vitest/globals` が tsconfig で有効化済み（`describe`, `test`, `expect` はインポート不要）。
テストヘルパー: `createEmptyState()`, `piece()` でテスト用 GameState を構築。
サーバーテストは実際のHTTPサーバーに対するE2Eテスト。DB テストは `pg-mem` を使用。

### CI

`.github/workflows/ci.yml`: PR・push時に Node.js v22 で `npm ci` → `npm test` → `npm run build` を実行。

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
