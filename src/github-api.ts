import fetch from 'node-fetch';

interface RepoContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error(`README not found: ${response.status}`);
  return await response.text();
}

export async function fetchRepoFile(owner: string, repo: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.raw' }
  });
  if (!response.ok) throw new Error(`File not found: ${path}`);
  return await response.text();
}

export async function fetchRepoStructure(owner: string, repo: string, path: string = ''): Promise<RepoContent[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error(`Path not found: ${path}`);
  return await response.json() as RepoContent[];
}

export async function fetchRepoCommits(owner: string, repo: string, limit: number = 10): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch commits');
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
