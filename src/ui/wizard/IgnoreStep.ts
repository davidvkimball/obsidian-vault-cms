import { App, Setting, setIcon, Notice } from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules
import * as fs from 'fs';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

// Helper function for setCssProps (may not be in types yet)
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}

export class IgnoreStep extends BaseWizardStep {
	private gitIgnoreStatus: 'configured' | 'not-configured' = 'not-configured';
	private viteIgnoreStatus: 'configured' | 'not-configured' = 'not-configured';

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.checkConfigurationStatus();
	}

	private getVaultPath(): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		return vaultPath ? vaultPath.replace(/\\/g, '/') : '';
	}

	private resolvePath(p: string): string {
		if (path.isAbsolute(p)) return p;
		return path.join(this.getVaultPath(), p);
	}

	private checkConfigurationStatus() {
		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) return;

		const resolvedProjectRoot = this.resolvePath(projectRoot);
		const configDir = this.app.vault.configDir;

		// Check .gitignore
		const gitIgnorePath = path.join(resolvedProjectRoot, '.gitignore');
		if (fs.existsSync(gitIgnorePath)) {
			const content = fs.readFileSync(gitIgnorePath, 'utf8');
			if (content.includes(`${configDir}/workspace.json`)) {
				this.gitIgnoreStatus = 'configured';
				this.state.ignoreConfig.gitIgnoreConfigured = true;
			}
		}

		// Check Vite config - find the ACTUAL astro.config.* file in root
		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedViteConfigPath = '';

		for (const name of astroConfigNames) {
			const p = path.join(resolvedProjectRoot, name);
			if (fs.existsSync(p)) {
				resolvedViteConfigPath = p;
				break;
			}
		}

		// Fallback to state config file if no root astro.config.* found
		if (!resolvedViteConfigPath && this.state.projectDetection?.configFilePath) {
			resolvedViteConfigPath = this.resolvePath(this.state.projectDetection.configFilePath);
		}

		if (resolvedViteConfigPath && fs.existsSync(resolvedViteConfigPath)) {
			const content = fs.readFileSync(resolvedViteConfigPath, 'utf8');
			if (content.includes('server.watch.ignored') || content.includes('ignored:')) {
				if (content.includes(configDir)) {
					this.viteIgnoreStatus = 'configured';
					this.state.ignoreConfig.viteIgnoreConfigured = true;
				}
			}
		}
	}

	async display(): Promise<void> {
		this.checkConfigurationStatus();
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Project optimization (optional)' });
		containerEl.createEl('p', {
			// False positive: "Obsidian", "Git", and "Vite" are proper nouns
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'Optimize your project by ignoring Obsidian-specific files in Git and Vite. This prevents issues with conflicts and errors in your project.'
		});

		// Git Ignore Setting
		const gitSetting = new Setting(containerEl)
			.setName('Git ignore')
			.setDesc('Add Obsidian workspace files to .gitignore to prevent them from being tracked.')
			.addButton(button => {
				button.setButtonText(this.gitIgnoreStatus === 'configured' ? 'Re-configure' : 'Configure')
					.onClick(async () => {
						await this.configureGitIgnore();
						void this.display();
					});
			});

		this.renderStatus(gitSetting.controlEl, this.gitIgnoreStatus);

		// Vite Ignore Setting
		const viteSetting = new Setting(containerEl)
			.setName('Vite ignore')
			// False positive: "Vite", "Obsidian", and "bases" are proper nouns
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Configure Vite to ignore Obsidian and bases folders. This prevents the dev server from processing numerous internal files.')
			.addButton(button => {
				button.setButtonText(this.viteIgnoreStatus === 'configured' ? 'Re-configure' : 'Configure')
					.onClick(async () => {
						await this.configureViteIgnore();
						void this.display();
					});
			});

		this.renderStatus(viteSetting.controlEl, this.viteIgnoreStatus);
		
		return Promise.resolve();
	}

	private renderStatus(container: HTMLElement, status: 'configured' | 'not-configured') {
		const statusEl = container.createDiv({ cls: 'vault-cms-plugin-status' });
		if (status === 'configured') {
			setIcon(statusEl, 'lucide-check-circle-2');
			setCssProps(statusEl, { color: 'var(--text-success)' });
		} else {
			setIcon(statusEl, 'lucide-alert-circle');
			setCssProps(statusEl, { color: 'var(--text-warning)' });
		}
	}

	private async configureGitIgnore() {
		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) {
			new Notice('Project root not detected');
			return Promise.resolve();
		}

		const resolvedProjectRoot = this.resolvePath(projectRoot);
		const configDir = this.app.vault.configDir;
		const gitIgnorePath = path.join(resolvedProjectRoot, '.gitignore');
		const rules = `\n# Obsidian workspace files\n**/${configDir}/workspace.json\n**/${configDir}/workspace-mobile.json\n`;

		try {
			if (fs.existsSync(gitIgnorePath)) {
				let content = fs.readFileSync(gitIgnorePath, 'utf8');
				if (!content.includes(`${configDir}/workspace.json`)) {
					content += rules;
					fs.writeFileSync(gitIgnorePath, content, 'utf8');
					console.debug(`IgnoreStep: Updated existing .gitignore at ${gitIgnorePath}`);
				} else {
					console.debug(`IgnoreStep: .gitignore at ${gitIgnorePath} already contains rules`);
				}
			} else {
				fs.writeFileSync(gitIgnorePath, rules, 'utf8');
				console.debug(`IgnoreStep: Created new .gitignore at ${gitIgnorePath}`);
			}
			this.gitIgnoreStatus = 'configured';
			this.state.ignoreConfig.gitIgnoreConfigured = true;
			new Notice('.gitignore updated');
		} catch (error) {
			console.error('Failed to update .gitignore:', error);
			new Notice(`Failed to update .gitignore: ${error instanceof Error ? error.message : String(error)}`);
		}
		return Promise.resolve();
	}

	private async configureViteIgnore() {
		const projectRoot = this.state.projectDetection?.projectRoot;
		if (!projectRoot) {
			new Notice('Project root not detected');
			return Promise.resolve();
		}

		const resolvedProjectRoot = this.resolvePath(projectRoot);
		const configDir = this.app.vault.configDir;

		// Find the ACTUAL astro.config.* file, prioritizing it over whatever was detected
		// since Vite config MUST be in astro.config.*
		const astroConfigNames = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js', 'astro.config.mts', 'astro.config.cjs'];
		let resolvedConfigPath = '';
		let configFileName = '';

		for (const name of astroConfigNames) {
			const p = path.join(resolvedProjectRoot, name);
			if (fs.existsSync(p)) {
				resolvedConfigPath = p;
				configFileName = name;
				break;
			}
		}

		// Fallback to detected config file if no astro.config.* found
		if (!resolvedConfigPath && this.state.projectDetection?.configFilePath) {
			resolvedConfigPath = this.resolvePath(this.state.projectDetection.configFilePath);
			configFileName = path.basename(resolvedConfigPath);
		}

		if (!resolvedConfigPath || !fs.existsSync(resolvedConfigPath)) {
			console.error(`IgnoreStep V8: Astro config file not found. Root: ${resolvedProjectRoot}`);
			new Notice(`V8: Could not find Astro config file in: ${projectRoot}`);
			return Promise.resolve();
		}

		try {
			const content = fs.readFileSync(resolvedConfigPath, 'utf8');
			
			// Simple check if it's already there
			if (content.includes('server.watch.ignored') && content.includes(configDir)) {
				new Notice('Vite ignore already configured');
				this.viteIgnoreStatus = 'configured';
				this.state.ignoreConfig.viteIgnoreConfigured = true;
				return Promise.resolve();
			}

			// Find the config object start - look for export default and then the first brace
			const exportIdx = content.lastIndexOf('export default');
			let startIndex = -1;
			let endIndex = -1;
			let configBody = '';
			let isWholeFile = false;

			if (exportIdx !== -1) {
				startIndex = content.indexOf('{', exportIdx);
				if (startIndex !== -1) {
					// Find matching closing brace
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

			// Fallback: if we couldn't find a clear config object after export default,
			// check if the file seems to contain a vite config anywhere
			if (!configBody && (content.includes('vite:') || content.includes('server:'))) {
				configBody = content;
				isWholeFile = true;
				console.debug(`IgnoreStep: Falling back to whole-file parsing for ${configFileName}`);
			}

			if (configBody) {
				// Check if vite block exists
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
					// For whole file fallback, we need to be careful where we insert.
					// If it's the whole file, we'll try to insert before the last brace if it's a simple export,
					// or just at the end if it's a function.
					// But for the config object approach, we insert at the beginning.
					if (isWholeFile) {
						// Best effort for whole file: find where defineConfig or export default is
						if (content.includes('defineConfig')) {
							configBody = configBody.replace(/defineConfig\s*\(\s*\{/, `defineConfig({\n  vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n      }\n    }\n  },`);
						} else {
							// Last resort: prepend
							configBody = `// Vite optimization\n// vite: { server: { watch: { ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**'] } } }\n` + configBody;
							new Notice(`Could not find a clear place to insert Vite config in ${configFileName}. Please configure manually.`);
							return Promise.resolve();
						}
					} else {
						configBody = `\n  vite: {\n    server: {\n      watch: {\n        ignored: ['**/${configDir}/**', '**/_bases/**', '**/bases/**']\n      }\n    }\n  },` + configBody;
					}
				}

				const updatedContent = isWholeFile ? configBody : (content.substring(0, startIndex + 1) + configBody + content.substring(endIndex));
				fs.writeFileSync(resolvedConfigPath, updatedContent, 'utf8');
				this.viteIgnoreStatus = 'configured';
				this.state.ignoreConfig.viteIgnoreConfigured = true;
				new Notice(`Vite optimization applied to ${configFileName}`);
			} else {
				if (exportIdx === -1) {
					new Notice(`Could not find "export default" in ${configFileName}. Please configure manually.`);
				} else {
					new Notice(`Could not find configuration start brace in ${configFileName}. Please configure manually.`);
				}
			}
		} catch (error) {
			console.error(`IgnoreStep: Error updating ${configFileName}:`, error);
			new Notice(`Failed to update ${configFileName}`);
		}
		return Promise.resolve();
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Project optimization (optional)';
	}

	getDescription(): string {
		return 'Configure project-level ignores';
	}
}
