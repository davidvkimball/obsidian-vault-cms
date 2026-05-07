import { requestUrl, RequestUrlParam } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface GitHubRepoResponse {
    clone_url: string;
    html_url: string;
    /** "owner/repo" — used to PATCH default_branch after the initial push. */
    full_name: string;
}

export class GitManager {
    /**
     * Checks if a directory is a Git repository.
     */
    static async isRepo(projectRoot: string): Promise<boolean> {
        if (!projectRoot) return false;

        try {
            const absolutePath = path.resolve(projectRoot);
            const dotGitPath = path.join(absolutePath, '.git');
            const exists = fs.existsSync(dotGitPath);

            console.debug('GitManager.isRepo check:', {
                projectRoot,
                absolutePath,
                dotGitPath,
                exists
            });

            if (!fs.existsSync(absolutePath)) return false;

            // STRICT CHECK: Only consider it a repo if .git exists EXACTLY in this folder.
            // This prevents "ghost" detection from parent repositories.
            return exists;
        } catch (error) {
            console.error('GitManager.isRepo error:', error);
            return false;
        }
    }

    /**
     * Initializes a new Git repository at the given path.
     */
    static async initRepo(projectRoot: string): Promise<void> {
        await execAsync('git init', { cwd: projectRoot });
    }

    /**
     * Sets the remote URL for the repository.
     */
    static async setRemote(projectRoot: string, url: string, remoteName: string = 'origin'): Promise<void> {
        try {
            await execAsync(`git remote add ${remoteName} ${url}`, { cwd: projectRoot });
        } catch (error) {
            // If remote already exists, update it
            if (error instanceof Error && error.message.includes('already exists')) {
                await execAsync(`git remote set-url ${remoteName} ${url}`, { cwd: projectRoot });
            } else {
                throw error;
            }
        }
    }

    /**
     * Gets the remote URL for the repository, scrubbing any tokens for security.
     */
    static async getRemoteUrl(projectRoot: string, remoteName: string = 'origin'): Promise<string | null> {
        try {
            const { stdout } = await execAsync(`git remote get-url ${remoteName}`, { cwd: projectRoot });
            let url = stdout.trim() || null;

            if (url && url.includes('@github.com')) {
                // Scrub token: https://ghp_xxx@github.com/... -> https://github.com/...
                url = url.replace(/https:\/\/.*@github\.com/, 'https://github.com');
            }

            return url;
        } catch {
            return null;
        }
    }

    /**
     * Gets the current local branch name.
     */
    static async getCurrentBranch(projectRoot: string): Promise<string> {
        try {
            const { stdout } = await execAsync('git branch --show-current', { cwd: projectRoot });
            return stdout.trim() || 'main';
        } catch {
            return 'main';
        }
    }

    /**
     * Pull the meaningful git error out of a Node `exec` rejection. By default
     * Node prepends `Command failed: <cmd>` and chains the full stderr in
     * `.message`, which buries the actual diagnostic. We prefer:
     *   1. `error.stderr` if present (Node attaches it on exec rejections)
     *   2. lines beginning with `fatal:`, `remote:`, `error:` from `.message`
     *   3. the trimmed message as a last resort
     *
     * This is what the user sees in the wizard's "Setup failed: ..." notice,
     * so it needs to be the actual git diagnostic, not the wrapper preamble.
     */
    private static extractGitError(error: unknown): string {
        const anyErr = error as any;
        const stderr = (anyErr?.stderr ? String(anyErr.stderr) : '').trim();
        if (stderr) {
            // Strip the trailing "fatal: The remote end hung up unexpectedly" noise
            // when there's a more specific upstream message above it.
            const meaningful = stderr
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
            return meaningful.join(' | ');
        }
        const msg = (error instanceof Error ? error.message : String(error)).trim();
        const lines = msg.split('\n').map((l) => l.trim()).filter(Boolean);
        const diagnostic = lines.filter((l) =>
            /^(fatal|remote|error|hint):/i.test(l) || l.toLowerCase().includes('permission denied')
        );
        if (diagnostic.length > 0) return diagnostic.join(' | ');
        // Last resort: drop the boilerplate first line and join the rest.
        return lines.slice(1).join(' | ') || msg;
    }

