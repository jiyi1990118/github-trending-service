# GitHub 项目分析功能实施计划

**日期**: 2026-06-08  
**功能**: 为 GitHub Trending MCP Server 添加项目分析能力  
**预估时间**: 1.5-2 小时

## 目标

为 MCP 服务器添加 5 个新工具，使 AI 能够分析任意 GitHub 公开仓库：
- `analyze_repo`: 综合分析工具（一次性获取完整报告）
- `get_repo_readme`: 获取 README.md 原始内容
- `get_repo_file`: 获取指定文件内容
- `get_repo_structure`: 获取目录结构
- `get_repo_commits`: 获取提交历史

## 技术要点

- 使用 GitHub REST API v3（无需认证）
- 仅支持公开仓库
- 并行请求优化性能
- 容错处理（README/依赖缺失不影响整体）
- 新增 1 个文件（github-api.ts）+ 修改 index.ts

## 任务清单

### 阶段 1: 创建 GitHub API 封装

- [ ] Task 1.1: 创建 github-api.ts 并实现 fetchRepoReadme
- [ ] Task 1.2: 实现 fetchRepoFile 函数
- [ ] Task 1.3: 实现 fetchRepoStructure 函数
- [ ] Task 1.4: 实现 fetchRepoCommits 函数
- [ ] Task 1.5: 实现 analyzeRepo 综合函数

### 阶段 2: 扩展 MCP 服务器

- [ ] Task 2.1: 在 index.ts 中导入 API 函数
- [ ] Task 2.2: 注册 5 个新工具到 ListToolsRequestSchema
- [ ] Task 2.3: 实现工具处理逻辑（analyze_repo）
- [ ] Task 2.4: 实现基础工具处理逻辑（其余 4 个）

### 阶段 3: 测试与文档

- [ ] Task 3.1: 构建并测试 analyze_repo
- [ ] Task 3.2: 测试其他 4 个工具
- [ ] Task 3.3: 更新 README_CN.md 文档

---

## 详细任务

### Task 1.1: 创建 github-api.ts 并实现 fetchRepoReadme

**目标**: 创建 GitHub API 封装文件，实现获取 README 功能

**步骤**:
1. 创建 `src/github-api.ts` 文件
2. 导入 node-fetch
3. 实现 fetchRepoReadme 函数

**代码**:
```typescript
import fetch from 'node-fetch';

export async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error(`README not found: ${response.status}`);
  return await response.text();
}
```

**验证**: 函数可以成功获取公开仓库的 README 原始内容

**预计时间**: 3 分钟

---

### Task 1.2: 实现 fetchRepoFile 函数

**目标**: 实现获取仓库中任意文件内容的功能

**步骤**:
1. 在 github-api.ts 中添加 fetchRepoFile 函数
2. 使用 GitHub Contents API
3. 返回文件原始内容

**代码**:
```typescript
export async function fetchRepoFile(owner: string, repo: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error(`File not found: ${path}`);
  return await response.text();
}
```

**验证**: 可以获取 package.json、README.md 等文件内容

**预计时间**: 2 分钟

---

### Task 1.3: 实现 fetchRepoStructure 函数

**目标**: 获取仓库的目录结构

**步骤**:
1. 添加 fetchRepoStructure 函数
2. 返回目录和文件列表

