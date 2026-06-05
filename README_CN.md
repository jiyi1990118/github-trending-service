[English](./README.md) | 简体中文

# GitHub Trending MCP Server

[![npm version](https://img.shields.io/npm/v/@npm_xiyuan/github-trending-mcp.svg)](https://www.npmjs.com/package/@npm_xiyuan/github-trending-mcp)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-1.0-orange.svg)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./nodejs/LICENSE)

一个基于 Model Context Protocol (MCP) 的服务器，为 AI 应用（如 Claude Code）提供实时访问 GitHub 热门仓库和开发者数据的能力。

## ✨ 核心特性

- 🚀 **实时数据** - 直接从 GitHub 获取最新的热门趋势
- 🔍 **智能搜索** - 支持关键词模糊匹配和语言过滤
- 📊 **详细统计** - 获取仓库的 stars、forks、topics 等完整信息
- 👥 **开发者追踪** - 追踪热门开发者及其代表作品
- ⚡ **轻量高效** - 基于 cheerio 的快速数据抓取
- 🔧 **零配置** - 安装即用，无需额外设置
- 🤖 **AI 原生** - 专为 Claude Code 等 AI 工具设计

## 🚀 快速开始

### 系统要求

- Node.js 18.0.0 或更高版本
- 可访问 github.com 的网络连接

### 安装

使用 npm 全局安装：

```bash
npm install -g @npm_xiyuan/github-trending-mcp
```

或使用 npx 直接运行（推荐）：

```bash
npx @npm_xiyuan/github-trending-mcp
```

## ⚙️ Claude Code 配置

### 配置位置

根据你使用的 Claude 客户端，配置文件位置不同：

| 客户端 | 配置文件路径 |
|--------|-------------|
| **Claude Desktop (macOS)** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Claude Desktop (Windows)** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Claude Code CLI** | `~/.claude/settings.json` |

### 基础配置

编辑配置文件，添加 MCP 服务器配置：

```json
{
  "mcpServers": {
    "github-trending": {
      "command": "npx",
      "args": ["-y", "@npm_xiyuan/github-trending-mcp"]
    }
  }
}
```

### 配置说明

- **服务器名称**: `github-trending` 可自定义，用于在 Claude 中识别此服务
- **command**: 使用 `npx` 确保始终运行最新版本
- **args**: 
  - `-y`: 自动确认安装，避免交互式提示
  - 包名: `@npm_xiyuan/github-trending-mcp`

### 验证配置

重启 Claude 客户端后，你可以通过以下方式验证配置是否成功：

1. 在 Claude 中询问：`"帮我查看 GitHub 今日热门项目"`
2. 如果配置成功，Claude 会自动调用 MCP 工具获取数据

## 📦 MCP 工具能力说明

本服务提供 4 个 MCP 工具，可在 Claude Code 中直接调用：

### 1. get_trending_repos - 获取热门仓库

**功能描述**: 获取 GitHub 上的热门仓库列表，支持按时间范围和编程语言筛选。

**参数说明**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `since` | string | 否 | `"weekly"` | 时间范围：`"daily"` (今日)、`"weekly"` (本周)、`"monthly"` (本月) |
| `language` | string | 否 | - | 编程语言过滤，如 `"python"`, `"javascript"`, `"rust"` |
| `limit` | number | 否 | `10` | 返回结果数量，建议 1-25 |

**返回数据**:
```json
[
  {
    "name": "owner/repo-name",
    "url": "https://github.com/owner/repo-name",
    "description": "项目描述",
    "stars": "1,234 stars today"
  }
]
```

**使用场景**:
- 发现最新的热门开源项目
- 了解特定编程语言的流行趋势
- 学习和研究优秀代码库

### 2. get_trending_developers - 获取热门开发者

**功能描述**: 获取 GitHub 上的热门开发者列表及其代表作品。

**参数说明**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `since` | string | 否 | `"weekly"` | 时间范围：`"daily"`, `"weekly"`, `"monthly"` |
| `language` | string | 否 | - | 编程语言过滤 |
| `limit` | number | 否 | `10` | 返回结果数量 |

**返回数据**:
```json
[
  {
    "name": "开发者名称",
    "username": "github-username",
    "url": "https://github.com/username",
    "avatar": "头像URL",
    "popularRepo": {
      "name": "代表性仓库",
      "description": "仓库描述",
      "url": "仓库链接"
    }
  }
]
```

**使用场景**:
- 关注活跃的优秀开发者
- 发现某个领域的技术专家
- 寻找学习榜样和合作对象

### 3. search_trending - 搜索热门仓库

**功能描述**: 在热门仓库列表中按关键词搜索，支持名称和描述的模糊匹配。

**参数说明**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `keyword` | string | **是** | - | 搜索关键词（不区分大小写） |
| `since` | string | 否 | `"weekly"` | 时间范围 |
| `language` | string | 否 | - | 编程语言过滤 |

**返回数据**: 与 `get_trending_repos` 相同的格式

**使用场景**:
- 快速找到特定技术栈的热门项目
- 搜索特定功能或领域的开源解决方案
- 精准定位感兴趣的项目类型

### 4. get_repo_details - 获取仓库详情

**功能描述**: 获取指定 GitHub 仓库的详细统计信息和元数据。

**参数说明**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `owner` | string | **是** | - | 仓库所有者（用户名或组织名） |
| `repo` | string | **是** | - | 仓库名称 |

**返回数据**:
```json
{
  "name": "仓库名称",
  "fullName": "owner/repo",
  "description": "仓库描述",
  "url": "https://github.com/owner/repo",
  "stars": 12345,
  "forks": 678,
  "watchers": 890,
  "language": "JavaScript",
  "topics": ["react", "typescript", "ui"],
  "createdAt": "2023-01-01",
  "updatedAt": "2024-06-05",
  "license": "MIT"
}
```

**使用场景**:
- 深入了解特定项目的详细信息
- 评估项目的活跃度和受欢迎程度
- 获取项目的技术栈和主题标签

## 💡 使用示例

### 示例 1：查看今日热门项目

在 Claude Code 中询问：

```
帮我查看 GitHub 今日热门项目 top 10
```

Claude 会自动调用 `get_trending_repos` 工具，返回今日最热门的 10 个项目。

### 示例 2：搜索特定技术栈

```
帮我找找最近有哪些热门的 Rust 项目
```

Claude 会使用 `language: "rust"` 参数筛选 Rust 相关的热门项目。

### 示例 3：关键词搜索

```
搜索 GitHub 热门项目中关于 AI agent 的项目
```

Claude 会调用 `search_trending` 工具，在热门列表中搜索包含 "AI agent" 关键词的项目。

### 示例 4：获取仓库详情

```
帮我查看 microsoft/vscode 这个仓库的详细信息
```

Claude 会调用 `get_repo_details` 获取该仓库的 stars、forks、技术栈等完整信息。

## 🎯 最佳实践

### 性能优化建议

1. **合理使用时间范围**: 
   - 日常浏览使用 `weekly` (本周)
   - 快速了解最新动态使用 `daily` (今日)
   - 长期趋势分析使用 `monthly` (本月)

2. **精准语言过滤**: 
   - 指定编程语言可大幅减少无关结果
   - 支持的语言示例: `python`, `javascript`, `typescript`, `rust`, `go`, `java`

3. **控制返回数量**: 
   - 默认返回 10 条结果，可根据需求调整
   - 建议不超过 25 条，避免过多数据影响响应速度

### 在 Claude Code 中的应用场景

- **技术选型**: 快速了解某个领域当前最流行的技术方案
- **学习资源**: 发现高质量的开源项目用于学习
- **竞品分析**: 追踪同类产品的开源实现
- **技术趋势**: 观察新兴技术和编程语言的热度变化
- **开发者关系**: 寻找优秀的开发者和潜在的合作伙伴

## 🔧 故障排除

### 常见问题

**Q: Claude 无法识别 MCP 工具？**

A: 请检查：
1. 配置文件路径是否正确
2. JSON 格式是否有效（使用 JSON 验证器检查）
3. 是否已重启 Claude 客户端
4. 使用 `npx -y @npm_xiyuan/github-trending-mcp` 确保包可正常运行

**Q: 返回数据为空或不完整？**

A: 可能原因：
1. GitHub trending 页面结构变化（等待包更新）
2. 网络连接问题（检查是否能访问 github.com）
3. 选择的语言或时间范围没有热门项目

**Q: 如何更新到最新版本？**

A: 使用 npx 会自动使用最新版本。如果全局安装，运行：
```bash
npm update -g @npm_xiyuan/github-trending-mcp
```

## 🛠️ 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/yourusername/github-trending-service.git
cd github-trending-service/nodejs

# 安装依赖
npm install

# 构建项目
npm run build

# 本地测试
npm start
```

### 目录结构

```
nodejs/
├── src/
│   ├── index.ts          # MCP 服务器入口
│   ├── tools.ts          # 工具定义
│   └── scraper.ts        # GitHub 数据抓取逻辑
├── package.json
└── tsconfig.json
```

### 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk` - Model Context Protocol 实现
- **HTTP 客户端**: `node-fetch` - 发起 HTTP 请求
- **HTML 解析**: `cheerio` - 轻量级的服务器端 jQuery 实现
- **TypeScript**: 类型安全的 JavaScript 超集

### 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](./nodejs/LICENSE) 文件了解详情。

## 🔗 相关链接

- [npm 包地址](https://www.npmjs.com/package/@npm_xiyuan/github-trending-mcp)
- [Model Context Protocol 文档](https://modelcontextprotocol.io)
- [Claude Desktop 下载](https://claude.ai/download)
- [GitHub Trending 页面](https://github.com/trending)

## 📮 反馈与支持

如有问题或建议，欢迎通过以下方式联系：

- 提交 GitHub Issue
- 发起 Pull Request
- 在 npm 页面留言

---

**注意**: 本项目通过爬取 GitHub Trending 页面获取数据，非官方 API。如 GitHub 调整页面结构可能影响功能，请及时更新到最新版本。

