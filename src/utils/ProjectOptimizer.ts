import { App, setIcon } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for file operations
import * as fs from 'fs';
import { WizardState } from '../types';
import { getVaultPath } from './VaultPathHelper';
import { resolveProjectRootFromVaultPath } from './ProjectRootResolver';

export interface OptimizationStatus {
	gitIgnoreStatus: 'configured' | 'not-configured';
	viteIgnoreStatus: 'configured' | 'not-configured';
	gitHooksStatus: 'detected' | 'neutralized' | 'none';
	/**
	 * Whether the project ships a Dependabot config (`.github/dependabot.yml`).
	 * Dependabot opens dependency-bump pull requests the moment the repo lands
	 * on GitHub, which is noise for a typical Vault CMS user. Removal is opt-in.
	 *
	 * NOTE: We intentionally do NOT touch `.github/workflows/*.yml`. Workflow
	 * files can be genuine features (e.g. a video/media optimization pipeline),
	 * not just CI noise, and the plugin can't reliably tell them apart. The
	 * reason workflows were once removed here was the PAT push error
	 * ("refusing to allow a Personal Access Token to create or update workflow
	 * ... without `workflow` scope"). That is handled the correct way in the
	 * Git setup step: the PAT generation link pre-checks the `workflow` scope
	 * and a missing scope is detected up front. Deleting useful workflows to
	 * dodge a token-scope requirement is the wrong tradeoff.
	 *
	 * Other `.github/` content (ISSUE_TEMPLATE/, pull_request_template.md,
	 * CODEOWNERS, FUNDING.yml) is also left in place.
	 */
	githubAutomationStatus: 'detected' | 'removed' | 'none';
	/** Dependabot config files that would be removed if the user opts in. */
	githubAutomationFiles: string[];
}

/**
 * Helper function for setCssProps
 */
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}

export class ProjectOptimizer {
	private app: App;
	private state: WizardState;

	constructor(app: App, state: WizardState) {
		this.app = app;
		this.state = state;
	}

	private resolveProjectRoot(): string | null {
		const vaultPath = getVaultPath(this.app);
		return resolveProjectRootFromVaultPath(vaultPath ?? '', this.state.projectDetection?.projectRoot);
	}

	public async getStatus(): Promise<OptimizationStatus> {
		const status: OptimizationStatus = {
			gitIgnoreStatus: 'not-configured',
			viteIgnoreStatus: 'not-configured',
			gitHooksStatus: 'none',
			githubAutomationStatus: 'none',
			githubAutomationFiles: [],
		};

		const projectRoot = this.resolveProjectRoot();
		if (!projectRoot) {
			console.debug('[Vault CMS] ProjectOptimizer: No projectRoot in state');
			return status;
		}

		const configDir = this.app.vault.configDir;
		console.debug('[Vault CMS] ProjectOptimizer: Checking status for root:', projectRoot, 'configDir:', configDir);

		// Check .gitignore
		const gitIgnorePath = path.join(projectRoot, '.gitignore');
		if (fs.existsSync(gitIgnorePath)) {
			const content = fs.readFileSync(gitIgnorePath, 'utf8');
			const isConfigured = content.includes(`${configDir}/workspace.json`) || content.includes(`**/${configDir}/workspace.json`);
			console.debug('[Vault CMS] ProjectOptimizer: .gitignore exists, configured:', isConfigured);
			if (isConfigured) {
				status.gitIgnoreStatus = 'configured';
			}
		} else {
			console.debug('[Vault CMS] ProjectOptimizer: .gitignore NOT found at:', gitIgnorePath);
		}

		// Check Vite config
		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedViteConfigPath = '';

		for (const name of astroConfigNames) {
			const p = path.join(projectRoot, name);
			if (fs.existsSync(p)) {
				resolvedViteConfigPath = p;
				break;
			}
		}

		if (!resolvedViteConfigPath && this.state.projectDetection?.configFilePath) {
			const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
			const vaultPath = adapter.basePath || adapter.path || '';
			resolvedViteConfigPath = path.resolve(vaultPath, this.state.projectDetection.configFilePath);
		}

		if (resolvedViteConfigPath && fs.existsSync(resolvedViteConfigPath)) {
			console.debug('[Vault CMS] ProjectOptimizer: Checking Vite config at:', resolvedViteConfigPath);
			const content = fs.readFileSync(resolvedViteConfigPath, 'utf8');
			const hasWatchIgnored = content.includes('server.watch.ignored') || content.includes('ignored:');
			const hasAssetsInclude = content.includes('assetsInclude:');
			const hasConfigDir = content.includes(configDir);
			const hasBasesPattern = content.includes('bases') || content.includes('home') || content.includes('base');
			console.debug('[Vault CMS] ProjectOptimizer: Vite config has patterns:', { hasWatchIgnored, hasAssetsInclude, hasConfigDir, hasBasesPattern });
			if (hasWatchIgnored && hasAssetsInclude && (hasConfigDir || hasBasesPattern)) {
				status.viteIgnoreStatus = 'configured';
			}
		} else {
			console.debug('[Vault CMS] ProjectOptimizer: No valid Astro config found to check');
		}

		// Check for git hooks (husky, simple-git-hooks, lefthook, etc.)
		status.gitHooksStatus = this.detectGitHooks(projectRoot);

		// Check for a Dependabot config (auto-creates dependency-bump PRs).
		// Workflow files are intentionally left alone; see the note on
		// OptimizationStatus.githubAutomationStatus.
		const automationFiles = this.listGithubAutomationFiles(projectRoot);
		if (automationFiles.length > 0) {
			status.githubAutomationStatus = 'detected';
			status.githubAutomationFiles = automationFiles;
		}

		return status;
	}

