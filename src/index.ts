#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import {
  clampLimit,
  githubHeaders,
  validateGitHubIdentifier,
  fetchRepoReadme,
  fetchRepoFile,
  fetchRepoStructure,
  fetchRepoCommits,
  analyzeRepo
} from './github-api.js';

interface TrendingRepo {
  name: string;
  url: string;
  description: string;
  stars?: string;
}

interface TrendingDeveloper {
  username: string;
  name: string;
  url: string;
  avatar?: string;
  popularRepo?: {
    name: string;
    url: string;
    description: string;
  };
}

interface RepoDetails {
  fullName: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string;
  license?: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
}

async function fetchTrending(
  since: string = 'weekly',
  language?: string,
  limit: number = 10
): Promise<TrendingRepo[]> {
  const safeLimit = clampLimit(limit);
  let url = 'https://github.com/trending';
  if (language) {
    url += `/${encodeURIComponent(language)}`;
  }

  const response = await fetch(`${url}?since=${since}`, {
    headers: githubHeaders('text/html')
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub trending repositories: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const repos: TrendingRepo[] = [];
  $('article.Box-row').each((i, element) => {
    if (i >= safeLimit) return false;

    const $article = $(element);
    const $repoLink = $article.find('h2 a');
    const $desc = $article.find('p');
    const $stars = $article.find('span.d-inline-block.float-sm-right');

    const href = $repoLink.attr('href');
    if (href) {
      repos.push({
        name: $repoLink.text().trim().replace(/\s+/g, ''),
        url: `https://github.com${href}`,
        description: $desc.text().trim(),
        stars: $stars.text().trim()
      });
    }
  });

  if (repos.length === 0) {
    throw new Error('No trending repositories parsed; GitHub page structure may have changed or the request was blocked.');
  }

  return repos;
}

async function fetchTrendingDevelopers(
  since: string = 'weekly',
  language?: string,
  limit: number = 10
): Promise<TrendingDeveloper[]> {
  const safeLimit = clampLimit(limit);
  let url = 'https://github.com/trending/developers';
  if (language) {
    url += `/${encodeURIComponent(language)}`;
  }

  const response = await fetch(`${url}?since=${since}`, {
    headers: githubHeaders('text/html')
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub trending developers: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const developers: TrendingDeveloper[] = [];
  $('article.Box-row').each((i, element) => {
    if (i >= safeLimit) return false;

    const $article = $(element);
    const $userLink = $article.find('h1 a');
    const $avatar = $article.find('img');
    const $repoLink = $article.find('article a');

    const href = $userLink.attr('href');
    if (href) {
      developers.push({
        username: href.replace('/', ''),
        name: $userLink.text().trim(),
        url: `https://github.com${href}`,
        avatar: $avatar.attr('src'),
        popularRepo: $repoLink.length ? {
          name: $repoLink.text().trim(),
          url: `https://github.com${$repoLink.attr('href')}`,
          description: $article.find('article div').first().text().trim()
        } : undefined
      });
    }
  });

  if (developers.length === 0) {
    throw new Error('No trending developers parsed; GitHub page structure may have changed or the request was blocked.');
  }

  return developers;
}

async function fetchRepoDetails(owner: string, repo: string): Promise<RepoDetails> {
  const safeOwner = validateGitHubIdentifier(owner, 'owner');
  const safeRepo = validateGitHubIdentifier(repo, 'repo');
  const url = `https://github.com/${safeOwner}/${safeRepo}`;
  const response = await fetch(url, {
    headers: githubHeaders('text/html')
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repository details for ${owner}/${repo}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const parseNumber = (text: string) => {
    const cleaned = text.replace(/,/g, '').replace('k', '000');
    return parseFloat(cleaned) || 0;
  };

  return {
    fullName: `${owner}/${repo}`,
    stars: parseNumber($('span#repo-stars-counter-star').text().trim()),
    forks: parseNumber($('[href$="/forks"] strong').text().trim()),
    watchers: parseNumber($('[href$="/watchers"] strong').text().trim()),
    openIssues: parseNumber($('[data-testid="issue-link"] .Counter').text().trim()),
    language: $('span.color-fg-default.text-bold.mr-1').first().text().trim() || 'Unknown',
    license: $('[data-testid="license-link"]').text().trim() || undefined,
    topics: $('a.topic-tag').map((_, el) => $(el).text().trim()).get(),
    createdAt: $('relative-time').first().attr('datetime') || '',
    updatedAt: $('relative-time').last().attr('datetime') || ''
  };
}

// 创建MCP服务器
const server = new Server(
  {
    name: 'github-trending',
    version: '1.1.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_trending_repos',
        description: '获取GitHub trending仓库列表',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
              description: '时间范围',
              default: 'weekly'
            },
            language: {
              type: 'string',
              description: '编程语言（可选）'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              description: '返回数量',
              default: 10
            }
          }
        }
      },
      {
        name: 'get_trending_developers',
        description: '获取GitHub trending开发者列表',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
              description: '时间范围',
              default: 'weekly'
            },
            language: {
              type: 'string',
              description: '编程语言（可选）'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              description: '返回数量',
              default: 10
            }
          }
        }
      },
      {
        name: 'search_trending',
        description: '在trending列表中搜索关键词',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: '搜索关键词'
            },
            since: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
              description: '时间范围',
              default: 'weekly'
            },
            language: {
              type: 'string',
              description: '编程语言（可选）'
            }
          },
          required: ['keyword']
        }
      },
      {
        name: 'get_repo_details',
        description: '获取仓库详细信息',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: '仓库所有者'
            },
            repo: {
              type: 'string',
              description: '仓库名称'
            }
          },
          required: ['owner', 'repo']
        }
      },
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
    ]
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === 'get_trending_repos') {
    const { since = 'weekly', language, limit = 10 } = request.params.arguments as {
      since?: string;
      language?: string;
      limit?: number;
    };

    const repos = await fetchTrending(since, language, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(repos, null, 2)
        }
      ]
    };
  }

  if (request.params.name === 'get_trending_developers') {
    const { since = 'weekly', language, limit = 10 } = request.params.arguments as {
      since?: string;
      language?: string;
      limit?: number;
    };

    const developers = await fetchTrendingDevelopers(since, language, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(developers, null, 2)
        }
      ]
    };
  }

  if (request.params.name === 'search_trending') {
    const { keyword, since = 'weekly', language } = request.params.arguments as {
      keyword: string;
      since?: string;
      language?: string;
    };

    const repos = await fetchTrending(since, language, 50);
    const filtered = repos.filter(repo =>
      repo.name.toLowerCase().includes(keyword.toLowerCase()) ||
      repo.description.toLowerCase().includes(keyword.toLowerCase())
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filtered, null, 2)
        }
      ]
    };
  }

  if (request.params.name === 'get_repo_details') {
    const { owner, repo } = request.params.arguments as {
      owner: string;
      repo: string;
    };

    const details = await fetchRepoDetails(owner, repo);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(details, null, 2)
        }
      ]
    };
  }

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

  throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: error instanceof Error ? error.message : String(error)
      }]
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub Trending MCP Server running on stdio');
}

main().catch((error) => {
  console.error('[github-trending] MCP server failed to start:', error);
  process.exit(1);
});

