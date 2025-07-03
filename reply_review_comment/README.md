# GitHub Review Comment Reply MCP Server

GitHub MCPの不足機能を補完するためのカスタムMCPサーバーです。GitHub Public MCPではレビューコメントに対してのコメント（返信）ができないため、この機能を提供します。

## 動作確認済み環境

- macOS（darwin）
- Node.js v18以上
- pnpm
- Cursor IDE

## 機能

- `reply_to_review_comment`: プルリクエストのレビューコメントに対して返信を作成

**注意**: レビューコメントの一覧取得や詳細取得は、公式のGitHub MCPを使用してください。このMCPは返信機能のみを提供します。

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

1. まず、公式のGitHub MCPを使用してレビューコメントを取得：

```
Github MCPを利用してXXのPRのレビューコメントをsyつ置くしてください
```

2. 取得したコメントのIDを使用して返信：

```
このレビューコメントを対応した後で、レビューコメントに対して返信をしてください
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
- プルリクエストがクローズされていても返信は可能
- レビューコメントとIssueコメントは異なるので注意

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