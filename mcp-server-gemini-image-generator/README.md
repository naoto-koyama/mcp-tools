# Gemini Image Generator MCP Server（日本語版）

Gemini AIを使用して画像を生成するMCPサーバーです。

このプロジェクトは[qhdrl12/mcp-server-gemini-image-generator](https://github.com/qhdrl12/mcp-server-gemini-image-generator)をベースに、一部修正を加えたものです。

## 修正内容

1. **UTF-8シリアライゼーションエラーの修正**
   - `server.py`でバイナリデータとファイルパスのタプルを返していた部分を、ファイルパスのみを返すように修正
   - これによりMCPプロトコルでのUTF-8エンコーディングエラーを解消

2. **画像の自動オープン機能の改善**
   - `utils.py`で一時ファイルではなく、実際に保存されたPNGファイルを開くように修正
   - プラットフォームに応じた適切なコマンド（open/start/xdg-open）を使用

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/qhdrl12/mcp-server-gemini-image-generator.git
cd mcp-server-gemini-image-generator
```

### 2. Gemini API Keyの取得

1. [Google AI Studio](https://aistudio.google.com/apikey)にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 生成されたAPIキーをコピー

### 3. Python環境のセットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 4. 環境設定

プロジェクトルートに`.env`ファイルを作成：

```
GEMINI_API_KEY="your-gemini-api-key-here"
OUTPUT_IMAGE_PATH="/path/to/save/images"
```

### 5. Cursorの設定

`~/.cursor/mcp.json`に以下を追加：

```json
{
  "mcpServers": {
    "Gemini Image Generator": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["-m", "mcp_server_gemini_image_generator.server"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key",
        "OUTPUT_IMAGE_PATH": "/path/to/save/images",
        "PYTHONPATH": "/absolute/path/to/src"
      }
    }
  }
}
```

**実際の設定例**（macOS）:

```json
{
  "mcpServers": {
    "Gemini Image Generator": {
      "command": "/Users/username/workspace/mcp-tools/mcp-server-gemini-image-generator/.venv/bin/python",
      "args": ["-m", "mcp_server_gemini_image_generator.server"],
      "env": {
        "GEMINI_API_KEY": "AIzaSy...",
        "OUTPUT_IMAGE_PATH": "/Users/username/Desktop/gemini-images",
        "PYTHONPATH": "/Users/username/workspace/mcp-tools/mcp-server-gemini-image-generator/src"
      }
    }
  }
}
```

## 使い方

Cursorを再起動後、以下のように使用できます：

### テキストから画像生成

```
Geminiを使って夕暮れの富士山の画像を生成してください
```

### 画像の変換

```
この画像に雪を追加してください
```

## 利用可能なツール

1. **generate_image_from_text** - テキストプロンプトから画像を生成
2. **transform_image_from_encoded** - Base64エンコードされた画像を変換
3. **transform_image_from_file** - ファイルパスから画像を読み込んで変換

## トラブルシューティング

### UTF-8エラーが発生する場合

- 修正済みのコードを使用しているか確認してください
- `server.py`がファイルパスのみを返すように修正されているか確認

### API Keyが認識されない

- `~/.cursor/mcp.json`の環境変数設定を確認
- APIキーが正しくコピーされているか確認

### 画像が保存されない

- `OUTPUT_IMAGE_PATH`で指定したディレクトリが存在するか確認
- 書き込み権限があるか確認

## 注意事項

- Gemini APIには無料枠がありますが、使用量に制限があります
- 生成される画像のサイズは大きい場合があるので、ストレージに注意してください
- 画像は指定したディレクトリに保存され、自動的に開かれます

## ライセンス

オリジナルのリポジトリのライセンスに従います。詳細は[元のリポジトリ](https://github.com/qhdrl12/mcp-server-gemini-image-generator)を参照してください。 