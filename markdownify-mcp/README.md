# Markdownify MCP Server（日本語版）

様々なファイル形式やWebコンテンツをMarkdown形式に変換するMCPサーバーです。

このプロジェクトは[zcaceres/markdownify-mcp](https://github.com/zcaceres/markdownify-mcp)をベースに、日本語ドキュメントを追加したものです。

## 機能

- 複数のファイル形式をMarkdownに変換：
  - PDF
  - 画像（OCR機能付き）
  - 音声ファイル（転写機能付き）
  - DOCX
  - XLSX
  - PPTX
- Webコンテンツの変換：
  - YouTube動画の転写
  - Bing検索結果
  - 一般的なWebページ
- 既存のMarkdownファイルの取得

## セットアップ

### 1. 依存関係のインストール

```bash
cd markdownify-mcp
pnpm install
```

### 2. Pythonの依存関係のセットアップ

```bash
# Unix/Linux/macOSの場合
chmod +x setup.sh
./setup.sh

# Windowsの場合
setup.bat
```

### 3. プロジェクトのビルド

```bash
pnpm build
```

### 4. Cursor設定

`~/.cursor/mcp.json`に以下を追加：

```json
{
  "mcpServers": {
    "markdownify": {
      "command": "node",
      "args": ["/absolute/path/to/markdownify-mcp/dist/index.js"],
      "env": {
        "UV_PATH": "/path/to/uv"
      }
    }
  }
}
```

**実際の設定例**（macOS）:

```json
{
  "mcpServers": {
    "markdownify": {
      "command": "node",
      "args": ["/Users/username/workspace/mcp-tools/markdownify-mcp/dist/index.js"],
      "env": {
        "UV_PATH": "/Users/username/.local/bin/uv"
      }
    }
  }
}
```

## 使い方

Cursorを再起動後、以下のように使用できます：

### PDFファイルの変換

```
このPDFファイルをMarkdownに変換してください：
/path/to/document.pdf
```

### 画像からテキスト抽出

```
この画像内のテキストを抽出してMarkdownで表示してください：
/path/to/image.png
```

### YouTube動画の転写

```
このYouTube動画の内容をMarkdownで取得してください：
https://www.youtube.com/watch?v=VIDEO_ID
```

### Webページの変換

```
このWebページの内容をMarkdownに変換してください：
https://example.com/article
```

## 利用可能なツール

1. **youtube-to-markdown** - YouTube動画を転写付きでMarkdownに変換
2. **pdf-to-markdown** - PDFファイルをMarkdownに変換
3. **bing-search-to-markdown** - Bing検索結果をMarkdownに変換
4. **webpage-to-markdown** - WebページをMarkdownに変換
5. **image-to-markdown** - 画像をメタデータと説明付きでMarkdownに変換
6. **audio-to-markdown** - 音声ファイルを転写付きでMarkdownに変換
7. **docx-to-markdown** - DOCXファイルをMarkdownに変換
8. **xlsx-to-markdown** - XLSXファイルをMarkdownに変換
9. **pptx-to-markdown** - PPTXファイルをMarkdownに変換
10. **get-markdown-file** - 既存のMarkdownファイルを取得

## トラブルシューティング

### uvが見つからない場合

```bash
# uvの再インストール
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```

### Pythonの依存関係エラー

```bash
# Pythonの依存関係を再インストール
cd markdownify-mcp
uv sync
```

### 画像のOCR処理が失敗する場合

- OCRには`markitdown`ライブラリを使用しています
- 複雑な画像や低解像度の画像では精度が低下することがあります
- 画像の品質を向上させてから再試行してください

### 音声ファイルの転写が失敗する場合

- 対応している音声形式を確認してください
- ファイルサイズが大きすぎる場合は、分割して処理してください

## 注意事項

- ファイルパスは絶対パスで指定してください
- 大きなファイルの処理には時間がかかることがあります
- 一部の機能はインターネット接続が必要です（YouTube、Webページ変換）
- OCRや音声転写の精度は元のファイルの品質に依存します

## 必要なシステム要件

- Node.js 18以上
- Python 3.11以上
- uv（Python パッケージマネージャー）
- インターネット接続（Web関連機能使用時）

## ライセンス

このプロジェクトはMITライセンスの下で提供されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 元のプロジェクト

このプロジェクトは[zcaceres/markdownify-mcp](https://github.com/zcaceres/markdownify-mcp)をベースにしています。 