**代码**:
```typescript
interface RepoContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export async function fetchRepoStructure(owner: string, repo: string, path: string = ''): Promise<RepoContent[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Path not found: ${path}`);
  return await response.json() as RepoContent[];
}
```

**验证**: 可以获取根目录和子目录的文件列表

**预计时间**: 3 分钟

---

### Task 1.4: 实现 fetchRepoCommits 函数

**目标**: 获取仓库的最近提交历史

**步骤**:
1. 添加 fetchRepoCommits 函数
2. 支持自定义返回数量

**代码**:
```typescript
export async function fetchRepoCommits(owner: string, repo: string, limit: number = 10): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch commits');
  return await response.json();
}
```

**验证**: 可以获取最近 N 条提交记录

**预计时间**: 2 分钟

---

### Task 1.5: 实现 analyzeRepo 综合函数

**目标**: 组合所有 API 调用，一次性返回完整项目分析

**步骤**:
1. 导入现有的 fetchRepoDetails 函数
2. 实现 analyzeRepo，并行调用多个 API
3. 内联 getPackageManager 逻辑
4. 组装返回数据

**代码**:
```typescript
export async function analyzeRepo(owner: string, repo: string, fetchRepoDetails: Function) {
  const [details, readme] = await Promise.all([
    fetchRepoDetails(owner, repo),
    fetchRepoReadme(owner, repo).catch(() => null)
  ]);

  const structure = await fetchRepoStructure(owner, repo);
  const rootFiles = structure.filter(item => item.type === 'file').map(item => item.name);
  const directories = structure.filter(item => item.type === 'dir').map(item => item.name);

  const depFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml'];
  const packageManagerMap: Record<string, string> = {
    'package.json': 'npm/yarn/pnpm',
    'requirements.txt': 'pip',
    'Cargo.toml': 'cargo',
    'go.mod': 'go modules',
    'pom.xml': 'maven'
  };
  
  let dependencies: any = { detected: false };
  for (const file of depFiles) {
    if (rootFiles.includes(file)) {
      const content = await fetchRepoFile(owner, repo, file).catch(() => null);
      if (content) {
        dependencies = {
          detected: true,
          packageManager: packageManagerMap[file] || 'unknown',
          file,
          content
        };
        break;
      }
    }
  }

  const commits = await fetchRepoCommits(owner, repo, 10);

  return {
    basic: details,
    readme: readme ? { content: readme, size: readme.length } : null,
    structure: { rootFiles, directories },
    dependencies,
    recentActivity: {
      commits: commits.map((c: any) => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: c.commit.author.date
      })),
      lastCommitDate: commits[0]?.commit.author.date
    }
  };
}
```

**验证**: 可以一次性获取项目的完整分析报告

**预计时间**: 8 分钟

---

### Task 2.1: 在 index.ts 中导入 API 函数

**目标**: 导入 github-api.ts 中的所有函数

**步骤**:
1. 在 index.ts 顶部添加导入语句

**代码**:
```typescript
import {
  fetchRepoReadme,
  fetchRepoFile,
  fetchRepoStructure,
  fetchRepoCommits,
  analyzeRepo
} from './github-api.js';
```

**验证**: 导入无错误，TypeScript 编译通过

**预计时间**: 1 分钟

---

### Task 2.2: 注册 5 个新工具到 ListToolsRequestSchema

**目标**: 在工具列表中注册新的 5 个 MCP 工具

**步骤**:
1. 在现有的 tools 数组中添加 5 个新工具定义

**代码**（添加到 server.setRequestHandler(ListToolsRequestSchema, ...) 的 tools 数组中）:
```typescript
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

**验证**: 工具可以在 MCP 客户端中看到

**预计时间**: 5 分钟

---

### Task 2.3: 实现工具处理逻辑（analyze_repo）

**目标**: 在 CallToolRequestSchema 处理器中添加 analyze_repo 的逻辑

**步骤**:
1. 在 server.setRequestHandler(CallToolRequestSchema, ...) 中添加处理分支

**代码**:
```typescript
if (request.params.name === 'analyze_repo') {
  const { owner, repo } = request.params.arguments as {
    owner: string;
    repo: string;
  };

  try {
    const result = await analyzeRepo(owner, repo, fetchRepoDetails);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            hint: '请检查仓库名称是否正确，或稍后重试'
          }, null, 2)
        }
      ]
    };
  }
}
```

**验证**: analyze_repo 工具可以正常调用并返回完整报告

**预计时间**: 5 分钟

---

### Task 2.4: 实现基础工具处理逻辑（其余 4 个）

**目标**: 添加 get_repo_readme, get_repo_file, get_repo_structure, get_repo_commits 的处理逻辑

**步骤**:
1. 在 CallToolRequestSchema 处理器中添加 4 个工具的处理分支

