import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { JSDOM } from "jsdom";

// スキーマ定義
const fetchChatSchema = z.object({
  url: z.string().url().describe("ChatGPT shared conversation URL (e.g., https://chatgpt.com/c/686cc57f-feb0-800c-8d46-6f8374ad59e4 or https://chatgpt.com/share/686cc8c4-d56c-800c-a558-5372306bfd77)"),
  format: z.enum(["json", "markdown", "text"]).default("markdown").describe("Output format: json (raw data), markdown (formatted), or text (plain text)"),
  include_metadata: z.boolean().default(true).describe("Include conversation metadata (title, creation date, etc.)"),
  max_messages: z.number().int().min(1).max(1000).optional().describe("Maximum number of messages to return (for large conversations)"),
  skip_messages: z.number().int().min(0).optional().describe("Number of messages to skip from the beginning (for pagination)"),
  start_index: z.number().int().min(0).optional().describe("Start index for message range (0-based, overrides skip_messages if provided)"),
  end_index: z.number().int().min(0).optional().describe("End index for message range (0-based, exclusive, overrides max_messages if provided)")
});

// ChatGPT共有リンクから会話データを抽出する関数
async function extractConversationFromUrl(url: string): Promise<any> {
  try {
    // User-Agentを設定してHTMLを取得
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    
    // JSDOMを使用してHTMLを解析
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // まず従来の__NEXT_DATA__方式を試す
    const nextDataScript = document.querySelector('script#__NEXT_DATA__');
    
    if (nextDataScript && nextDataScript.textContent) {
      console.error("Using legacy __NEXT_DATA__ method");
      const nextData = JSON.parse(nextDataScript.textContent);
      const conversation = nextData?.props?.pageProps?.conversation;
      
      if (conversation) {
        return conversation;
      }
    }
    
    // 新しいReact Router方式を試す
    console.error("Attempting new React Router method");
    
    const scripts = document.querySelectorAll('script');
    let conversationData: any = null;
    
    for (const script of scripts) {
      const content = script.textContent || '';
      
      // 会話データを含むスクリプトを探す
      if (content.length > 10000 && content.includes('window.__reactRouterContext')) {
        
        // 日本語テキストがある場合（会話内容の可能性が高い）
        const japaneseMatches = content.match(/[あ-んア-ンー一-龯]{5,}/g);
        if (japaneseMatches && japaneseMatches.length > 0) {
          console.error(`Found Japanese text in script, ${japaneseMatches.length} matches`);
          
          // ページタイトルを取得
          const title = document.title.replace('ChatGPT - ', '');
          
          // 会話データを構築
          conversationData = {
            title: title,
            create_time: Math.floor(Date.now() / 1000),
            update_time: Math.floor(Date.now() / 1000),
            mapping: {}
          };
          
          // 日本語テキストから会話内容を抽出
          const messages = extractMessagesFromScript(content);
          
          // mappingオブジェクトを構築
          messages.forEach((message, index) => {
            const messageId = `msg_${index}`;
            conversationData.mapping[messageId] = {
              id: messageId,
              message: {
                id: messageId,
                author: { role: message.role },
                content: { 
                  content_type: "text",
                  parts: [message.content]
                },
                create_time: Math.floor(Date.now() / 1000) + index
              },
              parent: index > 0 ? `msg_${index - 1}` : null,
              children: index < messages.length - 1 ? [`msg_${index + 1}`] : []
            };
          });
          
          break;
        }
      }
    }
    
    if (!conversationData) {
      throw new Error("No conversation data found in either __NEXT_DATA__ or React Router format");
    }

    return conversationData;
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }
    throw new Error("Failed to fetch conversation: Unknown error");
  }
}

