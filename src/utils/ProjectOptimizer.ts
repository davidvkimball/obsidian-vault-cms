import { App, setIcon } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules
import * as path from 'path';
import { WizardState } from '../types';

export interface OptimizationStatus {
	gitIgnoreStatus: 'configured' | 'not-configured';
	viteIgnoreStatus: 'configured' | 'not-configured';
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

	public async getStatus(): Promise<OptimizationStatus> {
		const status: OptimizationStatus = {
			gitIgnoreStatus: 'not-configured',
			viteIgnoreStatus: 'not-configured'
		};

		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) return status;

		const configDir = this.app.vault.configDir;
		const adapter = this.app.vault.adapter;

		// Check .gitignore
		const gitIgnorePath = path.join(projectRoot, '.gitignore').replace(/\\/g, '/');
		if (await adapter.exists(gitIgnorePath)) {
			const content = await adapter.read(gitIgnorePath);
			if (content.includes(`${configDir}/workspace.json`)) {
				status.gitIgnoreStatus = 'configured';
			}
		}

		// Check Vite config
		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedViteConfigPath = '';

		for (const name of astroConfigNames) {
			const p = path.join(projectRoot, name).replace(/\\/g, '/');
			if (await adapter.exists(p)) {
				resolvedViteConfigPath = p;
				break;
			}
		}

		if (!resolvedViteConfigPath && this.state.projectDetection?.configFilePath) {
			resolvedViteConfigPath = this.state.projectDetection.configFilePath;
		}

		if (resolvedViteConfigPath && await adapter.exists(resolvedViteConfigPath)) {
			const content = await adapter.read(resolvedViteConfigPath);
			if (content.includes('server.watch.ignored') || content.includes('ignored:')) {
				if (content.includes(configDir)) {
					status.viteIgnoreStatus = 'configured';
				}
			}
		}

		return status;
	}

	public async configureGitIgnore(): Promise<void> {
		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) return;

		const configDir = this.app.vault.configDir;
		const gitIgnorePath = path.join(projectRoot, '.gitignore').replace(/\\/g, '/');
		const rules = `\n# Obsidian workspace files\n**/${configDir}/workspace.json\n**/${configDir}/workspace-mobile.json\n`;
		const adapter = this.app.vault.adapter;

		try {
			if (await adapter.exists(gitIgnorePath)) {
				let content = await adapter.read(gitIgnorePath);
				if (!content.includes(`${configDir}/workspace.json`)) {
					content += rules;
					await adapter.write(gitIgnorePath, content);
				}
			} else {
				await adapter.write(gitIgnorePath, rules);
			}
		} catch (error) {
			console.error('Failed to update .gitignore:', error);
			throw error;
		}
	}

	public async configureViteIgnore(): Promise<void> {
		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) return;

		const configDir = this.app.vault.configDir;
		const adapter = this.app.vault.adapter;

		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedConfigPath = '';
		let configFileName = '';

		for (const name of astroConfigNames) {
			const p = path.join(projectRoot, name).replace(/\\/g, '/');
			if (await adapter.exists(p)) {
				resolvedConfigPath = p;
				configFileName = name;
				break;
			}
		}

		if (!resolvedConfigPath && this.state.projectDetection?.configFilePath) {
			resolvedConfigPath = this.state.projectDetection.configFilePath;
			configFileName = path.basename(resolvedConfigPath);
		}

		if (!resolvedConfigPath || !(await adapter.exists(resolvedConfigPath))) {
			throw new Error(`Astro config file not found in: ${projectRoot}`);
		}

		try {
			const content = await adapter.read(resolvedConfigPath);
			
			if (content.includes('server.watch.ignored') && content.includes(configDir)) {
				return;
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
					if (configBody.includes('server:')) {
						if (configBody.includes('watch:')) {
							if (configBody.includes('ignored:')) {
								if (!configBody.includes(configDir)) {
									configBody = configBody.replace(/ignored:\s*\[([^\]]*)\]/, (_m, p1: string) => {
										const existing = p1.trim();
										const separator = existing ? ', ' : '';
										return `ignored: [${existing}${separator}'**/${configDir}/**', '**/_bases/**', '**/bases/**']`;
									});
								}
							} else {
								configBody = configBody.replace(/watch:\s*\{/, `watch: {\n      ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**'],`);
							}
						} else {
							configBody = configBody.replace(/server:\s*\{/, `server: {\n    watch: {\n      ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n    },`);
						}
					} else {
						configBody = configBody.replace(/vite:\s*\{/, `vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n      }\n    },`);
					}
				} else {
					if (isWholeFile) {
						if (content.includes('defineConfig')) {
							configBody = configBody.replace(/defineConfig\s*\(\s*\{/, `defineConfig({\n  vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n      }\n    }\n  },`);
						} else {
							throw new Error(`Could not find a clear place to insert Vite config in ${configFileName}.`);
						}
					} else {
						configBody = `\n  vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n      }\n    }\n  },` + configBody;
					}
				}

				const updatedContent = isWholeFile ? configBody : (content.substring(0, startIndex + 1) + configBody + content.substring(endIndex));
				await adapter.write(resolvedConfigPath, updatedContent);
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
