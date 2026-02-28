# Issue #56 永続ストア要件定義

## 背景
- 現在の `InMemoryStore` はプロセス再起動で対局データが消失する。
- オンライン対戦継続性を担保するには、ゲーム状態・参加者・棋譜の永続化が必須。

## 目的
- サーバ状態を PostgreSQL に保存し、再起動後も `create/join/move/resign/snapshot/records` を継続可能にする。
- 既存 API のレスポンス契約とエラーコードを維持する。

## スコープ
- `games`, `game_players`, `moves` を使う Repository 層を実装する。
- ストアを `GameStore` インターフェース化し、`PostgresStore` を追加する。
- `expectedVersion` 競合制御を DB トランザクション + 更新条件で担保する。
- `app.ts` / `middleware.ts` を非同期ストア呼び出しに置換する。
- 起動時に必要な migration を適用できるようにする。

## 非スコープ
- マルチリージョン構成
- シャーディング
- デプロイ基盤の構築（Issue #57）

## 仕様詳細
1. ストアAPI
- `createGame`, `joinGame`, `findPlayerBySessionToken`, `findPlayerByGuestId`, `getGame`, `submitMove`, `resign`, `getMoves` を `Promise` ベースに統一する。

2. 永続化
- `games.state_json` に局面を JSON 保存する。
- `moves.move_json`, `moves.state_json_after` に指し手と着手後局面を保存する。
- `joinToken` は平文を返却し、DB にはハッシュ値のみ保存する。

3. 競合制御
- `submitMove` は対象ゲーム行をロックし、`expectedVersion` 不一致時は `VERSION_CONFLICT` を返す。
- 同時着手時に先着のみ成功し、後着は 409 に変換されることを維持する。

4. 時計処理
- 手番経過秒の差分計算は既存ロジックを踏襲する。
- timeout 発生時は `status=finished`, `resultType=timeout`, `winner` を更新する。

5. 後方互換
- エラーコード文字列（例: `GAME_NOT_FOUND`, `INVALID_JOIN_TOKEN`, `VERSION_CONFLICT`）は維持する。
- API入出力スキーマは変更しない。

## 受け入れ条件
1. `PostgresStore` で `create/join/move/resign/snapshot/records` が動作する。
2. ストア再インスタンス化後も同一 DB から局面・棋譜を取得できる。
3. `expectedVersion` 競合時に `VERSION_CONFLICT` が発生する。
4. 既存テストと追加テストがすべて通過する。
5. `npm run build` が成功する。

## テスト戦略
- Red: PostgreSQL 経路の失敗テストを先に追加する。
- Green: Repository とストア実装を追加してテストを通す。
- Refactor: ストア抽象化と app 依存注入を整理する。
- 回帰: `npm test` と `npm run build` を実行する。
