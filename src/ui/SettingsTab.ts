import { App, PluginSettingTab, Notice, Setting , SettingGroup} from 'obsidian';
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
	private optimizer: ProjectOptimizer;

	constructor(app: App, plugin: VaultCMSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
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

		generalGroup.addSetting((setting: any) => {
			setting.setName('Open setup wizard')
				.setDesc('Launch the setup wizard')
				.addButton((button: any) => {
					button
						.setButtonText('Open wizard')
						.setCta()
						.onClick(() => {
							new SetupWizardModal(this.app, this.plugin.settings, this.plugin).open();
						});
				});
		});

		generalGroup.addSetting((setting: any) => {
			setting.setName('Run wizard on startup')
				.setDesc('Automatically open the wizard when the plugin loads')
				.addToggle((toggle: any) => {
					toggle
						.setValue(this.plugin.settings.runWizardOnStartup)
						.onChange(async (value: any) => {
							this.plugin.settings.runWizardOnStartup = value;
							await this.plugin.saveSettings();
						});
				});
		});

		generalGroup.addSetting((setting: any) => {
			setting.setName('Health check')
				.setDesc('Check plugin installation and configuration status')
				.addButton((button: any) => {
					button
						.setButtonText('Run health check')
						.onClick(() => {
							new HealthCheckModal(this.app, this.plugin).open();
						});
				});
		});

		// Preset configuration group
		const presetGroup = new SettingGroup(this.contentEl).setHeading('Preset configuration');

		presetGroup.addSetting((setting: any) => {
			setting.setName('Preset folder name')
				.setDesc('Folder name in the repository')
				.addText((text: any) => {
					text
						.setPlaceholder('Example: starlight')
						.setValue(this.plugin.settings.presetName)
						.onChange(async (value: any) => {
							this.plugin.settings.presetName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting((setting: any) => {
			setting.setName('Presets repository')
				.setDesc('GitHub repository containing the presets')
				.addText((text: any) => {
					text
						.setPlaceholder('Example: owner/repo')
						.setValue(this.plugin.settings.presetsRepo)
						.onChange(async (value: any) => {
							this.plugin.settings.presetsRepo = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting((setting: any) => {
			setting.setName('Download and apply preset')
				.setDesc('Download the specified preset and apply it to your vault')
				.addButton((button: any) => {
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
				const projectRoot = this.plugin.settings.projectRoot;
				const isRepo = await GitManager.isRepo(projectRoot);
				const remoteUrl = isRepo ? await GitManager.getRemoteUrl(projectRoot) : null;
				isFullyConfigured = isRepo && !!remoteUrl;

				gitGroup.addSetting((setting: any) => {
					setting.setName('Local repository status')
						.setDesc(isRepo ? 'Git is initialized at project root.' : 'Git is NOT initialized at project root.');

					const statusIcon = setting.controlEl.createSpan({
						cls: isRepo ? 'git-status-icon-ok' : 'git-status-icon-warn',
						attr: { style: `margin-left: 10px; color: ${isRepo ? 'var(--text-success)' : 'var(--text-warning)'};` }
					});
					statusIcon.setText(isRepo ? '✓ Detected' : '⚠ Missing');
				});

				gitGroup.addSetting((setting: any) => {
					setting.setName('Project root path')
						.setDesc('Direct path being checked for Git')
						.addText((text: any) => {
							text.setValue(projectRoot)
								.setDisabled(true);
						});
				});

				if (remoteUrl) {
					gitGroup.addSetting((setting: any) => {
						setting.setName('Remote URL')
							.setDesc('Connected GitHub repository')
							.addText((text: any) => {
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
			gitGroup.addSetting((setting: any) => {
				setting.setName('Manage Git integration')
					.setDesc('Initialize repository, connect to GitHub, or update credentials.')
					.addButton((button: any) => {
						button.setButtonText('Setup / Update Git...')
							.onClick(() => {
								const modal = new SetupWizardModal(this.app, { currentStep: 11 }, this.plugin);
								modal.open();
							});
					});
			});
		}

		// Project optimization group
		const optimizationGroup = new SettingGroup(this.contentEl).setHeading('Project optimization (optional)');

		// Check if project root is configured
		if (!this.plugin.settings.projectRoot) {
			optimizationGroup.addSetting((setting: any) => {
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

		optimizationGroup.addSetting((setting: any) => {
			this.gitSetting = setting;
			this.updateGitSetting(status.gitIgnoreStatus);
		});

		optimizationGroup.addSetting((setting: any) => {
			this.viteSetting = setting;
			this.updateViteSetting(status.viteIgnoreStatus);
		});
	}

	private updateGitSetting(status: 'configured' | 'not-configured') {
		this.gitSetting.setName('Ignore in Git')
			.setDesc('Add workspace files to Git ignore')
			.clear(); // Clear existing buttons and status

		this.gitSetting.addButton((button: any) => {
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

		this.viteSetting.addButton((button: any) => {
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
}
