English | [简体中文](./README_CN.md)

# GitHub Trending MCP Server

[![npm version](https://img.shields.io/npm/v/@npm_xiyuan/github-trending-mcp.svg)](https://www.npmjs.com/package/@npm_xiyuan/github-trending-mcp)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-1.0-orange.svg)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./nodejs/LICENSE)

A Model Context Protocol (MCP) server that provides AI applications (like Claude Code) with real-time access to GitHub trending repositories and developers data.

## ✨ Core Features

- 🚀 **Real-time Data** - Fetch latest trending data directly from GitHub
- 🔍 **Smart Search** - Keyword fuzzy matching with language filtering
- 📊 **Detailed Stats** - Complete repository info including stars, forks, topics
- 👥 **Developer Tracking** - Track trending developers and their popular repos
- ⚡ **Lightweight & Fast** - Fast data scraping based on cheerio
- 🔧 **Zero Config** - Install and use immediately, no extra setup required
- 🤖 **AI Native** - Designed specifically for Claude Code and other AI tools

## 🚀 Quick Start

### System Requirements

- Node.js 18.0.0 or higher
- Network access to github.com

### Installation

Install globally via npm:

```bash
npm install -g @npm_xiyuan/github-trending-mcp
```

Or run directly with npx (recommended):

```bash
npx @npm_xiyuan/github-trending-mcp
```

## ⚙️ Claude Code Configuration

### Configuration File Location

Depending on your Claude client, the configuration file location varies:

| Client | Configuration File Path |
|--------|------------------------|
| **Claude Desktop (macOS)** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Claude Desktop (Windows)** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Claude Code CLI** | `~/.claude/settings.json` |

### Basic Configuration

Edit the configuration file and add the MCP server configuration:

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

### Configuration Explanation

- **Server Name**: `github-trending` can be customized, used to identify this service in Claude
- **command**: Use `npx` to ensure always running the latest version
- **args**: 
  - `-y`: Auto-confirm installation to avoid interactive prompts
  - Package name: `@npm_xiyuan/github-trending-mcp`

### Verify Configuration

After restarting Claude client, verify the configuration is successful by:

1. Ask Claude: `"Show me today's trending GitHub projects"`
2. If configured successfully, Claude will automatically call MCP tools to fetch data

## 📦 MCP Tools Capabilities

This service provides 9 MCP tools that can be directly called in Claude Code:

### 1. get_trending_repos - Get Trending Repositories

**Description**: Fetch trending repositories from GitHub, with filters for time range and programming language.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `since` | string | No | `"weekly"` | Time range: `"daily"` (today), `"weekly"` (this week), `"monthly"` (this month) |
| `language` | string | No | - | Programming language filter, e.g., `"python"`, `"javascript"`, `"rust"` |
| `limit` | number | No | `10` | Number of results to return, recommended 1-25 |

**Response Data**:
```json
[
  {
    "name": "owner/repo-name",
    "url": "https://github.com/owner/repo-name",
    "description": "Repository description",
    "stars": "1,234 stars today"
  }
]
```

**Use Cases**:
- Discover latest trending open-source projects
- Understand popularity trends for specific programming languages
- Study and research excellent codebases

### 2. get_trending_developers - Get Trending Developers

**Description**: Fetch trending developers from GitHub along with their popular repositories.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `since` | string | No | `"weekly"` | Time range: `"daily"`, `"weekly"`, `"monthly"` |
| `language` | string | No | - | Programming language filter |
| `limit` | number | No | `10` | Number of results to return |

**Response Data**:
```json
[
  {
    "name": "Developer Name",
    "username": "github-username",
    "url": "https://github.com/username",
    "avatar": "Avatar URL",
    "popularRepo": {
      "name": "Popular Repository",
      "description": "Repository description",
      "url": "Repository URL"
    }
  }
]
```

**Use Cases**:
- Follow active excellent developers
- Discover technical experts in specific domains
- Find learning role models and potential collaborators

### 3. search_trending - Search Trending Repositories

**Description**: Search trending repositories by keyword with fuzzy matching on names and descriptions.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keyword` | string | **Yes** | - | Search keyword (case-insensitive) |
| `since` | string | No | `"weekly"` | Time range |
| `language` | string | No | - | Programming language filter |

**Response Data**: Same format as `get_trending_repos`

**Use Cases**:
- Quickly find trending projects for specific tech stacks
- Search for open-source solutions in specific domains
- Precisely locate projects of interest

### 4. get_repo_details - Get Repository Details

**Description**: Get detailed statistics and metadata for a specific GitHub repository.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `owner` | string | **Yes** | - | Repository owner (username or organization) |
| `repo` | string | **Yes** | - | Repository name |

**Response Data**:
```json
{
  "name": "Repository name",
  "fullName": "owner/repo",
  "description": "Repository description",
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

**Use Cases**:
- Deep dive into specific project details
- Evaluate project activity and popularity
- Get project tech stack and topic tags

### 5. analyze_repo - Comprehensive Repository Analysis

**Description**: Get a complete analysis report of a GitHub project in one call, including README, dependencies, directory structure, and recent commits. This is the most powerful and convenient analysis tool for quickly understanding unfamiliar projects.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | **Yes** | Repository owner (username or organization) |
| `repo` | string | **Yes** | Repository name |

**Response Data**:
```json
{
  "basic": {
    "fullName": "owner/repo",
    "stars": 12345,
    "language": "TypeScript",
    "topics": ["react", "typescript"]
  },
  "readme": {
    "content": "# Project Title\n...",
    "size": 5432
  },
  "structure": {
    "rootFiles": ["package.json", "README.md"],
    "directories": ["src", "test", "docs"]
  },
  "dependencies": {
    "detected": true,
    "packageManager": "npm/yarn/pnpm",
    "file": "package.json",
    "content": "{...}"
  },
  "recentActivity": {
    "commits": [...],
    "lastCommitDate": "2024-06-05"
  }
}
```

**Use Cases**:
- Quickly understand an unfamiliar project's purpose and tech stack
- Evaluate project activity and maintenance status
- Get complete technical background information about a project

### 6. get_repo_readme - Get README

**Description**: Fetch the raw README.md content of a GitHub repository.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | **Yes** | Repository owner |
| `repo` | string | **Yes** | Repository name |

**Use Cases**:
- Read project documentation to understand usage
- Extract project introduction and feature descriptions

### 7. get_repo_file - Get File Content

**Description**: Fetch the raw content of a specific file in a GitHub repository.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | **Yes** | Repository owner |
| `repo` | string | **Yes** | Repository name |
| `path` | string | **Yes** | File path, e.g., "package.json" |

**Use Cases**:
- View configuration files (package.json, requirements.txt)
- Read code files to understand implementation details

### 8. get_repo_structure - Get Directory Structure

**Description**: Fetch the directory and file listing of a GitHub repository.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `owner` | string | **Yes** | - | Repository owner |
| `repo` | string | **Yes** | - | Repository name |
| `path` | string | No | `""` | Directory path (empty for root) |

**Use Cases**:
- Understand project file organization
- Browse files in specific directories

### 9. get_repo_commits - Get Commit History

**Description**: Fetch recent commit records of a GitHub repository.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `owner` | string | **Yes** | - | Repository owner |
| `repo` | string | **Yes** | - | Repository name |
| `limit` | number | No | `10` | Number of commits to return |

**Use Cases**:
- Understand recent development activity
- Check project commit frequency and activity level

## 💡 Usage Examples

### Example 1: View Today's Trending Projects

Ask Claude Code:

```
Show me top 10 trending GitHub projects today
```

Claude will automatically call `get_trending_repos` tool to return today's top 10 trending projects.

### Example 2: Search for Specific Tech Stack

```
Find recent trending Rust projects
```

Claude will use `language: "rust"` parameter to filter Rust-related trending projects.

### Example 3: Keyword Search

```
Search GitHub trending projects about AI agents
```

Claude will call `search_trending` tool to search for projects containing "AI agent" keyword.

### Example 4: Get Repository Details

```
Show me detailed information about microsoft/vscode repository
```

Claude will call `get_repo_details` to get complete information including stars, forks, tech stack, etc.

### Example 5: Analyze a GitHub Project

```
Help me analyze the project at https://github.com/microsoft/vscode
```

Claude will call the `analyze_repo` tool to return a comprehensive analysis report including:
- Basic project information (stars, language, topic tags)
- README content
- Project structure (root files and main directories)
- Dependency management (package.json or other config files)
- Recent commit history

This is the most powerful and convenient way to quickly understand an unfamiliar project.

### Example 6: View Trending Developers

```
Show me this week's trending Python developers on GitHub
```

Claude will call the `get_trending_developers` tool to return a list of the most active Python developers this week along with their popular repositories.

### Example 7: Read Project README

```
Help me read the README documentation for facebook/react
```

Claude will call the `get_repo_readme` tool to fetch the complete README.md content of the React project, making it easy to understand the project's usage instructions and features.

### Example 8: View Configuration Files

```
Help me check the package.json file of the vercel/next.js project
```

Claude will call the `get_repo_file` tool to fetch the package.json file content of the Next.js project, allowing you to understand the project's dependencies and script configurations.

### Example 9: View Project Structure

```
Help me see the root directory structure of the nodejs/node project
```

Claude will call the `get_repo_structure` tool to return the root directory files and folders list of the Node.js project, helping you understand the project's organization architecture.

### Example 10: View Commit History

```
Help me check the last 5 commit records of the denoland/deno project
```

Claude will call the `get_repo_commits` tool to return detailed information about the last 5 commits of the Deno project, including committer, commit time, and commit message.

## 🎯 Best Practices

### Performance Optimization Tips

1. **Use Appropriate Time Ranges**: 
   - Use `weekly` for regular browsing
   - Use `daily` for latest updates
   - Use `monthly` for long-term trend analysis

2. **Precise Language Filtering**: 
   - Specify programming language to significantly reduce irrelevant results
   - Supported languages: `python`, `javascript`, `typescript`, `rust`, `go`, `java`, etc.

3. **Control Result Count**: 
   - Default returns 10 results, adjustable as needed
   - Recommend not exceeding 25 to avoid impacting response speed

### Application Scenarios in Claude Code

- **Technology Selection**: Quickly understand the most popular tech solutions in a domain
- **Learning Resources**: Discover high-quality open-source projects for learning
- **Competitive Analysis**: Track open-source implementations of similar products
- **Tech Trends**: Observe popularity changes of emerging technologies and languages
- **Developer Relations**: Find excellent developers and potential collaborators

## 🔧 Troubleshooting

### Common Issues

**Q: Claude cannot recognize MCP tools?**

A: Please check:
1. Configuration file path is correct
2. JSON format is valid (use JSON validator)
3. Claude client has been restarted
4. Run `npx -y @npm_xiyuan/github-trending-mcp` to ensure package works

**Q: Empty or incomplete data returned?**

A: Possible reasons:
1. GitHub trending page structure changed (wait for package update)
2. Network connection issues (check github.com accessibility)
3. Selected language or time range has no trending projects

**Q: How to update to the latest version?**

A: Using npx automatically uses the latest version. If globally installed, run:
```bash
npm update -g @npm_xiyuan/github-trending-mcp
```

## 🛠️ Development Guide

### Local Development

```bash
# Clone the repository
git clone https://github.com/jiyi1990118/github-trending-service.git
cd github-trending-service

# Install dependencies
npm install

# Build the project
npm run build

# Test locally
npm start
```

### Directory Structure

```
nodejs/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools.ts          # Tool definitions
│   └── scraper.ts        # GitHub data scraping logic
├── package.json
└── tsconfig.json
```

### Tech Stack

- **MCP SDK**: `@modelcontextprotocol/sdk` - Model Context Protocol implementation
- **HTTP Client**: `node-fetch` - Make HTTP requests
- **HTML Parser**: `cheerio` - Lightweight server-side jQuery implementation
- **TypeScript**: Type-safe JavaScript superset

### Contributing

Contributions are welcome! Please feel free to submit Issues and Pull Requests.

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Related Links

- [GitHub Repository](https://github.com/jiyi1990118/github-trending-service)
- [npm Package](https://www.npmjs.com/package/@npm_xiyuan/github-trending-mcp)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Claude Desktop Download](https://claude.ai/download)
- [GitHub Trending Page](https://github.com/trending)

## 📮 Feedback & Support

For questions or suggestions, please contact us through:

- Submit GitHub Issues
- Create Pull Requests
- Leave comments on npm page

---

**Note**: This project fetches data by scraping the GitHub Trending page, not through official API. GitHub page structure changes may affect functionality, please update to the latest version promptly.