    /**
     * Whether the local repo has any commits yet (HEAD exists).
     */
    private static async hasHead(projectRoot: string): Promise<boolean> {
        try {
            await execAsync('git rev-parse --verify HEAD', { cwd: projectRoot });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the SHA of `branch` on the given remote, or null if it doesn't exist.
     * Uses `ls-remote` (one network round-trip) — the only reliable way to
     * confirm content actually reached the server. Upstream config alone can
     * lie when the push silently failed earlier.
     */
    private static async getRemoteBranchSha(
        projectRoot: string,
        remoteName: string,
        branch: string
    ): Promise<string | null> {
        try {
            const { stdout } = await execAsync(
                `git ls-remote --heads ${remoteName} ${branch}`,
                { cwd: projectRoot }
            );
            const line = stdout.trim().split('\n')[0];
            if (!line) return null;
            const sha = line.split(/\s+/)[0];
            return sha && sha.length >= 40 ? sha : null;
        } catch {
            return null;
        }
    }

    /**
     * Creates an initial commit (or uses an existing one), pushes to the
     * remote, and sets the upstream. Designed to never silently succeed when
     * something actually went wrong:
     *
     *   - "git add . + commit" with no files AND no existing HEAD = throws.
     *   - Push uses a temporary authenticated remote URL (the `git -c
     *     url.X.insteadOf=Y` trick is unreliable on Windows). The token is
     *     scrubbed from the remote URL on disk in a `finally`, even on push
     *     failure, so it never persists.
     *   - After push, verifies via `git ls-remote --heads` that the remote
     *     branch actually has a SHA. Upstream-config presence is NOT trusted
     *     as proof of a successful push.
     */
    static async initialCommitAndPush(
        projectRoot: string,
        branch: string,
        remoteName: string = 'origin',
        token?: string
    ): Promise<void> {
        console.debug('GitManager.initialCommitAndPush: starting', { projectRoot, branch, remoteName, hasToken: !!token });

        // 1. Ensure user identity is set (git commit fails without it)
        try {
            await execAsync('git config user.name', { cwd: projectRoot });
        } catch {
            console.debug('GitManager: Setting local git user.name');
            await execAsync('git config user.name "Vault CMS User"', { cwd: projectRoot });
            await execAsync('git config user.email "vault-cms@example.com"', { cwd: projectRoot });
        }

        // 2. Stage all files
        await execAsync('git add .', { cwd: projectRoot });

        // 3. Commit, distinguishing "nothing to commit" cases:
        //    - HEAD exists already → fine, push the existing commits
        //    - HEAD doesn't exist  → real failure (project empty / .gitignore eats everything)
        const hadHeadBefore = await this.hasHead(projectRoot);
        try {
            await execAsync('git commit -m "Initial commit from Vault CMS"', { cwd: projectRoot });
        } catch (commitError) {
            const msg = commitError instanceof Error ? commitError.message : String(commitError);
            const looksClean = msg.includes('nothing to commit') || msg.includes('working tree clean');
            if (!looksClean) throw commitError;
            if (!hadHeadBefore) {
                throw new Error(
                    `No files to commit in "${projectRoot}". The project appears empty, ` +
                    `or .gitignore is excluding everything. Add some content and try again.`
                );
            }
            console.debug('GitManager: No new changes; using existing HEAD');
        }

        // 4. Force the branch to whatever the user picked. `-M` is rename-or-create
        //    and works whether the local branch was main, master, or anything else.
        await execAsync(`git branch -M ${branch}`, { cwd: projectRoot });

        // 5. Push using a temporary authenticated remote URL (reset in `finally`
        //    so the token never persists on disk).
        console.debug('GitManager: Pushing to remote...');
        const cleanUrl = await this.getRemoteUrl(projectRoot, remoteName);
        if (!cleanUrl) {
            throw new Error(`No "${remoteName}" remote configured for "${projectRoot}".`);
        }

        // For PATs over HTTPS, the canonical auth URL is `https://<TOKEN>@github.com/...`
        // (token as the user component, empty password). The `x-access-token:` prefix
        // is for GitHub App installation tokens only; using it with a PAT silently
        // fails authentication on push even though the PAT is valid for the API.
        const usingTokenAuth = !!token && cleanUrl.startsWith('https://');
        if (usingTokenAuth) {
            const authedUrl = cleanUrl.replace('https://', `https://${token}@`);
            await execAsync(`git remote set-url ${remoteName} ${authedUrl}`, { cwd: projectRoot });
        }

        try {
            try {
                await execAsync(
                    `git push -u ${remoteName} ${branch}`,
                    { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
                );
            } catch (pushError) {
                const gitMsg = this.extractGitError(pushError);
                // Detect the specific "missing workflow scope" rejection so the
                // wizard's notice can include actionable recovery instructions
                // instead of just the raw git diagnostic.
                if (/workflow\s+scope/i.test(gitMsg) || /\.github\/workflows\//i.test(gitMsg)) {
                    throw new Error(
                        `git push failed: your GitHub PAT is missing the "workflow" scope, which is required ` +
                        `to push GitHub Actions files (.github/workflows/*.yml). ` +
                        `Regenerate the token at https://github.com/settings/tokens/new?scopes=repo,workflow ` +
                        `(check BOTH "repo" and "workflow"), paste the new token in the wizard, click Verify, ` +
                        `then click "Initialize & Push" again. Original error: ${gitMsg}`
                    );
                }
                throw new Error(`git push failed: ${gitMsg}`);
            }
        } finally {
            // Always restore the clean URL — even if push threw — so the token
            // is never saved on disk.
            if (usingTokenAuth) {
                try {
                    await execAsync(`git remote set-url ${remoteName} ${cleanUrl}`, { cwd: projectRoot });
                } catch (resetError) {
                    console.error('GitManager: Failed to reset remote URL after push attempt:', resetError);
                }
            }
        }

        // 6. Real verification: confirm the remote actually has the branch with a SHA.
        const remoteSha = await this.getRemoteBranchSha(projectRoot, remoteName, branch);
        if (!remoteSha) {
            throw new Error(
                `git push reported success, but the remote branch "${branch}" still has no commits. ` +
                `Try manually: cd "${projectRoot}" && git push -u ${remoteName} ${branch}`
            );
        }
        console.debug('GitManager: Push verified. Remote SHA:', remoteSha);
    }

    /**
     * PATCH the GitHub repo to set its default branch. Must be called AFTER
     * the branch has been pushed — GitHub rejects default_branch values that
     * don't already exist on the remote. Keeps GitHub's default branch in
     * sync with what the user typed in the wizard, which Netlify and clones
     * then auto-pick up.
     */
    static async setDefaultBranch(token: string, fullName: string, branch: string): Promise<void> {
        const params: RequestUrlParam = {
            url: `https://api.github.com/repos/${fullName}`,
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ default_branch: branch }),
        };
        const response = await requestUrl(params);
        if (response.status !== 200) {
            let msg = `Failed to set default branch: HTTP ${response.status}`;
            try {
                const data = typeof response.json === 'string' ? JSON.parse(response.json) : response.json;
                if (data?.message) msg += ` (${data.message})`;
            } catch {
                // ignore parse error
            }
            throw new Error(msg);
        }
    }

    /**
     * Creates a new repository on GitHub.
     */
    static async createGitHubRepo(token: string, name: string, description: string, isPrivate: boolean): Promise<GitHubRepoResponse> {
        const params: RequestUrlParam = {
            url: 'https://api.github.com/user/repos',
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                description,
                private: isPrivate
            })
        };

