import fetch from 'node-fetch';

export function clampLimit(limit: number | undefined, defaultValue: number = 10, max: number = 50): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return defaultValue;
  return Math.min(Math.max(Math.floor(limit), 1), max);
}

export function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': accept,
    'User-Agent': 'mcp-github-trending'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function ensureOk(response: { ok: boolean; status: number; statusText?: string }, context: string): Promise<void> {
  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(`${context}: ${response.status}${statusText}`);
  }
}

export function validateGitHubIdentifier(value: string, fieldName: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return value;
}

export function encodeGitHubPath(path: string): string {
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid path: ${path}`);
  }
  return parts.map(encodeURIComponent).join('/');
}

interface RepoContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  const safeOwner = validateGitHubIdentifier(owner, 'owner');
  const safeRepo = validateGitHubIdentifier(repo, 'repo');
  const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/readme`;
  const response = await fetch(url, {
    headers: githubHeaders('application/vnd.github.raw')
  });
  await ensureOk(response, `README not found for ${owner}/${repo}`);
  return await response.text();
}

export async function fetchRepoFile(owner: string, repo: string, path: string): Promise<string> {
  const safeOwner = validateGitHubIdentifier(owner, 'owner');
  const safeRepo = validateGitHubIdentifier(repo, 'repo');
  const safePath = encodeGitHubPath(path);
  const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/contents/${safePath}`;
  const response = await fetch(url, {
    headers: githubHeaders('application/vnd.github.raw')
  });
  await ensureOk(response, `File not found for ${owner}/${repo}:${path}`);
  return await response.text();
}

export async function fetchRepoStructure(owner: string, repo: string, path: string = ''): Promise<RepoContent[]> {
  const safeOwner = validateGitHubIdentifier(owner, 'owner');
  const safeRepo = validateGitHubIdentifier(repo, 'repo');
  const safePath = path ? encodeGitHubPath(path) : '';
  const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/contents/${safePath}`;
  const response = await fetch(url, {
    headers: githubHeaders('application/json')
  });
  await ensureOk(response, `Path not found for ${owner}/${repo}:${path || '/'}`);
  return await response.json() as RepoContent[];
}

export async function fetchRepoCommits(owner: string, repo: string, limit: number = 10): Promise<any[]> {
  const safeOwner = validateGitHubIdentifier(owner, 'owner');
  const safeRepo = validateGitHubIdentifier(repo, 'repo');
  const safeLimit = clampLimit(limit);
  const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?per_page=${safeLimit}`;
  const response = await fetch(url, {
    headers: githubHeaders('application/json')
  });
  await ensureOk(response, `Failed to fetch commits for ${owner}/${repo}`);
  return (await response.json()) as any[];
}

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
        sha: c.sha?.substring(0, 7) || '',
        message: c.commit?.message?.split('\n')[0] || '',
        author: c.commit?.author?.name || '',
        date: c.commit?.author?.date || ''
      })),
      lastCommitDate: commits[0]?.commit?.author?.date || null
    }
  };
}

export const __test = { clampLimit, githubHeaders, ensureOk, validateGitHubIdentifier, encodeGitHubPath };
