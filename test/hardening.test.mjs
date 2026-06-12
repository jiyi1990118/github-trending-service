import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { __test } from '../dist/github-api.js';

function callMcp(request) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: new URL('..', import.meta.url),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP call timed out. stderr: ${stderr}`));
    }, 5000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const lines = stdout.split('\n').filter(Boolean);
      const responseLine = lines.find((line) => line.includes(`"id":${request.id}`));
      if (responseLine) {
        clearTimeout(timeout);
        child.kill();
        resolve(JSON.parse(responseLine));
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.stdin.write(JSON.stringify(request) + '\n');
  });
}

test('clampLimit keeps MCP requests within a safe range', () => {
  assert.equal(__test.clampLimit(undefined), 10);
  assert.equal(__test.clampLimit(0), 1);
  assert.equal(__test.clampLimit(-5), 1);
  assert.equal(__test.clampLimit(3.8), 3);
  assert.equal(__test.clampLimit(999), 50);
});

test('githubHeaders includes user agent and optional bearer token', () => {
  const originalToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;

  assert.deepEqual(__test.githubHeaders('application/json'), {
    Accept: 'application/json',
    'User-Agent': 'mcp-github-trending'
  });

  process.env.GITHUB_TOKEN = 'test-token';
  assert.deepEqual(__test.githubHeaders('application/vnd.github.raw'), {
    Accept: 'application/vnd.github.raw',
    'User-Agent': 'mcp-github-trending',
    Authorization: 'Bearer test-token'
  });

  if (originalToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = originalToken;
  }
});

test('validateGitHubIdentifier rejects invalid owner and repo names', () => {
  assert.equal(__test.validateGitHubIdentifier('anthropics', 'owner'), 'anthropics');
  assert.throws(() => __test.validateGitHubIdentifier('', 'owner'), /Invalid owner/);
  assert.throws(() => __test.validateGitHubIdentifier('../repo', 'repo'), /Invalid repo/);
  assert.throws(() => __test.validateGitHubIdentifier('bad name', 'owner'), /Invalid owner/);
});

test('encodeGitHubPath safely encodes path segments without flattening directories', () => {
  assert.equal(__test.encodeGitHubPath('src/index.ts'), 'src/index.ts');
  assert.equal(__test.encodeGitHubPath('docs/a file.md'), 'docs/a%20file.md');
  assert.throws(() => __test.encodeGitHubPath('../package.json'), /Invalid path/);
});

test('package publish check verifies the packed CLI entrypoint', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['pack:check'], 'npm pack --dry-run');
  assert.match(pkg.scripts.prepublishOnly, /npm run pack:check/);
});

test('server metadata version matches package version', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, new RegExp(`version: '${pkg.version}'`));
});

test('tool schemas constrain limit to integer range', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /limit:\s*\{\s*type: 'integer',[\s\S]*minimum: 1,[\s\S]*maximum: 50/);
});

test('html GitHub requests send an explicit user agent', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /headers:\s*githubHeaders\('text\/html'\)/);
});

test('unknown tools return MCP tool errors instead of JSON-RPC internal errors', async () => {
  const response = await callMcp({
    jsonrpc: '2.0',
    id: 99,
    method: 'tools/call',
    params: { name: 'missing_tool', arguments: {} }
  });

  assert.equal(response.error, undefined);
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /Unknown tool: missing_tool/);
});