        try {
            const response = await requestUrl(params);

            if (response.status === 422) {
                throw new Error('Repository name already exists on your GitHub account.');
            }

            if (response.status !== 201) {
                // Try to parse more detailed error message if available
                let errorMessage = `GitHub API Error: ${response.status}`;
                try {
                    const errorData = typeof response.json === 'string' ? JSON.parse(response.json) : response.json;
                    if (errorData?.message) {
                        errorMessage = `GitHub API Error: ${errorData.message}`;
                        if (errorData.errors?.[0]?.message) {
                            errorMessage += ` (${errorData.errors[0].message})`;
                        }
                    }
                } catch (e) {
                    // Ignore parse error, use basic message
                }
                throw new Error(errorMessage);
            }

            return response.json as GitHubRepoResponse;
        } catch (error) {
            // Check if it's already an Error with the message we want
            if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('GitHub API Error'))) {
                throw error;
            }

            // Handle unexpected errors or request failures
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('422') || message.includes('already exists')) {
                throw new Error('Repository name already exists on your GitHub account.');
            }
            throw error;
        }
    }

    /**
     * Verifies a GitHub PAT and returns the username + granted scopes.
     *
     * Backwards-compat note: callers that just want the username can read
     * `result.login`. The `scopes` array enables upfront validation that the
     * token has `workflow` (required to push files under .github/workflows/),
     * which we can't detect from API errors until the push step has already
     * failed.
     *
     * Caveats:
     *   - Classic PATs return scopes via the `x-oauth-scopes` header.
     *   - Fine-grained PATs do NOT populate that header. When `scopes` comes
     *     back empty, treat scope validation as inconclusive — proceed and
     *     rely on the push-time error if a permission is missing.
     */
    static async verifyToken(token: string): Promise<{ login: string; scopes: string[] } | null> {
        try {
            const params: RequestUrlParam = {
                url: 'https://api.github.com/user',
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            };
            const response = await requestUrl(params);
            if (response.status === 200) {
                const login = response.json?.login || '';
                const scopesHeader = this.readHeader(response.headers, 'x-oauth-scopes');
                const scopes = scopesHeader
                    ? scopesHeader.split(',').map((s) => s.trim()).filter(Boolean)
                    : [];
                return { login, scopes };
            }
            return null;
        } catch {
            return null;
        }
    }

    /** Case-insensitive header lookup — Obsidian normalizes inconsistently across versions. */
    private static readHeader(headers: Record<string, string> | undefined, name: string): string | null {
        if (!headers) return null;
        const lower = name.toLowerCase();
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === lower) return headers[key] || null;
        }
        return null;
    }
}
