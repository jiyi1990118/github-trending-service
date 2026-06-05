#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

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
  let url = 'https://github.com/trending';
  if (language) {
    url += `/${language}`;
  }

  const response = await fetch(`${url}?since=${since}`);
  const html = await response.text();
  const $ = cheerio.load(html);

  const repos: TrendingRepo[] = [];
  $('article.Box-row').each((i, element) => {
    if (i >= limit) return false;

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

  return repos;
}

async function fetchTrendingDevelopers(
  since: string = 'weekly',
  language?: string,
  limit: number = 10
): Promise<TrendingDeveloper[]> {
  let url = 'https://github.com/trending/developers';
  if (language) {
    url += `/${language}`;
  }

  const response = await fetch(`${url}?since=${since}`);
  const html = await response.text();
  const $ = cheerio.load(html);

  const developers: TrendingDeveloper[] = [];
  $('article.Box-row').each((i, element) => {
    if (i >= limit) return false;

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

  return developers;
}

async function fetchRepoDetails(owner: string, repo: string): Promise<RepoDetails> {
  const url = `https://github.com/${owner}/${repo}`;
  const response = await fetch(url);
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
    version: '1.0.0',
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
              type: 'number',
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
              type: 'number',
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
      }
    ]
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub Trending MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

