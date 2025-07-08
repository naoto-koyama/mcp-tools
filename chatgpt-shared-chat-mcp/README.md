# ChatGPT Shared Chat MCP Server

このMCPサーバーは、ChatGPTの共有リンクから会話内容を取得するためのツールです。

## 機能

- ChatGPT共有リンクから会話データを抽出
- 複数の出力形式をサポート（JSON、Markdown、プレーンテキスト）
- メタデータの取得（タイトル、作成日時、更新日時）
- 大きな会話の場合のメッセージ制限機能

## セットアップ

### 1. 依存関係のインストール

```bash
cd chatgpt-shared-chat-mcp
pnpm install
```

### 2. プロジェクトのビルド

```bash
pnpm build
```

### 3. Cursor設定

`~/.cursor/mcp.json`に以下を追加：

```json
{
  "mcpServers": {
    "chatgpt-shared-chat": {
      "command": "node",
      "args": ["/absolute/path/to/chatgpt-shared-chat-mcp/dist/index.js"]
    }
  }
}
```

**実際の設定例**（macOS）:

```json
{
  "mcpServers": {
    "chatgpt-shared-chat": {
      "command": "node",
      "args": ["/Users/username/workspace/mcp-tools/chatgpt-shared-chat-mcp/dist/index.js"]
    }
  }
}
```

## 使い方

### ChatGPTで共有リンクを作成する

1. ChatGPTの会話画面で右上の**共有ボタン**をクリック
2. **「Create link」**または**「リンクを作成する」**を選択
3. 生成されたリンクをコピー

### 基本的な使用方法

```
ChatGPTの共有リンクから会話を取得してください：
https://chatgpt.com/c/686cc57f-feb0-800c-8d46-6f8374ad59e4
```