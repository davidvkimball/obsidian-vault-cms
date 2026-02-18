import { App, Modal, TFile, setIcon } from 'obsidian';
import VaultCMSPlugin from '../main';
import { ProjectDetector } from '../utils/ProjectDetector';
import { BasesCMSConfigurator } from '../utils/BasesCMSConfig';

interface HealthCheckResult {
	category: string;
	checks: {
		name: string;
		status: 'pass' | 'fail' | 'warning';
		message?: string;
	}[];
}

export class HealthCheckModal extends Modal {
	private plugin: VaultCMSPlugin;
	private results: HealthCheckResult[] = [];

	constructor(app: App, plugin: VaultCMSPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('vault-cms-health-check');

		// Add title
		contentEl.createEl('h2', { text: 'Vault CMS Health Check' });

		// Run all health checks
		await this.runHealthChecks();

		// Display results
		this.displayResults(contentEl);

		// Add close button
		const footer = contentEl.createDiv({ cls: 'health-check-footer' });
		const closeBtn = footer.createEl('button', {
			text: 'Close',
			cls: 'mod-cta'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	private async runHealthChecks() {
		this.results = [];

		// Check 1: Companion Plugins Installation
		await this.checkCompanionPluginsInstalled();

		// Check 2: Companion Plugins Enabled
		await this.checkCompanionPluginsEnabled();

		// Check 3: Astro Project Detection
		await this.checkAstroProjectDetection();

		// Check 4: Plugin Configuration
		await this.checkPluginConfiguration();

		// Check 5: Git Integration
		await this.checkGitIntegration();
	}

	private async checkCompanionPluginsInstalled() {
		const requiredPlugins = [
			{ id: 'astro-composer', name: 'Astro Composer' },
			{ id: 'bases-cms', name: 'Bases CMS' },
			{ id: 'home-base', name: 'Home Base' },
			{ id: 'seo', name: 'SEO' }
		];

		const optionalPlugins = [
			{ id: 'property-over-file-name', name: 'Property Over File Name' },
			{ id: 'image-manager', name: 'Image Manager' }
		];

		const checks: HealthCheckResult['checks'] = [];

		const plugins = (this.app as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins || {};

		// Check required plugins
		for (const plugin of requiredPlugins) {
			const isInstalled = !!plugins[plugin.id];
			checks.push({
				name: `${plugin.name} installed`,
				status: isInstalled ? 'pass' : 'fail',
				message: isInstalled ? undefined : 'Plugin not installed'
			});
		}

		// Check optional plugins
		for (const plugin of optionalPlugins) {
			const isInstalled = !!plugins[plugin.id];
			checks.push({
				name: `${plugin.name} installed`,
				status: isInstalled ? 'pass' : 'warning',
				message: isInstalled ? undefined : 'Optional plugin not installed'
			});
		}

		this.results.push({
			category: 'Plugin Installation',
			checks
		});
	}

	private async checkCompanionPluginsEnabled() {
		const requiredPlugins = [
			{ id: 'astro-composer', name: 'Astro Composer' },
			{ id: 'bases-cms', name: 'Bases CMS' },
			{ id: 'home-base', name: 'Home Base' },
			{ id: 'seo', name: 'SEO' }
		];

		const checks: HealthCheckResult['checks'] = [];

		const pluginsAPI = (this.app as { plugins?: { enabledPlugins?: Set<string> } }).plugins;
		const enabledPlugins = pluginsAPI?.enabledPlugins || new Set<string>();

		for (const plugin of requiredPlugins) {
			const isEnabled = enabledPlugins.has(plugin.id);
			checks.push({
				name: `${plugin.name} enabled`,
				status: isEnabled ? 'pass' : 'fail',
				message: isEnabled ? undefined : 'Plugin is installed but not enabled'
			});
		}

		this.results.push({
			category: 'Plugin Status',
			checks
		});
	}

	private async checkAstroProjectDetection() {
		const checks: HealthCheckResult['checks'] = [];

		// Check if project is detected in settings
		const hasProjectRoot = !!this.plugin.settings.projectRoot;
		const hasConfigFile = !!this.plugin.settings.configFilePath;

		checks.push({
			name: 'Project root configured',
			status: hasProjectRoot ? 'pass' : 'fail',
			message: hasProjectRoot ? this.plugin.settings.projectRoot : 'Project root not set'
		});

		checks.push({
			name: 'Config file detected',
			status: hasConfigFile ? 'pass' : 'fail',
			message: hasConfigFile ? this.plugin.settings.configFilePath : 'Config file not found'
		});

		// Try to detect project structure
		if (hasProjectRoot && hasConfigFile) {
			const detector = new ProjectDetector(this.app);
			try {
				const detection = await detector.detectProject();
				checks.push({
					name: 'Project structure valid',
					status: detection ? 'pass' : 'warning',
					message: detection ? `Found ${detection.configFilePath}` : 'Could not validate project structure'
				});
			} catch (error: unknown) {
				checks.push({
					name: 'Project structure valid',
					status: 'warning',
					message: `Error: ${error instanceof Error ? error.message : String(error)}`
				});
			}
		}

		// Check content types
		const hasContentTypes = this.plugin.settings.contentTypes && this.plugin.settings.contentTypes.length > 0;
		checks.push({
			name: 'Content types configured',
			status: hasContentTypes ? 'pass' : 'warning',
			message: hasContentTypes ? `${this.plugin.settings.contentTypes.length} content type(s) configured` : 'No content types configured'
		});

		this.results.push({
			category: 'Astro Project',
			checks
		});
	}

	private async checkPluginConfiguration() {
		const checks: HealthCheckResult['checks'] = [];

		// Read actual plugin configs from their data.json files
		const configDir = this.app.vault.configDir;

		// Check Astro Composer configuration (try plugin API first, then file)
		let astroComposerContentTypes = 0;
		try {
			// Try plugin API first (more reliable)
			const plugins = (this.app as { plugins?: { plugins?: Record<string, { settings?: { contentTypes?: unknown[] } }> } }).plugins;
			const astroComposerPlugin = plugins?.plugins?.['astro-composer'];
			if (astroComposerPlugin?.settings?.contentTypes) {
				astroComposerContentTypes = astroComposerPlugin.settings.contentTypes.length;
			} else {
				// Fallback to file reading
				const astroComposerPath = `${configDir}/plugins/astro-composer/data.json`;
				const astroFile = this.app.vault.getAbstractFileByPath(astroComposerPath);
				if (astroFile instanceof TFile) {
					const content = await this.app.vault.read(astroFile);
					const data = JSON.parse(content) as { contentTypes?: unknown[] };
					astroComposerContentTypes = data.contentTypes?.length || 0;
				}
			}
		} catch {
			// Plugin not configured or file doesn't exist
		}

		checks.push({
			name: 'Astro Composer configured',
			status: astroComposerContentTypes > 0 ? 'pass' : 'warning',
			message: astroComposerContentTypes > 0 ?
				`${astroComposerContentTypes} content type(s)` :
				'No content types configured'
		});

		// Check Bases CMS configuration (check for base file existence)
		let basesConfigured = false;
		let basesMessage = 'No base file found';
		try {
			const configurator = new BasesCMSConfigurator(this.app);
			const baseFilePath = await configurator.resolveBaseFilePath();
			if (await this.app.vault.adapter.exists(baseFilePath)) {
				basesConfigured = true;
				basesMessage = `${baseFilePath} found`;
			}
		} catch {
			// File doesn't exist
		}

		checks.push({
			name: 'Bases CMS configured',
			status: basesConfigured ? 'pass' : 'warning',
			message: basesMessage
		});

		// Check SEO configuration (try plugin API first, then file)
		let seoScanDirs = '';
		try {
			// Try plugin API first (more reliable)
			const plugins = (this.app as { plugins?: { plugins?: Record<string, { settings?: { scanDirectories?: string } }> } }).plugins;
			const seoPlugin = plugins?.plugins?.['seo'];
			if (seoPlugin?.settings?.scanDirectories) {
				seoScanDirs = seoPlugin.settings.scanDirectories;
			} else {
				// Fallback to file reading
				const seoPath = `${configDir}/plugins/seo/data.json`;
				const seoFile = this.app.vault.getAbstractFileByPath(seoPath);
				if (seoFile instanceof TFile) {
					const content = await this.app.vault.read(seoFile);
					const data = JSON.parse(content) as { scanDirectories?: string };
					seoScanDirs = data.scanDirectories || '';
				}
			}
		} catch {
			// Plugin not configured or file doesn't exist
		}

		checks.push({
			name: 'SEO plugin configured',
			status: seoScanDirs.length > 0 ? 'pass' : 'warning',
			message: seoScanDirs.length > 0 ?
				`Scanning: ${seoScanDirs}` :
				'No scan directories configured'
		});

		// Check default content type - show display name instead of ID
		const hasDefaultContentType = !!this.plugin.settings.defaultContentTypeId;
		let defaultContentTypeName = this.plugin.settings.defaultContentTypeId || '';
		if (hasDefaultContentType) {
			// Try to look up the display name from Astro Composer's content types
			try {
				const plugins = (this.app as { plugins?: { plugins?: Record<string, { settings?: { contentTypes?: Array<{ id?: string; name?: string }> } }> } }).plugins;
				const astroComposerPlugin = plugins?.plugins?.['astro-composer'];
				const contentTypes = astroComposerPlugin?.settings?.contentTypes;
				if (contentTypes) {
					const matchingType = contentTypes.find(ct => ct.id === this.plugin.settings.defaultContentTypeId);
					if (matchingType?.name) {
						defaultContentTypeName = matchingType.name;
					}
				}
			} catch {
				// Keep the ID as fallback
			}
		}
		checks.push({
			name: 'Default content type set',
			status: hasDefaultContentType ? 'pass' : 'warning',
			message: hasDefaultContentType ? defaultContentTypeName : 'No default content type'
		});

		this.results.push({
			category: 'Plugin Configuration',
			checks
		});
	}

	private async checkGitIntegration() {
		const checks: HealthCheckResult['checks'] = [];
		const { gitConfig, projectRoot } = this.plugin.settings;

		// 1. Check if Git is a repo
		if (projectRoot) {
			const { GitManager } = await import('../utils/GitManager');
			const isRepo = await GitManager.isRepo(projectRoot);
			const remoteUrl = isRepo ? await GitManager.getRemoteUrl(projectRoot) : null;

			checks.push({
				name: 'Git repository initialized',
				status: isRepo ? 'pass' : 'fail',
				message: isRepo ? 'Repository detected at project root' : 'No repository found at project root'
			});

			if (isRepo) {
				// 2. Check Remote / Config
				const isConfigured = gitConfig.enabled || !!remoteUrl;

				checks.push({
					name: 'Git integration status',
					status: isConfigured ? 'pass' : 'warning',
					message: remoteUrl
						? `Connected to ${remoteUrl}`
						: (gitConfig.enabled ? 'Integration active' : 'Not configured (Optional)')
				});

				// 3. Check GitHub PAT
				const savedSecret = (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');
				const hasPat = !!(gitConfig.pat || savedSecret);

				// Only show PAT check if they've explicitly enabled integration OR if it's missing but they started the setup
				if (gitConfig.enabled) {
					checks.push({
						name: 'GitHub PAT configured',
						status: hasPat ? 'pass' : 'warning',
						message: hasPat ? 'Token present' : 'No token found in settings'
					});
				}
			}
		} else {
			checks.push({
				name: 'Git repository check',
				status: 'fail',
				message: 'Project root not configured'
			});
		}

		this.results.push({
			category: 'Git Integration',
			checks
		});
	}

	private displayResults(container: HTMLElement) {
		const resultsContainer = container.createDiv({ cls: 'health-check-results' });

		for (const result of this.results) {
			const categorySection = resultsContainer.createDiv({ cls: 'health-check-category' });
			categorySection.createEl('h3', { text: result.category });

			const checksList = categorySection.createDiv({ cls: 'health-check-list' });

			for (const check of result.checks) {
				const checkItem = checksList.createDiv({ cls: 'health-check-item' });

				// Add status icon
				const statusIcon = checkItem.createSpan({ cls: 'health-check-icon' });
				if (check.status === 'pass') {
					setIcon(statusIcon, 'lucide-check-circle-2');
					statusIcon.addClass('health-check-pass');
				} else if (check.status === 'fail') {
					setIcon(statusIcon, 'lucide-alert-circle');
					statusIcon.addClass('health-check-fail');
				} else {
					setIcon(statusIcon, 'lucide-help-circle');
					statusIcon.addClass('health-check-warning');
				}

				// Add check name
				const checkName = checkItem.createSpan({
					text: check.name,
					cls: 'health-check-name'
				});

				// Add message if present
				if (check.message) {
					const checkMessage = checkItem.createDiv({
						text: check.message,
						cls: 'health-check-message'
					});
				}
			}
		}

		// Add CSS styles
		this.addStyles(container);
	}

	private addStyles(container: HTMLElement) {
		const style = container.createEl('style');
		style.textContent = `
			.vault-cms-health-check {
				padding: 20px;
			}

			.health-check-results {
				margin: 20px 0;
			}

			.health-check-category {
				margin-bottom: 30px;
			}

			.health-check-category h3 {
				margin-bottom: 10px;
				border-bottom: 1px solid var(--background-modifier-border);
				padding-bottom: 5px;
			}

			.health-check-list {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}

			.health-check-item {
				display: flex;
				align-items: flex-start;
				gap: 10px;
				padding: 8px;
				background: var(--background-secondary);
				border-radius: 4px;
			}

			.health-check-icon {
				font-size: 18px;
				font-weight: bold;
				min-width: 24px;
				text-align: center;
			}

			.health-check-pass {
				color: var(--text-success);
			}

			.health-check-fail {
				color: var(--text-error);
			}

			.health-check-warning {
				color: var(--text-warning);
			}

			.health-check-icon svg {
				width: 18px;
				height: 18px;
				display: block;
			}

			.health-check-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				min-width: 24px;
				height: 24px;
			}

			.health-check-name {
				flex: 1;
				font-weight: 500;
			}

			.health-check-message {
				font-size: 0.9em;
				color: var(--text-muted);
				margin-left: 34px;
				margin-top: 4px;
			}

			.health-check-footer {
				display: flex;
				justify-content: flex-end;
				margin-top: 20px;
				padding-top: 15px;
				border-top: 1px solid var(--background-modifier-border);
			}
		`;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
