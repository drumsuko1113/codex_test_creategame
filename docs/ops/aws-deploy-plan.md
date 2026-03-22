# AWS デプロイ構成メモ

Issue: `#57`

## 設計方針

- コストを最小化する（アイドル時ほぼ $0 を目指す）
- ユーザーがアクセスしたときだけリソースが起動する構成にする
- 既存のサーバーコードを変更せずにデプロイできる構成を選ぶ
- WebSocket（リアルタイム同期）を維持する

## アーキテクチャ概要

```
ユーザー（ブラウザ）
  │
  ├── 静的ファイル ──→ CloudFront ──→ S3（フロントエンド）
  │
  └── API / WebSocket ──→ App Runner（バックエンド Node.js）
                                │
                                └──→ Neon（PostgreSQL）
```

## サービス選定

### フロントエンド: S3 + CloudFront

| 項目 | 内容 |
|------|------|
| 用途 | Vite ビルド済み静的ファイルのホスティング |
| 選定理由 | 低トラフィックならほぼ無料、HTTPS 自動対応 |
| コスト | ほぼ $0（Free Tier: S3 5GB, CloudFront 1TB/月 転送） |

### バックエンド: App Runner

| 項目 | 内容 |
|------|------|
| 用途 | Node.js HTTP サーバー + WebSocket |
| 選定理由 | min instances = 0 でアイドル時課金なし、Docker イメージをそのままデプロイ可能 |
| コスト | アイドル時 $0、リクエスト処理時のみ課金 |
| 注意 | コールドスタート（数秒〜十数秒）が発生する。ポーリングフォールバックで対応可能 |

### データベース: Neon（外部 PostgreSQL）

| 項目 | 内容 |
|------|------|
| 用途 | ゲーム状態・棋譜・セッションの永続化 |
| 選定理由 | 無期限無料枠（0.5GB, 190h/月 compute）、5 分無活動で自動サスペンド |
| コスト | $0（Free プラン内） |
| 接続方法 | 通常の PostgreSQL 接続文字列（`DATABASE_URL`）で接続。コード変更不要 |

#### RDS を選ばなかった理由

- RDS Free Tier は AWS アカウント作成から 12 ヶ月限定
- Free Tier 終了後は `db.t4g.micro` でも月 ~$15
- VPC コネクタが必要になり構成が複雑化する
- Neon は無期限無料かつ VPC コネクタ不要で構成がシンプル

### 他の構成案との比較

| 構成 | コード変更 | アイドル時コスト | 構成の複雑さ |
|------|-----------|-----------------|-------------|
| **S3 + App Runner + Neon（採用）** | ほぼなし | $0 | 低 |
| S3 + Lambda + API Gateway WS + Neon | 大（WS 全面改修） | $0 | 高 |
| S3 + ECS Fargate + Neon | なし | $0 | 中〜高 |
| Lightsail 単体 | なし | ~$3.50（常時） | 最低 |

## コスト見込み（低トラフィック想定）

| サービス | 月額 |
|----------|------|
| S3 + CloudFront | ほぼ $0 |
| App Runner (min=0) | アイドル時 $0 |
| Neon (Free) | $0 |
| **合計** | **ほぼ $0** |

## 環境変数設計

| 変数名 | 用途 | 設定先 |
|--------|------|--------|
| `PORT` | サーバーリッスンポート | App Runner（デフォルト 3000） |
| `DATABASE_URL` | Neon 接続文字列 | App Runner |
| `CORS_ORIGIN` | 許可するフロントエンドオリジン | App Runner |
| `VITE_API_BASE_URL` | バックエンド API の URL | フロントエンドビルド時 |
| `VITE_WS_BASE_URL` | WebSocket の URL | フロントエンドビルド時 |

## 作業手順

### Step 1: バックエンドのコンテナ化

1. プロジェクトルートに `Dockerfile` を作成
   - Node.js ベースイメージ
   - TypeScript をビルドして `server/` を起動
   - `PORT` 環境変数でリッスンポートを指定
2. ローカルで `docker build` & `docker run` で動作確認
3. ECR リポジトリを作成し、イメージをプッシュ

### Step 2: Neon データベースのセットアップ

1. [Neon](https://neon.tech) でアカウント作成、プロジェクト作成
2. リージョンは `ap-northeast-1`（東京）を選択
3. 接続文字列（`DATABASE_URL`）を控える
4. `server/src/store.ts` の DB マイグレーション SQL を実行してテーブル作成

### Step 3: App Runner デプロイ

1. AWS コンソールまたは CLI で App Runner サービスを作成
   - ソース: ECR イメージ
   - ポート: 3000
   - **最小インスタンス数: 0**（アイドル時停止）
   - CPU: 0.25 vCPU / メモリ: 0.5 GB（最小構成）
2. 環境変数を設定
   - `DATABASE_URL`: Neon の接続文字列
   - `CORS_ORIGIN`: CloudFront のドメイン
   - `PORT`: 3000
3. ヘルスチェックパス: `GET /health`
4. デプロイ後、App Runner の URL で `GET /health` が返ることを確認

### Step 4: フロントエンドデプロイ

1. フロントエンドの API 接続先を環境変数化（`VITE_API_BASE_URL`, `VITE_WS_BASE_URL`）
   - 現状ハードコードされている場合はコード修正が必要
2. `npm run build` で `dist/` を生成
3. S3 バケットを作成（静的ウェブサイトホスティング有効化）
4. `dist/` の中身を S3 にアップロード
5. CloudFront ディストリビューションを作成
   - オリジン: S3 バケット
   - SPA 対応: エラーページ 403/404 → `/index.html` に 200 で返す
   - HTTPS 有効化（CloudFront デフォルト証明書で OK）

### Step 5: CORS 設定

1. App Runner 側でフロントエンドのオリジン（CloudFront ドメイン）を CORS 許可
   - 現状 `server/src/app.ts` に CORS ヘッダー設定がない場合は追加が必要
2. 動作確認: ブラウザから API リクエストが通ることを検証

### Step 6: 疎通確認

1. CloudFront URL にアクセスしてフロントエンドが表示されることを確認
2. 合言葉マッチングで 2 クライアント対戦フローを実行
   - `match → move → resign` が正常に完了すること
3. WebSocket 接続が確立されリアルタイム同期が動作すること
4. Bot 対局が正常に動作すること（サーバー不要なので問題ないはず）

## 構築前に必要なコード変更

### 必須

1. **Dockerfile 作成** — サーバーのコンテナ化
2. **API URL の環境変数化** — フロントエンドの API 接続先を `VITE_API_BASE_URL` 等で切り替え可能にする
3. **CORS ヘッダー追加** — `server/src/app.ts` にオリジン許可を追加

### 推奨

4. **DB マイグレーションスクリプト整備** — テーブル作成 SQL をまとめる
5. **ヘルスチェック確認** — `GET /health` が既に実装済み（`server/src/app.ts`）

## 運用メモ

- **デプロイ**: ECR にイメージをプッシュ → App Runner が自動デプロイ（自動デプロイ設定時）
- **ロールバック**: App Runner コンソールから前のバージョンに戻す
- **ログ確認**: App Runner の CloudWatch Logs で確認
- **DB 停止**: Neon は 5 分無活動で自動サスペンド。手動操作不要
- **コスト監視**: AWS Budgets（`docs/ops/aws-budgets.md` 参照）で $10 / $30 アラート設定済み
