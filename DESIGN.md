# GitHub 项目分析功能设计文档

## 1. 概述

### 1.1 设计目标

为 GitHub Trending MCP Server 添加项目深度分析能力，使 AI 能够理解任意 GitHub 公开仓库的用途、技术栈和项目状态。

### 1.2 用户场景

```
用户: "帮我分析一下 https://github.com/owner/repo 这个项目干什么的"
AI: 调用 analyze_repo 工具 → 返回项目完整分析报告
```

### 1.3 设计原则

- **最小化代码**: 只添加必需功能，避免过度设计
- **使用官方 API**: 依赖 GitHub REST API v3，稳定可靠
- **无需认证**: 仅支持公开仓库，避免 token 配置复杂度
- **智能整合**: 一次调用获取完整分析，减少 AI 调用次数

## 2. 功能设计

### 2.1 新增工具列表

本次设计新增 **5 个 MCP 工具**：

| 工具名称 | 类型 | 功能描述 |
|---------|------|---------|
| `analyze_repo` | 综合分析 | 一次性获取项目完整分析报告 |
| `get_repo_readme` | 基础工具 | 获取 README.md 原始内容 |
| `get_repo_file` | 基础工具 | 获取指定文件内容 |
| `get_repo_structure` | 基础工具 | 获取目录树结构 |
| `get_repo_commits` | 基础工具 | 获取最近提交历史 |

### 2.2 工具依赖关系

```
analyze_repo (综合工具)
  ├─→ get_repo_readme (获取项目描述)
  ├─→ get_repo_file (获取 package.json/requirements.txt)
  ├─→ get_repo_structure (获取项目结构)
  └─→ get_repo_commits (获取最近动态)
```

## 3. API 设计

### 3.1 analyze_repo - 项目综合分析

**功能**: 一次调用返回项目完整分析报告

**输入参数**:
```typescript
{
  owner: string;      // 仓库所有者，必填
  repo: string;       // 仓库名称，必填
}
```

**返回数据结构**:
```typescript
{
  basic: {
    fullName: string;
    description: string;
    url: string;
    stars: number;
    forks: number;
    language: string;
    topics: string[];
    license: string;
    createdAt: string;
    updatedAt: string;
  },
  readme: {
    content: string;     // Markdown 原始内容
    size: number;        // 文件大小(字节)
  },
  structure: {
    rootFiles: string[]; // 根目录文件列表
    directories: string[]; // 主要目录
  },
  dependencies: {
    detected: boolean;
    packageManager: string; // npm, pip, cargo, go mod 等
    file: string;          // package.json, requirements.txt 等
    content?: string;      // 依赖文件内容
  },
  recentActivity: {
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      date: string;
    }>;
    lastCommitDate: string;
  }
}
```

**调用示例**:
```json
{
  "name": "analyze_repo",
  "arguments": {
    "owner": "facebook",
    "repo": "react"
  }
}
```

### 3.2 get_repo_readme - 获取 README

**输入参数**:
```typescript
{
  owner: string;
  repo: string;
}
```

**返回数据**: Markdown 原始文本

**GitHub API**: `GET /repos/{owner}/{repo}/readme`
- Header: `Accept: application/vnd.github.raw`

### 3.3 get_repo_file - 获取文件内容

**输入参数**:
```typescript
{
  owner: string;
  repo: string;
  path: string;  // 如 "package.json", "src/index.ts"
}
```

**返回数据**: 文件原始内容（文本或 Base64）

**GitHub API**: `GET /repos/{owner}/{repo}/contents/{path}`

### 3.4 get_repo_structure - 获取目录结构

**输入参数**:
```typescript
{
  owner: string;
  repo: string;
  path?: string;  // 可选，默认为根目录
}
```

**返回数据**:
```typescript
Array<{
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}>
```

**GitHub API**: `GET /repos/{owner}/{repo}/contents/{path}`

### 3.5 get_repo_commits - 获取提交历史

**输入参数**:
```typescript
{
  owner: string;
  repo: string;
  limit?: number;  // 默认 10
}
```

**返回数据**:
```typescript
Array<{
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}>
```

**GitHub API**: `GET /repos/{owner}/{repo}/commits?per_page={limit}`

## 4. 实现细节

### 4.1 核心函数设计