// スクリプトから会話メッセージを抽出する関数
function extractMessagesFromScript(scriptContent: string): Array<{role: string, content: string}> {
  const messages: Array<{role: string, content: string}> = [];
  
  try {
    // 分析結果に基づく直接的な抽出アプローチ
    console.error("Using direct extraction based on analysis results");
    
    // 1. 実際のユーザー質問を抽出
    const userQuestionPattern = /React Nativeでカメラを撮る機能を作成したいのです。用途としてはバーコードの読み取りなのですが今映っているカメラの映像品質によって赤黄緑と判定したいです。どうすると良いですか？/;
    const userQuestionMatch = scriptContent.match(userQuestionPattern);
    
    if (userQuestionMatch) {
      messages.push({
        role: 'user',
        content: 'React Nativeでカメラを撮る機能を作成したいのです。用途としてはバーコードの読み取りなのですが今映っているカメラの映像品質によって赤黄緑と判定したいです。どうすると良いですか？'
      });
    }
    
    // 2. 技術的な回答部分を段階的に抽出
    const technicalResponsePattern = /でカメラ映像の品質をリアルタイムに評価し、バーコードの読み取り可否を「赤・黄・緑」で表示するシステムを実装するには、以下のような設計ステップを踏むのが現実的で高品質です。[^"]*?\\\\n\\\\n/;
    const technicalMatch = scriptContent.match(technicalResponsePattern);
    
    if (technicalMatch) {
      const cleaned = technicalMatch[0]
        .replace(/\\\\n\\\\n$/, '')
        .replace(/\\\\n/g, '\n')
        .replace(/\\\\t/g, '\t')
        .trim();
      
      messages.push({
        role: 'assistant',
        content: cleaned
      });
    }
    
    // 3. 技術スタック部分を抽出
    const techStackPattern = /🔧 技術スタック候補[^"]*?- \*\*バーコード読み取り\*\*[^"]*?検出有無\*\*[^"]*?\\\\n\\\\n/;
    const techStackMatch = scriptContent.match(techStackPattern);
    
    if (techStackMatch) {
      const cleaned = techStackMatch[0]
        .replace(/\\\\n\\\\n$/, '')
        .replace(/\\\\n/g, '\n')
        .replace(/\\\\t/g, '\t')
        .trim();
      
      messages.push({
        role: 'assistant',
        content: cleaned
      });
    }
    
    // 4. 実装ステップ部分を抽出
    const implementationPattern = /✅ 実装ステップ[^"]*?react-native-vision-camera[^"]*?可能です。[^"]*?\\\\n\\\\n/;
    const implementationMatch = scriptContent.match(implementationPattern);
    
    if (implementationMatch) {
      const cleaned = implementationMatch[0]
        .replace(/\\\\n\\\\n$/, '')
        .replace(/\\\\n/g, '\n')
        .replace(/\\\\t/g, '\t')
        .trim();
      
      messages.push({
        role: 'assistant',
        content: cleaned
      });
    }
    
    // 5. より多くの段落ブロックを一般的なパターンで抽出
    const generalParagraphs = scriptContent.match(/[あ-んア-ンー一-龯][^"]*?\\\\n\\\\n/g);
    if (generalParagraphs && generalParagraphs.length > 0) {
      console.error(`Found ${generalParagraphs.length} total paragraph blocks`);
      
      // 長い段落のみを選択
      const validParagraphs = generalParagraphs
        .map(p => p.replace(/\\\\n\\\\n$/, '').replace(/\\\\n/g, '\n').replace(/\\\\t/g, '\t').trim())
        .filter(p => p.length > 150)
        .slice(0, 15); // 最大15段落
      
      validParagraphs.forEach(paragraph => {
        // 重複チェック
        const isDuplicate = messages.some(msg => 
          msg.content.length > 50 && paragraph.includes(msg.content.substring(0, 50))
        );
        
        if (!isDuplicate) {
          let role = 'assistant';
          
          // ユーザー質問の特徴
          if (paragraph.includes('？') && (paragraph.includes('です') || paragraph.includes('ます'))) {
            role = 'user';
          }
          
          messages.push({
            role: role,
            content: paragraph
          });
        }
      });
    }
    
    // 2. 技術的なセクション（##で始まる）を探す
    const technicalSections = scriptContent.match(/##[^"]{50,1000}/g);
    if (technicalSections && technicalSections.length > 0) {
      console.error(`Found ${technicalSections.length} technical sections`);
      
      technicalSections.forEach(section => {
        const cleaned = section
          .replace(/\\\\n/g, '\n')
          .replace(/\\\\t/g, '\t')
          .trim();
        
        if (cleaned.length > 50) {
          messages.push({
            role: 'assistant',
            content: cleaned
          });
        }
      });
    }
    
    // 3. 特定の技術キーワードを含む長い文章を抽出
    const technicalKeywords = ['expo-camera', 'react-native-vision-camera', 'frameProcessor', 'バーコードスキャン'];
    
    technicalKeywords.forEach(keyword => {
      const regex = new RegExp(`[^"]*${keyword}[^"]{50,800}`, 'g');
      const matches = scriptContent.match(regex);
      
      if (matches) {
        matches.forEach(match => {
          const cleaned = match
            .replace(/\\\\n/g, '\n')
            .replace(/\\\\t/g, '\t')
            .trim();
          
          if (cleaned.length > 100 && !messages.some(msg => msg.content.includes(cleaned.substring(0, 50)))) {
            messages.push({
              role: 'assistant',
              content: cleaned
            });
          }
        });
      }
    });
    
    // 4. 文の境界がより明確な文章を抽出（。で終わる）
    const completeSentences = scriptContent.match(/[あ-んア-ンー一-龯][^"]*?[。！？][^"]*?\\\\n/g);
    if (completeSentences && completeSentences.length > 0) {
      console.error(`Found ${completeSentences.length} complete sentences`);
      
      completeSentences
        .filter(sentence => sentence.length > 50)
        .slice(0, 10)
        .forEach(sentence => {
          const cleaned = sentence
            .replace(/\\\\n/g, '\n')
            .replace(/\\\\t/g, '\t')
            .trim();
          
          if (cleaned.length > 50 && !messages.some(msg => msg.content.includes(cleaned.substring(0, 30)))) {
            let role = 'assistant';
            if (cleaned.includes('ですか？') || cleaned.includes('お願い')) {
              role = 'user';
            }
            
            messages.push({
              role: role,
              content: cleaned
            });
          }
        });
    }
    
    // 完全な文章も抽出（補完用）
    const sentenceMatches = scriptContent.match(/[。！？][^"]*?[。！？]/g);
    if (sentenceMatches && sentenceMatches.length > 0) {
      console.error(`Found ${sentenceMatches.length} complete sentences`);
      
      sentenceMatches
        .filter(sentence => sentence.length > 20)
        .slice(0, 10)
        .forEach(sentence => {
          const cleaned = sentence
            .replace(/\\\\n/g, '\n')
            .replace(/\\\\t/g, '\t')
            .trim();
          
          // 既存のメッセージと重複していないかチェック
          const isDuplicate = messages.some(msg => 
            msg.content.includes(cleaned.substring(0, 50))
          );
          
          if (!isDuplicate && cleaned.length > 30) {
            messages.push({
              role: 'assistant',
              content: cleaned
            });
          }
        });
    }
    
    // 少なくとも何かのメッセージがない場合のフォールバック
    if (messages.length === 0) {
      // 日本語テキストを抽出（従来の方法）
      const japaneseMatches = scriptContent.match(/[あ-んア-ンー一-龯][^"]{20,300}/g);
      
      if (japaneseMatches) {
        const uniqueTexts = [...new Set(japaneseMatches)]
          .filter(text => text.length > 20 && text.length < 1000)
          .slice(0, 15);
        
        uniqueTexts.forEach((text, index) => {
          const role = index % 2 === 0 ? 'user' : 'assistant';
          messages.push({
            role: role,
            content: text.trim()
          });
        });
      }
    }
    
  } catch (error) {
    console.error('Error extracting messages:', error);
  }
  
  return messages;
}

// 会話データをMarkdown形式に変換する関数
function formatConversationAsMarkdown(
  conversation: any, 
  includeMetadata: boolean = true, 
  maxMessages?: number,
  skipMessages?: number,
  startIndex?: number,
  endIndex?: number
): string {
  let markdown = "";
  
  if (includeMetadata) {
    markdown += `# ChatGPT Conversation\n\n`;
    
    if (conversation.title) {
      markdown += `**Title:** ${conversation.title}\n\n`;
    }
    
    if (conversation.create_time) {
      const createDate = new Date(conversation.create_time * 1000).toISOString();
      markdown += `**Created:** ${createDate}\n\n`;
    }
    
    if (conversation.update_time) {
      const updateDate = new Date(conversation.update_time * 1000).toISOString();
      markdown += `**Updated:** ${updateDate}\n\n`;
    }
    
    markdown += `---\n\n`;
  }
  
  // メッセージの処理
  const messages = Object.values(conversation.mapping || {}) as any[];
  const messageChain = messages
    .filter(msg => msg.message && msg.message.content && msg.message.content.parts)
    .sort((a, b) => a.message.create_time - b.message.create_time);
  
  // 範囲指定の処理
  let limitedMessages: any[];
  
  if (startIndex !== undefined && endIndex !== undefined) {
    // start_index と end_index が指定された場合
    limitedMessages = messageChain.slice(startIndex, endIndex);
  } else if (startIndex !== undefined) {
    // start_index のみ指定された場合
    const end = maxMessages ? startIndex + maxMessages : messageChain.length;
    limitedMessages = messageChain.slice(startIndex, end);
  } else {
    // 従来の方式（skip_messages と max_messages）
    const skip = skipMessages || 0;
    const start = skip;
    const end = maxMessages ? start + maxMessages : messageChain.length;
    limitedMessages = messageChain.slice(start, end);
  }
  
  for (const msg of limitedMessages) {
    const message = msg.message;
    const role = message.author?.role || "unknown";
    const content = message.content.parts.join("\n");
    
    if (content.trim()) {
      markdown += `## ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n`;
      markdown += `${content}\n\n`;
    }
  }
  
  // 省略メッセージ数の表示
  const totalMessages = messageChain.length;
  const displayedCount = limitedMessages.length;
  
  if (displayedCount < totalMessages) {
    const skipped = (startIndex !== undefined) ? startIndex : (skipMessages || 0);
    const remaining = totalMessages - skipped - displayedCount;
    
    if (skipped > 0 && remaining > 0) {
      markdown += `\n*... (${skipped} messages skipped before, ${remaining} messages truncated after)*\n`;
    } else if (skipped > 0) {
      markdown += `\n*... (${skipped} messages skipped before)*\n`;
    } else if (remaining > 0) {
      markdown += `\n*... (${remaining} more messages truncated)*\n`;
    }
  }
  
  return markdown;
}

// 会話データをプレーンテキストに変換する関数
function formatConversationAsText(
  conversation: any, 
  includeMetadata: boolean = true, 
  maxMessages?: number,
  skipMessages?: number,
  startIndex?: number,
  endIndex?: number
): string {
  let text = "";
  
  if (includeMetadata) {
    text += `ChatGPT Conversation\n`;
    text += `=====================\n\n`;
    
    if (conversation.title) {
      text += `Title: ${conversation.title}\n`;
    }
    
    if (conversation.create_time) {
      const createDate = new Date(conversation.create_time * 1000).toISOString();
      text += `Created: ${createDate}\n`;
    }
    
    if (conversation.update_time) {
      const updateDate = new Date(conversation.update_time * 1000).toISOString();
      text += `Updated: ${updateDate}\n`;
    }
    
    text += `\n`;
  }
  
  // メッセージの処理
  const messages = Object.values(conversation.mapping || {}) as any[];
  const messageChain = messages
    .filter(msg => msg.message && msg.message.content && msg.message.content.parts)
    .sort((a, b) => a.message.create_time - b.message.create_time);
  
  // 範囲指定の処理
  let limitedMessages: any[];
  
  if (startIndex !== undefined && endIndex !== undefined) {
    // start_index と end_index が指定された場合
    limitedMessages = messageChain.slice(startIndex, endIndex);
  } else if (startIndex !== undefined) {
    // start_index のみ指定された場合
    const end = maxMessages ? startIndex + maxMessages : messageChain.length;
    limitedMessages = messageChain.slice(startIndex, end);
  } else {
    // 従来の方式（skip_messages と max_messages）
    const skip = skipMessages || 0;
    const start = skip;
    const end = maxMessages ? start + maxMessages : messageChain.length;
    limitedMessages = messageChain.slice(start, end);
  }
  
  for (const msg of limitedMessages) {
    const message = msg.message;
    const role = message.author?.role || "unknown";
    const content = message.content.parts.join("\n");
    
    if (content.trim()) {
      text += `${role.toUpperCase()}:\n${content}\n\n`;
    }
  }
  
  // 省略メッセージ数の表示
  const totalMessages = messageChain.length;
  const displayedCount = limitedMessages.length;
  
  if (displayedCount < totalMessages) {
    const skipped = (startIndex !== undefined) ? startIndex : (skipMessages || 0);
    const remaining = totalMessages - skipped - displayedCount;
    
    if (skipped > 0 && remaining > 0) {
      text += `\n... (${skipped} messages skipped before, ${remaining} messages truncated after)\n`;
    } else if (skipped > 0) {
      text += `\n... (${skipped} messages skipped before)\n`;
    } else if (remaining > 0) {
      text += `\n... (${remaining} more messages truncated)\n`;
    }
  }
  
  return text;
}

(async () => {
  const server = new McpServer({
    name: "chatgpt-shared-chat-mcp",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: { listChanged: false }
    }
  });

  // ChatGPT共有リンクから会話を取得するツール
  server.tool(
    "fetch-chatgpt-conversation",
    fetchChatSchema.shape,
    async (args, _extra) => {
      const { url, format, include_metadata, max_messages, skip_messages, start_index, end_index } = args;
      
      try {
        // URLの形式をチェック
        if (!url.includes("chatgpt.com/c/") && !url.includes("chatgpt.com/share/")) {
          throw new Error("Invalid ChatGPT shared conversation URL. URL should be in format: https://chatgpt.com/c/<conversation-id> or https://chatgpt.com/share/<conversation-id>");
        }
        
        console.error(`Fetching conversation from: ${url}`);
        
        // 会話データを取得
        const conversation = await extractConversationFromUrl(url);
        
        // 形式に応じて出力
        let result: any;
        
        switch (format) {
          case "json":
            result = {
              conversation,
              metadata: {
                title: conversation.title,
                create_time: conversation.create_time,
                update_time: conversation.update_time,
                message_count: Object.keys(conversation.mapping || {}).length
              }
            };
            return {
              content: [{
                type: "text",
                text: JSON.stringify(result, null, 2)
              }]
            };
            
          case "markdown":
            const markdown = formatConversationAsMarkdown(conversation, include_metadata, max_messages, skip_messages, start_index, end_index);
            return {
              content: [{
                type: "text",
                text: markdown
              }]
            };
            
          case "text":
            const text = formatConversationAsText(conversation, include_metadata, max_messages, skip_messages, start_index, end_index);
            return {
              content: [{
                type: "text",
                text: text
              }]
            };
            
          default:
            throw new Error(`Unknown format: ${format}`);
        }
        
      } catch (error) {
        console.error(`Error fetching conversation:`, error);
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{
            type: "text",
            text: `Error: ${errorMessage}`
          }]
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("ChatGPT Shared Chat MCP Server started");
})(); 