import { requestUrl, RequestUrlParam } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';

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
        try {
            const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: projectRoot });
            return stdout.trim() === 'true';
        } catch {
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
    static async initialCommitAndPush(projectRoot: string, branch: string, remoteName: string = 'origin'): Promise<void> {
        try {
            await execAsync('git add .', { cwd: projectRoot });
            await execAsync('git commit -m "Initial commit from Vault CMS"', { cwd: projectRoot });
            // Ensure branch name is set locally
            await execAsync(`git branch -M ${branch}`, { cwd: projectRoot });
            // Push and set upstream
            await execAsync(`git push -u ${remoteName} ${branch}`, { cwd: projectRoot });
        } catch (error) {
            console.error('Initial push failed:', error);
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
                const errorData = response.json;
                throw new Error(`GitHub API Error: ${errorData?.message || response.status}`);
            }
            return response.json as GitHubRepoResponse;
        } catch (error) {
            if (error instanceof Error && (error.message.includes('422') || error.message.includes('already exists'))) {
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