	/**
	 * Returns the absolute path(s) of the project's Dependabot config
	 * (`.github/dependabot.yml` or `.yaml`), which we offer to remove because
	 * it auto-creates dependency-bump pull requests as soon as the repo is on
	 * GitHub.
	 *
	 * Workflow files (`.github/workflows/*.yml`), issue templates, PR
	 * templates, CODEOWNERS, and FUNDING.yml are NOT touched.
	 */
	private listGithubAutomationFiles(projectRoot: string): string[] {
		const files: string[] = [];

		// Dependabot config (either extension)
		for (const name of ['dependabot.yml', 'dependabot.yaml']) {
			const dependabotPath = path.join(projectRoot, '.github', name);
			if (fs.existsSync(dependabotPath)) files.push(dependabotPath);
		}

		return files;
	}

	/**
	 * Removes the Dependabot config listed by `listGithubAutomationFiles`.
	 * Workflow files and all other `.github/` contents are left untouched.
	 *
	 * Returns the count of files removed.
	 */
	public removeGithubAutomation(): number {
		const projectRoot = this.resolveProjectRoot();
		if (!projectRoot) return 0;

		const files = this.listGithubAutomationFiles(projectRoot);
		let removed = 0;
		for (const filePath of files) {
			try {
				fs.unlinkSync(filePath);
				removed++;
			} catch (e) {
				console.error('[Vault CMS] Failed to remove Dependabot config:', filePath, e);
			}
		}

		return removed;
	}

	/**
	 * Detects developer git hooks that would interfere with Obsidian-based publishing.
	 * Checks for: husky, simple-git-hooks, lefthook, lint-staged, commitlint.
	 */
	private detectGitHooks(projectRoot: string): 'detected' | 'neutralized' | 'none' {
		const huskyPreCommit = path.join(projectRoot, '.husky', 'pre-commit');
		const huskyCommitMsg = path.join(projectRoot, '.husky', 'commit-msg');
		const lefthookYml = path.join(projectRoot, 'lefthook.yml');
		const simpleGitHooksInPkg = this.packageJsonHasHookTools(projectRoot);

		const hasHooks = fs.existsSync(huskyPreCommit) || fs.existsSync(huskyCommitMsg) || fs.existsSync(lefthookYml) || simpleGitHooksInPkg;

		if (!hasHooks) return 'none';

		// Check if already neutralized (hooks contain only "exit 0" or are empty)
		const isNeutralized = this.isHookNeutralized(huskyPreCommit) && this.isHookNeutralized(huskyCommitMsg);
		if (isNeutralized && !fs.existsSync(lefthookYml) && !simpleGitHooksInPkg) return 'neutralized';

		return 'detected';
	}

	private isHookNeutralized(hookPath: string): boolean {
		if (!fs.existsSync(hookPath)) return true;
		const content = fs.readFileSync(hookPath, 'utf8').trim();
		return content === 'exit 0' || content === '' || content === '#!/bin/sh\nexit 0';
	}

