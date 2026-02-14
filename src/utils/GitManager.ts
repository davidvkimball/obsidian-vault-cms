import { requestUrl, RequestUrlParam } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface GitHubRepoResponse {
    clone_url: string;
    html_url: string;
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
     * Creates an initial commit and pushes to the remote, setting the upstream.
     */
    static async initialCommitAndPush(projectRoot: string, branch: string, remoteName: string = 'origin', token?: string): Promise<void> {
        try {
            console.debug('GitManager.initialCommitAndPush: starting', { projectRoot, branch, remoteName, hasToken: !!token });

            // 1. Ensure user identity is set (git commit fails without it)
            try {
                await execAsync('git config user.name', { cwd: projectRoot });
            } catch {
                console.debug('GitManager: Setting local git user.name');
                await execAsync('git config user.name "Vault CMS User"', { cwd: projectRoot });
                await execAsync('git config user.email "vault-cms@example.com"', { cwd: projectRoot });
            }

            // 2. Add all files
            await execAsync('git add .', { cwd: projectRoot });

            // 3. Commit
            try {
                await execAsync('git commit -m "Initial commit from Vault CMS"', { cwd: projectRoot });
            } catch (commitError) {
                const errorMessage = commitError instanceof Error ? commitError.message : String(commitError);
                if (errorMessage.includes('nothing to commit') || errorMessage.includes('working tree clean')) {
                    console.debug('GitManager: Nothing to commit');
                } else {
                    throw commitError;
                }
            }

            // 4. Ensure branch name is set locally
            await execAsync(`git branch -M ${branch}`, { cwd: projectRoot });

            // 5. Push and set upstream
            // To ensure the push succeeds without a credential helper, we temporarily use the token in the URL
            if (token) {
                const remoteUrl = await this.getRemoteUrl(projectRoot, remoteName);
                if (remoteUrl && remoteUrl.startsWith('https://')) {
                    const authenticatedUrl = remoteUrl.replace('https://', `https://${token}@`);

                    console.debug('GitManager: Pushing with temporary token auth');
                    // We temporarily set the remote URL to include the token for the push
                    await execAsync(`git remote set-url ${remoteName} ${authenticatedUrl}`, { cwd: projectRoot });

                    try {
                        await execAsync(`git push -u ${remoteName} ${branch}`, { cwd: projectRoot });
                    } finally {
                        // ALWAYS revert to the clean URL
                        await execAsync(`git remote set-url ${remoteName} ${remoteUrl}`, { cwd: projectRoot });
                    }
                } else {
                    await execAsync(`git push -u ${remoteName} ${branch}`, { cwd: projectRoot });
                }
            } else {
                await execAsync(`git push -u ${remoteName} ${branch}`, { cwd: projectRoot });
            }
        } catch (error) {
            console.error('GitManager.initialCommitAndPush failed:', error);
            throw error;
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
     * Verifies if the GitHub PAT is valid and returns the username.
     */
    static async verifyToken(token: string): Promise<string | null> {
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
                return response.json?.login || null;
            }
            return null;
        } catch {
            return null;
        }
    }
}