**代码**:
```typescript
if (request.params.name === 'get_repo_readme') {
  const { owner, repo } = request.params.arguments as { owner: string; repo: string };
  const readme = await fetchRepoReadme(owner, repo);
  return { content: [{ type: 'text', text: readme }] };
}

if (request.params.name === 'get_repo_file') {
  const { owner, repo, path } = request.params.arguments as { owner: string; repo: string; path: string };
  const content = await fetchRepoFile(owner, repo, path);
  return { content: [{ type: 'text', text: content }] };
}

if (request.params.name === 'get_repo_structure') {
  const { owner, repo, path = '' } = request.params.arguments as { owner: string; repo: string; path?: string };
  const structure = await fetchRepoStructure(owner, repo, path);
  return { content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }] };
}

if (request.params.name === 'get_repo_commits') {
  const { owner, repo, limit = 10 } = request.params.arguments as { owner: string; repo: string; limit?: number };
  const commits = await fetchRepoCommits(owner, repo, limit);
  return { content: [{ type: 'text', text: JSON.stringify(commits, null, 2) }] };
}
```

**验证**: 所有 4 个基础工具可以正常调用

**预计时间**: 5 分钟

---

### Task 3.1: 构建并测试 analyze_repo

**目标**: 编译代码并测试综合分析工具

**步骤**:
1. 运行 `npm run build` 编译 TypeScript
2. 在 Claude Code 中测试 analyze_repo 工具
3. 验证返回数据的完整性

**测试命令**:
```bash
npm run build
```

**测试用例**:
- 测试知名项目: `analyze_repo("facebook", "react")`
- 验证返回包含: basic, readme, structure, dependencies, recentActivity

**验证**: 构建成功，analyze_repo 返回完整的项目分析报告

**预计时间**: 10 分钟

---

### Task 3.2: 测试其他 4 个工具

**目标**: 验证所有基础工具正常工作

**步骤**:
1. 测试 get_repo_readme
2. 测试 get_repo_file
3. 测试 get_repo_structure
4. 测试 get_repo_commits

**测试用例**:
```
get_repo_readme("torvalds", "linux")
get_repo_file("facebook", "react", "package.json")
get_repo_structure("nodejs", "node", "")
get_repo_commits("denoland", "deno", 5)
```

**验证**: 所有工具返回预期的数据格式

**预计时间**: 10 分钟

---

### Task 3.3: 更新 README_CN.md 文档

**目标**: 在中文文档中添加新工具的使用说明

**步骤**:
1. 在 README_CN.md 的"MCP 工具能力说明"章节添加 5 个新工具
2. 在"使用示例"章节添加项目分析的示例
3. 更新版本号说明

**文档内容**:
在现有的 4 个工具后添加：

```markdown
### 5. analyze_repo - 项目综合分析

**功能描述**: 一次性获取 GitHub 项目的完整分析报告，包括 README、依赖、目录结构和最近提交。

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `owner` | string | **是** | 仓库所有者 |
| `repo` | string | **是** | 仓库名称 |

**使用场景**: 快速了解一个陌生项目的用途、技术栈和活跃度

### 6-9. 基础工具

- `get_repo_readme`: 获取 README.md 原始内容
- `get_repo_file`: 获取指定文件内容（如 package.json）
- `get_repo_structure`: 获取目录结构
- `get_repo_commits`: 获取最近提交历史
```

添加使用示例：
```markdown
### 示例 5：分析 GitHub 项目

```
帮我分析一下 https://github.com/microsoft/vscode 这个项目
```

Claude 会调用 `analyze_repo` 工具，返回项目的完整分析报告。
```

**验证**: 文档更新完整，示例清晰

**预计时间**: 15 分钟

---

## 总结

**总任务数**: 11 个  
**预计总时间**: 约 75 分钟（1.25 小时）  
**关键里程碑**:
- 阶段 1 完成: GitHub API 封装实现（~18 分钟）
- 阶段 2 完成: MCP 服务器集成（~16 分钟）
- 阶段 3 完成: 测试与文档（~35 分钟）

**成功标准**:
1. ✅ 所有 5 个工具在 Claude Code 中可用
2. ✅ analyze_repo 返回完整的项目分析报告
3. ✅ 基础工具独立可用
4. ✅ 文档更新完整

**风险与缓解**:
- GitHub API 速率限制（60次/小时）→ 在测试时控制请求频率
- 某些仓库无 README → 已在代码中做容错处理
- TypeScript 编译错误 → 确保类型定义正确