	private packageJsonHasHookTools(projectRoot: string): boolean {
		const pkgPath = path.join(projectRoot, 'package.json');
		if (!fs.existsSync(pkgPath)) return false;
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
			const scripts = pkg.scripts || {};
			// Only check if prepare script actively references hook tools
			// Mere presence of devDependencies (commitlint, lint-staged) is harmless without hooks
			const prepare = scripts.prepare || '';
			return /husky|simple-git-hooks|lefthook/.test(prepare);
		} catch {
			return false;
		}
	}

	/**
	 * Neutralizes git hooks so they don't block Obsidian-based publishing.
	 * - Replaces husky hook scripts with "exit 0"
	 * - Removes the "prepare" script from package.json if it references hook tools
	 */
	public neutralizeGitHooks(): boolean {
		const projectRoot = this.resolveProjectRoot();
		if (!projectRoot) return false;

		let changed = false;

		// Neutralize husky hooks
		const huskyDir = path.join(projectRoot, '.husky');
		if (fs.existsSync(huskyDir)) {
			for (const hookName of ['pre-commit', 'commit-msg', 'pre-push']) {
				const hookPath = path.join(huskyDir, hookName);
				if (fs.existsSync(hookPath) && !this.isHookNeutralized(hookPath)) {
					fs.writeFileSync(hookPath, 'exit 0', 'utf8');
					changed = true;
				}
			}
		}

		// Remove prepare script if it references hook tools
		const pkgPath = path.join(projectRoot, 'package.json');
		if (fs.existsSync(pkgPath)) {
			try {
				const pkgContent = fs.readFileSync(pkgPath, 'utf8');
				const pkg = JSON.parse(pkgContent);
				if (pkg.scripts?.prepare && /husky|simple-git-hooks|lefthook/.test(pkg.scripts.prepare)) {
					delete pkg.scripts.prepare;
					fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
					changed = true;
				}
			} catch (e) {
				console.error('[Vault CMS] Failed to patch package.json:', e);
			}
		}

		// Remove lefthook config
		const lefthookPath = path.join(projectRoot, 'lefthook.yml');
		if (fs.existsSync(lefthookPath)) {
			try {
				fs.unlinkSync(lefthookPath);
				changed = true;
			} catch (e) {
				console.error('[Vault CMS] Failed to remove lefthook.yml:', e);
			}
		}

		return changed;
	}

	public async configureGitIgnore(): Promise<boolean> {
		const projectRoot = this.resolveProjectRoot();
		if (!projectRoot) {
			console.error('[Vault CMS] ProjectOptimizer: No projectRoot for Git configuration');
			return false;
		}

		const configDir = this.app.vault.configDir;
		const gitIgnorePath = path.join(projectRoot, '.gitignore');
		const rules = `\n# Obsidian workspace files\n**/${configDir}/workspace.json\n**/${configDir}/workspace-mobile.json\n`;

		console.debug('[Vault CMS] ProjectOptimizer: Configuring Git ignore at:', gitIgnorePath);

		try {
			if (fs.existsSync(gitIgnorePath)) {
				let content = fs.readFileSync(gitIgnorePath, 'utf8');
				const hasNewPattern = content.includes(`**/${configDir}/workspace.json`);
				const hasOldPattern = content.includes(`*/${configDir}/workspace.json`) || content.includes(`${configDir}/workspace.json`);

				if (hasOldPattern && !hasNewPattern) {
					console.debug('[Vault CMS] ProjectOptimizer: Updating old Git patterns');
					// Replace old patterns if they exist
					content = content.replace(new RegExp(`\\*?/?${configDir}/workspace\\.json`, 'g'), `**/${configDir}/workspace.json`);
					content = content.replace(new RegExp(`\\*?/?${configDir}/workspace-mobile\\.json`, 'g'), `**/${configDir}/workspace-mobile.json`);
					fs.writeFileSync(gitIgnorePath, content, 'utf8');
				} else if (!hasNewPattern) {
					console.debug('[Vault CMS] ProjectOptimizer: Adding new Git patterns');
					// Add new rules if neither pattern exists
					content += rules;
					fs.writeFileSync(gitIgnorePath, content, 'utf8');
				} else {
					console.debug('[Vault CMS] ProjectOptimizer: Git patterns already present');
				}
			} else {
				console.debug('[Vault CMS] ProjectOptimizer: Creating new .gitignore');
				fs.writeFileSync(gitIgnorePath, rules, 'utf8');
			}
			return true;
		} catch (error) {
			console.error('[Vault CMS] Failed to update .gitignore:', error);
			throw error;
		}
	}

	public async configureViteIgnore(): Promise<boolean> {
		const projectRoot = this.resolveProjectRoot();
		if (!projectRoot) return false;

		const configDir = this.app.vault.configDir;

		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedConfigPath = '';
		let configFileName = '';

		for (const name of astroConfigNames) {
			const p = path.join(projectRoot, name);
			if (fs.existsSync(p)) {
				resolvedConfigPath = p;
				configFileName = name;
				break;
			}
		}

		if (!resolvedConfigPath && this.state.projectDetection?.configFilePath) {
			const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
			const vaultPath = adapter.basePath || adapter.path || '';
			resolvedConfigPath = path.resolve(vaultPath, this.state.projectDetection.configFilePath);
			configFileName = path.basename(resolvedConfigPath);
		}

		if (!resolvedConfigPath || !fs.existsSync(resolvedConfigPath)) {
			console.error('[Vault CMS] ProjectOptimizer: Vite config NOT found in:', projectRoot);
			throw new Error(`Astro config file not found in: ${projectRoot}`);
		}

		console.debug('[Vault CMS] ProjectOptimizer: Configuring Vite ignore at:', resolvedConfigPath);

		try {
			const content = fs.readFileSync(resolvedConfigPath, 'utf8');

			if (content.includes('server.watch.ignored') && content.includes(configDir)) {
				return true;
			}

			const exportIdx = content.lastIndexOf('export default');
			let startIndex = -1;
			let endIndex = -1;
			let configBody = '';
			let isWholeFile = false;

			if (exportIdx !== -1) {
				startIndex = content.indexOf('{', exportIdx);
				if (startIndex !== -1) {
					let braceCount = 0;
					for (let i = startIndex; i < content.length; i++) {
						if (content[i] === '{') braceCount++;
						else if (content[i] === '}') braceCount--;

						if (braceCount === 0) {
							endIndex = i;
							break;
						}
					}

					if (endIndex !== -1) {
						configBody = content.substring(startIndex + 1, endIndex);
					}
				}
			}

			if (!configBody && (content.includes('vite:') || content.includes('server:'))) {
				configBody = content;
				isWholeFile = true;
			}

			if (configBody) {
				if (configBody.includes('vite:')) {
					// 1. Add assetsInclude if missing
					if (!configBody.includes('assetsInclude:')) {
						configBody = configBody.replace(/vite:\s*\{/, `vite: {\n    assetsInclude: ['**/*.base', '**/.obsidian/**', '**/_bases/**'],`);
					}

					// 2. Add or update server.watch.ignored
					if (configBody.includes('server:')) {
						if (configBody.includes('watch:')) {
							if (configBody.includes('ignored:')) {
								if (!configBody.includes(configDir)) {
									const ignorePatterns = `'**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**'`;
									configBody = configBody.replace(/ignored:\s*\[([^\]]*)\]/, (_m, p1: string) => {
										const existing = p1.trim();
										const separator = existing ? ', ' : '';
										return `ignored: [${existing}${separator}${ignorePatterns}]`;
									});
								}
							} else {
								configBody = configBody.replace(/watch:\s*\{/, `watch: {\n      ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**'],`);
							}
						} else {
							configBody = configBody.replace(/server:\s*\{/, `server: {\n    watch: {\n      ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**']\n    },`);
						}
					} else {
						configBody = configBody.replace(/vite:\s*\{/, `vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**']\n      }\n    },`);
					}
				} else {
					if (isWholeFile) {
						if (content.includes('defineConfig')) {
							configBody = configBody.replace(/defineConfig\s*\(\s*\{/, `defineConfig({\n  vite: {\n    assetsInclude: ['**/*.base', '**/.obsidian/**', '**/_bases/**'],\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**']\n      }\n    }\n  },`);
						} else {
							throw new Error(`Could not find a clear place to insert Vite config in ${configFileName}.`);
						}
					} else {
						configBody = `\n  vite: {\n    assetsInclude: ['**/*.base', '**/.obsidian/**', '**/_bases/**'],\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**', '**/_home/**', '**/home/**', '**/_base/**', '**/base/**']\n      }\n    }\n  },` + configBody;
					}
				}

				const updatedContent = isWholeFile ? configBody : (content.substring(0, startIndex + 1) + configBody + content.substring(endIndex));
				fs.writeFileSync(resolvedConfigPath, updatedContent, 'utf8');
				return true;
			} else {
				throw new Error(`Could not parse configuration in ${configFileName}.`);
			}
		} catch (error) {
			console.error(`ProjectOptimizer: Error updating ${configFileName}:`, error);
			throw error;
		}
	}

	public renderStatus(container: HTMLElement, status: 'configured' | 'not-configured') {
		const statusEl = container.createDiv({ cls: 'vault-cms-plugin-status' });
		if (status === 'configured') {
			setIcon(statusEl, 'lucide-check-circle-2');
			setCssProps(statusEl, { color: 'var(--text-success)' });
		} else {
			setIcon(statusEl, 'lucide-alert-circle');
			setCssProps(statusEl, { color: 'var(--text-warning)' });
		}
	}
}