```typescript
// 1. 获取 README
async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error('README not found');
  return await response.text();
}

// 2. 获取文件内容
async function fetchRepoFile(owner: string, repo: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error('File not found');
  return await response.text();
}

// 3. 获取目录结构
async function fetchRepoStructure(owner: string, repo: string, path: string = ''): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Path not found');
  return await response.json();
}

// 4. 获取提交历史
async function fetchRepoCommits(owner: string, repo: string, limit: number = 10): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Commits not found');
  return await response.json();
}

// 5. 综合分析（组合调用）
async function analyzeRepo(owner: string, repo: string) {
  // 并行获取基础信息和 README
  const [details, readme] = await Promise.all([
    fetchRepoDetails(owner, repo),  // 复用现有函数
    fetchRepoReadme(owner, repo).catch(() => null)
  ]);

  // 获取根目录结构
  const structure = await fetchRepoStructure(owner, repo);
  const rootFiles = structure.filter(item => item.type === 'file').map(item => item.name);
  const directories = structure.filter(item => item.type === 'dir').map(item => item.name);

  // 检测依赖文件
  const depFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml'];
  let dependencies = { detected: false };
  for (const file of depFiles) {
    if (rootFiles.includes(file)) {
      const content = await fetchRepoFile(owner, repo, file).catch(() => null);
      if (content) {
        dependencies = {
          detected: true,
          packageManager: getPackageManager(file),
          file,
          content
        };
        break;
      }
    }
  }

  // 获取最近提交
  const commits = await fetchRepoCommits(owner, repo, 10);

  return {
    basic: details,
    readme: readme ? { content: readme, size: readme.length } : null,
    structure: { rootFiles, directories },
    dependencies,
    recentActivity: {
      commits: commits.map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: c.commit.author.date
      })),
      lastCommitDate: commits[0]?.commit.author.date
    }
  };
}

// 辅助函数
function getPackageManager(file: string): string {
  const map: Record<string, string> = {
    'package.json': 'npm/yarn/pnpm',
    'requirements.txt': 'pip',
    'Cargo.toml': 'cargo',
    'go.mod': 'go modules',
    'pom.xml': 'maven'
  };
  return map[file] || 'unknown';
}
```

### 4.2 错误处理

```typescript
// GitHub API 返回码处理
- 200: 成功
- 404: 仓库/文件不存在
- 403: API 速率限制（未认证: 60次/小时）
- 301: 仓库已重定向

// 错误处理策略
try {
  const result = await analyzeRepo(owner, repo);
  return { success: true, data: result };
} catch (error) {
  return { 
    success: false, 
    error: error.message,
    hint: '请检查仓库名称是否正确，或稍后重试'
  };
}
```

### 4.3 性能优化

1. **并行请求**: 使用 `Promise.all` 并行获取独立数据
2. **容错处理**: README/依赖文件缺失不影响整体分析
3. **数据精简**: 提交历史只返回首行消息，SHA 截取前 7 位

## 5. 代码结构（优化版）

### 5.1 文件组织

```
src/
├── index.ts          # MCP 服务器入口（扩展 ~100行）
└── github-api.ts     # GitHub API 调用封装（新增 ~80行）
```

**优化说明**：
- ❌ 不创建 `types.ts`：类型定义直接在使用处定义
- ❌ 不创建 `utils.ts`：getPackageManager 函数内联到 analyzeRepo
- ✅ 最小化文件数量，符合"最小化代码"原则

### 5.2 修改点

**修改文件: `src/index.ts` (~100行新增)**
1. 导入 github-api.ts 中的函数
2. 在 `ListToolsRequestSchema` 中添加 5 个工具定义
3. 在 `CallToolRequestSchema` 中添加 5 个工具处理逻辑

**新增文件: `src/github-api.ts` (~80行)**
- 实现 5 个 API 调用函数
- 实现 analyzeRepo 综合函数（内联 getPackageManager）
- 统一错误处理

## 6. 工具注册示例

```typescript
// 在 src/index.ts 的 ListToolsRequestSchema 中添加

{
  name: 'analyze_repo',
  description: '分析GitHub项目，获取README、依赖、结构和最近提交的完整报告',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: '仓库所有者' },
      repo: { type: 'string', description: '仓库名称' }
    },
    required: ['owner', 'repo']
  }
},
{
  name: 'get_repo_readme',
  description: '获取GitHub仓库的README.md原始内容',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: '仓库所有者' },
      repo: { type: 'string', description: '仓库名称' }
    },
    required: ['owner', 'repo']
  }
},
{
  name: 'get_repo_file',
  description: '获取GitHub仓库中指定文件的内容',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: '仓库所有者' },
      repo: { type: 'string', description: '仓库名称' },
      path: { type: 'string', description: '文件路径' }
    },
    required: ['owner', 'repo', 'path']
  }
},
{
  name: 'get_repo_structure',
  description: '获取GitHub仓库的目录结构',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: '仓库所有者' },
      repo: { type: 'string', description: '仓库名称' },
      path: { type: 'string', description: '目录路径（可选）', default: '' }
    },
    required: ['owner', 'repo']
  }
},
{
  name: 'get_repo_commits',
  description: '获取GitHub仓库的最近提交历史',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: '仓库所有者' },
      repo: { type: 'string', description: '仓库名称' },
      limit: { type: 'number', description: '返回数量', default: 10 }
    },
    required: ['owner', 'repo']
  }
}
```

