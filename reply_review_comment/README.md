# GitHub Review Comment Reply & Resolve MCP Server

GitHub MCPの不足機能を補完するためのカスタムMCPサーバーです。GitHub Public MCPではレビューコメントに対してのコメント（返信）やスレッドの解決ができない、またレビューコメントの解決状態が取得できないため、これらの機能を提供します。

## 動作確認済み環境

- macOS（darwin）
- Node.js v18以上
- pnpm
- Cursor IDE

## 機能

- `get_pull_request_comments_with_resolve_status`: レビューコメントを解決状態付きで取得
- `reply_to_review_comment`: プルリクエストのレビューコメントに対して返信を作成
- `resolve_review_thread`: レビューコメントスレッドを解決済みにする
- `unresolve_review_thread`: 解決済みのレビューコメントスレッドを未解決に戻す

**注意**: 基本的なレビューコメントの取得は公式のGitHub MCPでも可能ですが、解決状態が含まれていない場合はこのMCPの`get_pull_request_comments_with_resolve_status`を使用してください。

## セットアップ

### 1. プロジェクトのクローンとビルド

```bash
# プロジェクトのクローン（既存のプロジェクトに追加する場合はスキップ）
git clone https://github.com/yourusername/mcp-tools.git
cd mcp-tools/reply_review_comment

# 依存関係のインストール
pnpm install

# ビルド
pnpm build
```

### 2. GitHub Personal Access Tokenの準備

GitHub Personal Access Tokenを取得してください：

1. GitHub の Settings > Developer settings > Personal access tokens > Tokens (classic) に移動
2. "Generate new token" をクリック
3. 以下の権限を選択：
   - `repo` (Full control of private repositories)
   - `public_repo` (Access public repositories)
   - `read:org` (Read org and team membership)
4. トークンを生成してコピーしておく

### 3. Cursorでの設定

Cursorの設定ファイル（`~/.cursor/mcp.json`）を編集します：

```json
{
  "mcpServers": {
    "github-review-comment-reply": {
      "command": "node",
      "args": ["/path/to/mcp-tools/reply_review_comment/dist/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

**重要**: 
- `/path/to/mcp-tools` を実際のプロジェクトのパスに置き換えてください
- `ghp_xxxxxxxxxxxxxxxxxxxx` を手順2で取得したトークンに置き換えてください
- 設定後、Cursorを完全に再起動してください

## 使い方

### 基本的な使用方法

1. レビューコメントを解決状態付きで取得：

```
このMCPサーバーを使って、owner/repoのPR #123のレビューコメントを解決状態も含めて取得してください
```

返答例：
```json
{
  "success": true,
  "comments": [
    {
      "id": 123456789,
      "body": "This looks good!",
      "user": "reviewer",
      "created_at": "2024-01-01T00:00:00Z",
      "is_resolved": true,
      "resolved_by": "author",
      // ... その他のフィールド
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 30,
    "total": 5
  }
}
```

2. 取得したコメントのIDを使用して返信：

```
このレビューコメントを対応した後で、レビューコメントに対して返信をしてください
```

3. レビューコメントスレッドを解決：

```
このレビューコメントのスレッドを解決済みにしてください
```

## トラブルシューティング

### MCPサーバーが認識されない

1. Cursorの設定ファイル（`~/.cursor/mcp.json`）が正しく設定されているか確認
2. JSONの構文エラーがないか確認（カンマ、括弧など）
3. Cursorを完全に終了して再起動（Cmd+Q / Alt+F4）
4. `dist/index.js` ファイルが存在するか確認（`pnpm build` を実行）

### "GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required" エラー

- mcp.jsonの `env` セクションでトークンが正しく設定されているか確認
- トークンが有効期限切れでないか確認
- トークンの先頭が `ghp_` で始まっているか確認

### 権限エラー

- GitHub Personal Access Tokenに `repo` 権限が付与されているか確認
- プライベートリポジトリの場合、適切なアクセス権限があるか確認
- 組織のリポジトリの場合、組織の設定でトークンアクセスが許可されているか確認

### MCPコマンドが失敗する

- 対象のレビューコメントが存在するか確認（削除されていないか）
- `owner`, `repo`, `pull_number`, `comment_id` が正確か確認
- プルリクエストがクローズされていても返信・解決は可能
- レビューコメントとIssueコメントは異なるので注意

### スレッドが解決できない

- 解決権限があるか確認（通常はPRの作成者またはリポジトリへの書き込み権限を持つユーザー）
- すでに解決済みのスレッドを再度解決しようとしていないか確認
- `comment_id` が正しいレビューコメントのIDか確認

## 開発

### 開発モードで実行

```bash
pnpm dev
```

### ビルド

```bash
pnpm build
```

### ログの確認

MCPサーバーのログは標準エラー出力に出力されます。Cursorのデベロッパーツール（View > Toggle Developer Tools）でエラーを確認できます。

## ライセンス

MIT 