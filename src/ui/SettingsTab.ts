import { App, PluginSettingTab, Notice, Setting , SettingGroup} from 'obsidian';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
import VaultCMSPlugin from '../main';
import { SetupWizardModal } from './SetupWizardModal';
import { HealthCheckModal } from './HealthCheckModal';

import { PresetManager } from '../utils/PresetManager';
import { ProjectOptimizer } from '../utils/ProjectOptimizer';
import { WizardState } from '../types';

export class SettingsTab extends PluginSettingTab {
	plugin: VaultCMSPlugin;
	public icon = 'lucide-vault';
	private contentEl: HTMLElement;
	private gitSetting: Setting;
	private viteSetting: Setting;
	private hooksSetting: Setting;
	private workflowsSetting: Setting;
	private optimizer: ProjectOptimizer;

	constructor(app: App, plugin: VaultCMSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// 1.13.0+: framework calls this and skips display().
	// Pre-1.13.0: this method is not invoked; display() below runs as before.
	// See https://docs.obsidian.md/plugins/guides/migrate-declarative-settings
	//
	// This must stay cheap and synchronous (no I/O) because the framework runs
	// it on every update() and once at registration for search indexing. The
	// Git status and project optimization rows depend on async disk reads, so
	// they are produced inside render callbacks that kick off the work the same
	// way display()/render() does, rather than being resolved here.
	getSettingDefinitions() {
		return [
			{
				// First group (no heading) - following UI Tweaker pattern
				type: 'group' as const,
				items: [
					{
						name: 'Open setup wizard',
						desc: 'Launch the setup wizard',
						// Render: this is an action (opens a modal), not a value bind.
						render: (setting: Setting) => {
							setting.addButton(button => {
								button
									.setButtonText('Open wizard')
									.setCta()
									.onClick(() => {
										new SetupWizardModal(this.app, this.plugin.settings, this.plugin).open();
									});
							});
						},
					},
					{
						name: 'Run wizard on startup',
						desc: 'Automatically open the wizard when the plugin loads',
						control: { type: 'toggle' as const, key: 'runWizardOnStartup' },
					},
					{
						name: 'Health check',
						desc: 'Check plugin installation and configuration status',
						// Render: this is an action (opens a modal), not a value bind.
						render: (setting: Setting) => {
							setting.addButton(button => {
								button
									.setButtonText('Run health check')
									.onClick(() => {
										new HealthCheckModal(this.app, this.plugin).open();
									});
							});
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Preset configuration',
				items: [
					{
						name: 'Preset folder name',
						desc: 'Folder name in the repository',
						control: { type: 'text' as const, key: 'presetName', placeholder: 'Example: starlight' },
					},
					{
						name: 'Presets repository',
						desc: 'GitHub repository containing the presets',
						control: { type: 'text' as const, key: 'presetsRepo', placeholder: 'Example: owner/repo' },
					},
					{
						name: 'Download and apply preset',
						desc: 'Download the specified preset and apply it to your vault',
						// Render: this is an action (runs the preset manager), not a value bind.
						render: (setting: Setting) => {
							setting.addButton(button => {
								button
									.setButtonText('Apply preset')
									.onClick(async () => {
										const manager = new PresetManager(this.app);
										await manager.applyPreset(this.plugin.settings.presetsRepo, this.plugin.settings.presetName);
									});
							});
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Git configuration',
				items: [
					{
						name: 'Deployment and Git setup',
						desc: 'Choose a deployment platform and connect to GitHub.',
						// Render: the status rows and setup button depend on async Git
						// reads. This callback reproduces display()'s Git section by
						// running the same checks and rebuilding its own setting.
						render: (setting: Setting) => {
							void this.renderGitConfiguration(setting);
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Project optimization (optional)',
				items: [
					{
						name: 'Project optimization',
						desc: 'Optional adjustments to ignore workspace files and neutralize blockers.',
						// Render: optimization status depends on async disk reads. This
						// callback reproduces display()'s optimization section by running
						// the same checks and rebuilding its own setting(s).
						render: (setting: Setting) => {
							void this.renderProjectOptimization(setting);
						},
					},
				],
			},
		];
	}

	// Async builder for the declarative Git configuration group. Mirrors the
	// Git section of render(): reports local repository status, project root
	// path, remote URL, and the "Setup..." button when not fully configured.
	private async renderGitConfiguration(setting: Setting): Promise<void> {
		const container = setting.settingEl.parentElement ?? setting.settingEl;
		setting.settingEl.remove();

		let isFullyConfigured = false;

		if (this.plugin.settings.projectRoot && this.plugin.settings.projectRoot.trim() !== '') {
			try {
				const { GitManager } = await import('../utils/GitManager');
				const { resolveProjectRoot } = await import('../utils/ProjectRootResolver');
				const projectRoot = resolveProjectRoot(this.app, this.plugin.settings.projectRoot);
				if (!projectRoot) throw new Error('Could not resolve project root');
				const isRepo = await GitManager.isRepo(projectRoot);
				const remoteUrl = isRepo ? await GitManager.getRemoteUrl(projectRoot) : null;
				isFullyConfigured = isRepo && !!remoteUrl;

				const statusSetting = new Setting(container)
					.setName('Local repository status')
					.setDesc(isRepo ? 'Git is initialized at project root.' : 'Git is NOT initialized at project root.');
				const statusIcon = statusSetting.controlEl.createSpan({
					cls: isRepo ? 'git-status-icon-ok' : 'git-status-icon-warn',
					attr: { style: `margin-left: 10px; color: ${isRepo ? 'var(--text-success)' : 'var(--text-warning)'};` }
				});
				statusIcon.setText(isRepo ? '✓ Detected' : '⚠ Missing');

				new Setting(container)
					.setName('Project root path')
					.setDesc('Direct path being checked for Git')
					.addText(text => {
						text.setValue(projectRoot)
							.setDisabled(true);
					});

				if (remoteUrl) {
					new Setting(container)
						.setName('Remote URL')
						.setDesc('Connected GitHub repository')
						.addText(text => {
							text.setValue(remoteUrl)
								.setDisabled(true);
						});
				}
			} catch (error) {
				console.warn('SettingsTab: Failed to check Git status:', error);
			}
		}

		if (!isFullyConfigured) {
			new Setting(container)
				.setName('Deployment and Git setup')
				.setDesc('Choose a deployment platform and connect to GitHub.')
				.addButton(button => {
					button.setButtonText('Setup...')
						.onClick(() => {
							const modal = new SetupWizardModal(this.app, { currentStep: 7 }, this.plugin);
							modal.open();
						});
				});
		}
	}

	// Async builder for the declarative project optimization group. Mirrors the
	// optimization section of render(): Git ignore, Vite ignore, optional git
	// hooks neutralization, and optional GitHub automation removal.
	private async renderProjectOptimization(setting: Setting): Promise<void> {
		const container = setting.settingEl.parentElement ?? setting.settingEl;
		setting.settingEl.remove();

		if (!this.plugin.settings.projectRoot) {
			new Setting(container)
				.setName('Project not detected')
				.setDesc('Complete the setup wizard first to detect your Astro project before configuring optimizations.');
			return;
		}

		const wizardState: WizardState = {
			...this.plugin.settings,
			currentStep: 0,
			projectDetection: {
				projectRoot: this.plugin.settings.projectRoot,
				configFilePath: this.plugin.settings.configFilePath,
				vaultLocation: 'content'
			}
		} as WizardState;

		this.optimizer = new ProjectOptimizer(this.app, wizardState);
		const status = await this.optimizer.getStatus();

		this.gitSetting = new Setting(container);
		this.updateGitSetting(status.gitIgnoreStatus);

		this.viteSetting = new Setting(container);
		this.updateViteSetting(status.viteIgnoreStatus);

		if (status.gitHooksStatus !== 'none') {
			this.hooksSetting = new Setting(container);
			this.updateHooksSetting(status.gitHooksStatus);
		}

		if (status.githubAutomationStatus !== 'none') {
			this.workflowsSetting = new Setting(container);
			this.updateWorkflowsSetting(status.githubAutomationStatus, status.githubAutomationFiles);
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.contentEl = containerEl.createDiv('vault-cms-settings-container');
		void this.render();
	}

	private async render(): Promise<void> {
		if (!this.contentEl) return;

		this.contentEl.empty();

		// First group (no heading) - following UI Tweaker pattern
		const generalGroup = new SettingGroup(this.contentEl);

		generalGroup.addSetting(setting => {
			setting.setName('Open setup wizard')
				.setDesc('Launch the setup wizard')
				.addButton(button => {
					button
						.setButtonText('Open wizard')
						.setCta()
						.onClick(() => {
							new SetupWizardModal(this.app, this.plugin.settings, this.plugin).open();
						});
				});
		});

		generalGroup.addSetting(setting => {
			setting.setName('Run wizard on startup')
				.setDesc('Automatically open the wizard when the plugin loads')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.runWizardOnStartup)
						.onChange(async value => {
							this.plugin.settings.runWizardOnStartup = value;
							await this.plugin.saveSettings();
						});
				});
		});

		generalGroup.addSetting(setting => {
			setting.setName('Health check')
				.setDesc('Check plugin installation and configuration status')
				.addButton(button => {
					button
						.setButtonText('Run health check')
						.onClick(() => {
							new HealthCheckModal(this.app, this.plugin).open();
						});
				});
		});

		// Preset configuration group
		const presetGroup = new SettingGroup(this.contentEl).setHeading('Preset configuration');

		presetGroup.addSetting(setting => {
			setting.setName('Preset folder name')
				.setDesc('Folder name in the repository')
				.addText(text => {
					text
						.setPlaceholder('Example: starlight')
						.setValue(this.plugin.settings.presetName)
						.onChange(async value => {
							this.plugin.settings.presetName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting(setting => {
			setting.setName('Presets repository')
				.setDesc('GitHub repository containing the presets')
				.addText(text => {
					text
						.setPlaceholder('Example: owner/repo')
						.setValue(this.plugin.settings.presetsRepo)
						.onChange(async value => {
							this.plugin.settings.presetsRepo = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting(setting => {
			setting.setName('Download and apply preset')
				.setDesc('Download the specified preset and apply it to your vault')
				.addButton(button => {
					button
						.setButtonText('Apply preset')
						.onClick(async () => {
							const manager = new PresetManager(this.app);
							await manager.applyPreset(this.plugin.settings.presetsRepo, this.plugin.settings.presetName);
						});
				});
		});

		// Git Configuration group
		const gitGroup = new SettingGroup(this.contentEl).setHeading('Git configuration');
		let isFullyConfigured = false;

		// Display Git status if project root is set
		if (this.plugin.settings.projectRoot && this.plugin.settings.projectRoot.trim() !== '') {
			try {
				const { GitManager } = await import('../utils/GitManager');
				const { resolveProjectRoot } = await import('../utils/ProjectRootResolver');
				const projectRoot = resolveProjectRoot(this.app, this.plugin.settings.projectRoot);
				if (!projectRoot) throw new Error('Could not resolve project root');
				const isRepo = await GitManager.isRepo(projectRoot);
				const remoteUrl = isRepo ? await GitManager.getRemoteUrl(projectRoot) : null;
				isFullyConfigured = isRepo && !!remoteUrl;

				gitGroup.addSetting(setting => {
					setting.setName('Local repository status')
						.setDesc(isRepo ? 'Git is initialized at project root.' : 'Git is NOT initialized at project root.');

					const statusIcon = setting.controlEl.createSpan({
						cls: isRepo ? 'git-status-icon-ok' : 'git-status-icon-warn',
						attr: { style: `margin-left: 10px; color: ${isRepo ? 'var(--text-success)' : 'var(--text-warning)'};` }
					});
					statusIcon.setText(isRepo ? '✓ Detected' : '⚠ Missing');
				});

				gitGroup.addSetting(setting => {
					setting.setName('Project root path')
						.setDesc('Direct path being checked for Git')
						.addText(text => {
							text.setValue(projectRoot)
								.setDisabled(true);
						});
				});

				if (remoteUrl) {
					gitGroup.addSetting(setting => {
						setting.setName('Remote URL')
							.setDesc('Connected GitHub repository')
							.addText(text => {
								text.setValue(remoteUrl)
									.setDisabled(true);
							});
					});
				}
			} catch (error) {
				console.warn('SettingsTab: Failed to check Git status:', error);
			}
		}

		// Only show management/setup button if NOT fully configured
		if (!isFullyConfigured) {
			gitGroup.addSetting(setting => {
				setting.setName('Deployment and Git setup')
					.setDesc('Choose a deployment platform and connect to GitHub.')
					.addButton(button => {
						button.setButtonText('Setup...')
							.onClick(() => {
								const modal = new SetupWizardModal(this.app, { currentStep: 7 }, this.plugin);
								modal.open();
							});
					});
			});
		}

		// Project optimization group
		const optimizationGroup = new SettingGroup(this.contentEl).setHeading('Project optimization (optional)');

		// Check if project root is configured
		if (!this.plugin.settings.projectRoot) {
			optimizationGroup.addSetting(setting => {
				setting.setName('Project not detected')
					.setDesc('Complete the setup wizard first to detect your Astro project before configuring optimizations.');
			});
			return;
		}

		// Create optimizer instance
		const wizardState: WizardState = {
			...this.plugin.settings,
			currentStep: 0,
			projectDetection: {
				projectRoot: this.plugin.settings.projectRoot,
				configFilePath: this.plugin.settings.configFilePath,
				vaultLocation: 'content'
			}
		} as WizardState;

		this.optimizer = new ProjectOptimizer(this.app, wizardState);
		const status = await this.optimizer.getStatus();

		optimizationGroup.addSetting(setting => {
			this.gitSetting = setting;
			this.updateGitSetting(status.gitIgnoreStatus);
		});

		optimizationGroup.addSetting(setting => {
			this.viteSetting = setting;
			this.updateViteSetting(status.viteIgnoreStatus);
		});

		if (status.gitHooksStatus !== 'none') {
			optimizationGroup.addSetting(setting => {
				this.hooksSetting = setting;
				this.updateHooksSetting(status.gitHooksStatus);
			});
		}

		if (status.githubAutomationStatus !== 'none') {
			optimizationGroup.addSetting(setting => {
				this.workflowsSetting = setting;
				this.updateWorkflowsSetting(status.githubAutomationStatus, status.githubAutomationFiles);
			});
		}
	}

	private updateGitSetting(status: 'configured' | 'not-configured') {
		this.gitSetting.setName('Ignore in Git')
			.setDesc('Add workspace files to Git ignore')
			.clear(); // Clear existing buttons and status

		this.gitSetting.addButton(button => {
			button.setButtonText(status === 'configured' ? 'Re-configure' : 'Configure')
				.onClick(async () => {
					try {
						const success = await this.optimizer.configureGitIgnore();
						if (success) {
							this.plugin.settings.ignoreConfig.gitIgnoreConfigured = true;
							await this.plugin.saveSettings();
							new Notice('Git ignore updated');
						} else {
							new Notice('Could not configure Git ignore: project root not detected');
						}
						const newStatus = await this.optimizer.getStatus();
						this.updateGitSetting(newStatus.gitIgnoreStatus);
					} catch (error) {
						new Notice(`Failed to update Git ignore: ${error instanceof Error ? error.message : String(error)}`);
					}
				});
		});
		this.optimizer.renderStatus(this.gitSetting.controlEl, status);
	}

	private updateViteSetting(status: 'configured' | 'not-configured') {
		this.viteSetting.setName('Ignore workspace and Home Base folders in Vite')
			.setDesc('Configure Vite to ignore Obsidian and Home Base folders.')
			.clear(); // Clear existing buttons and status

		this.viteSetting.addButton(button => {
			button.setButtonText(status === 'configured' ? 'Re-configure' : 'Configure')
				.onClick(async () => {
					try {
						const success = await this.optimizer.configureViteIgnore();
						if (success) {
							this.plugin.settings.ignoreConfig.viteIgnoreConfigured = true;
							await this.plugin.saveSettings();
							new Notice('Vite optimization applied');
						} else {
							new Notice('Could not configure Vite: project root not detected');
						}
						const newStatus = await this.optimizer.getStatus();
						this.updateViteSetting(newStatus.viteIgnoreStatus);
					} catch (error) {
						new Notice(`Failed to update Vite config: ${error instanceof Error ? error.message : String(error)}`);
					}
				});
		});
		this.optimizer.renderStatus(this.viteSetting.controlEl, status);
	}

	private updateHooksSetting(status: 'detected' | 'neutralized' | 'none') {
		this.hooksSetting.setName('Neutralize developer git hooks')
			.setDesc('This project has git hooks (like husky or commitlint) that can block publishing from Obsidian. Disable so commits can happen easily from Obsidian.')
			.clear();

		if (status === 'detected') {
			this.hooksSetting.addButton(button => {
				button.setButtonText('Neutralize')
					.setCta()
					.onClick(async () => {
						try {
							this.optimizer.neutralizeGitHooks();
							new Notice('Git hooks neutralized');
							const newStatus = await this.optimizer.getStatus();
							this.updateHooksSetting(newStatus.gitHooksStatus);
						} catch (error) {
							new Notice(`Failed to neutralize git hooks: ${error instanceof Error ? error.message : String(error)}`);
						}
					});
			});
		}

		this.optimizer.renderStatus(this.hooksSetting.controlEl, status === 'neutralized' ? 'configured' : 'not-configured');
	}

	private updateWorkflowsSetting(status: 'detected' | 'removed' | 'none', files: string[]) {
		const basenames = files.map((p) => p.replace(/\\/g, '/').split('/').pop()).filter(Boolean) as string[];
		const fileList = basenames.length > 0 ? basenames.join(', ') : 'dependabot.yml';

		this.workflowsSetting
			.setName('Remove Dependabot config')
			.setDesc(
				`This project ships a Dependabot config (${fileList}), which auto-creates ` +
				`dependency-bump pull requests as soon as the repo is on GitHub. Removing it gives ` +
				`you an empty PR list. GitHub Actions workflows are left in place, since they can be ` +
				`genuine features (like media optimization); push them with a PAT that has the ` +
				`"workflow" scope, which the token link in the Git step pre-selects for you.`
			)
			.clear();

		if (status === 'detected') {
			this.workflowsSetting.addButton(button => {
				button.setButtonText('Remove')
					.setWarning()
					.onClick(async () => {
						try {
							const removed = this.optimizer.removeGithubAutomation();
							new Notice(`Removed Dependabot config (${removed} file${removed === 1 ? '' : 's'})`);
							const newStatus = await this.optimizer.getStatus();
							this.updateWorkflowsSetting(newStatus.githubAutomationStatus, newStatus.githubAutomationFiles);
						} catch (error) {
							new Notice(`Failed to remove Dependabot config: ${error instanceof Error ? error.message : String(error)}`);
						}
					});
			});
		}

		this.optimizer.renderStatus(this.workflowsSetting.controlEl, status === 'detected' ? 'not-configured' : 'configured');
	}
}