## 7. 测试用例

### 7.1 成功场景

```bash
# 测试分析知名项目
analyze_repo("facebook", "react")
analyze_repo("microsoft", "vscode")
analyze_repo("vercel", "next.js")

# 测试获取 README
get_repo_readme("torvalds", "linux")

# 测试获取配置文件
get_repo_file("facebook", "react", "package.json")

# 测试获取目录结构
get_repo_structure("nodejs", "node", "lib")

# 测试获取提交
get_repo_commits("denoland", "deno", 5)
```

### 7.2 失败场景

```bash
# 仓库不存在
analyze_repo("invalid-user", "invalid-repo")
→ 返回: { success: false, error: "Repository not found" }

# README 不存在（但其他信息正常返回）
analyze_repo("user", "repo-without-readme")
→ 返回: { readme: null, basic: {...}, ... }

# 文件不存在
get_repo_file("facebook", "react", "nonexistent.txt")
→ 返回: { success: false, error: "File not found" }
```

## 8. API 速率限制

GitHub API 未认证请求限制：**60 次/小时/IP**

**应对策略：**
1. 在响应中返回速率限制信息
2. 建议用户在高频使用场景下配置 token（未来扩展）

**检查速率限制：**
```typescript
// 从响应头获取速率限制信息
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');
```

## 9. 实施计划

### 9.1 开发步骤（优化后）

1. **实现 GitHub API 封装** (`src/github-api.ts`)
   - 实现 5 个核心函数（fetchRepoReadme, fetchRepoFile, fetchRepoStructure, fetchRepoCommits, analyzeRepo）
   - 内联 getPackageManager 逻辑到 analyzeRepo 函数中
   - 统一错误处理

2. **扩展主文件** (`src/index.ts`)
   - 导入 github-api.ts 函数
   - 注册 5 个新工具到 ListToolsRequestSchema
   - 添加 5 个工具处理逻辑到 CallToolRequestSchema

3. **构建和测试**
   - `npm run build`
   - 本地测试 analyze_repo 工具
   - 测试其他 4 个基础工具

4. **更新文档** (`README_CN.md`)
   - 添加新工具使用说明
   - 更新示例

### 9.2 预估工作量（优化后）

- 代码实现: ~180 行新增代码（github-api.ts: 80行 + index.ts: 100行）
- 构建测试: ~20分钟
- 文档更新: ~30分钟
- **总计: 1.5-2 小时**

## 10. 使用示例

### 10.1 AI 使用场景

```
用户: "帮我分析一下 https://github.com/yizhiyanhua-ai/fireworks-tech-graph"

AI 内部调用:
1. 解析 URL 得到 owner="yizhiyanhua-ai", repo="fireworks-tech-graph"
2. 调用 analyze_repo("yizhiyanhua-ai", "fireworks-tech-graph")
3. 获得完整报告

AI 回复用户:
"这是一个技术图谱项目，使用 TypeScript 开发...
主要依赖: Next.js, React...
最近更新: 2024-06-05..."
```

### 10.2 单独工具组合使用

```
用户: "这个项目用的什么依赖？"

AI:
1. get_repo_file(owner, repo, "package.json")
2. 解析 JSON 返回依赖列表
```

## 11. 后续扩展

### 11.1 可选功能（暂不实现）

- [ ] 支持私有仓库（需要 token 认证）
- [ ] 获取 Issues/PRs 统计
- [ ] 获取贡献者列表
- [ ] 代码语言统计图表
- [ ] License 详细分析

### 11.2 性能优化（暂不实现）

- [ ] 添加本地缓存减少 API 调用
- [ ] 批量获取多个仓库信息

---

**设计完成日期**: 2026-06-08  
**设计者**: Claude Code  
**版本**: v2.0.0-design
