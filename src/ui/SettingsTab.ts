import { App, PluginSettingTab, Notice, Setting } from 'obsidian';
import VaultCMSPlugin from '../main';
import { SetupWizardModal } from './SetupWizardModal';
import { HealthCheckModal } from './HealthCheckModal';
import { createSettingsGroup } from '../utils/settings-compat';
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
		const generalGroup = createSettingsGroup(this.contentEl, undefined, 'vault-cms');

		generalGroup.addSetting((setting) => {
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

		generalGroup.addSetting((setting) => {
			setting.setName('Run wizard on startup')
				.setDesc('Automatically open the wizard when the plugin loads')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.runWizardOnStartup)
						.onChange(async (value) => {
							this.plugin.settings.runWizardOnStartup = value;
							await this.plugin.saveSettings();
						});
				});
		});

		generalGroup.addSetting((setting) => {
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
		const presetGroup = createSettingsGroup(this.contentEl, 'Preset configuration', 'vault-cms-presets');

		presetGroup.addSetting((setting) => {
			setting.setName('Preset folder name')
				.setDesc('Folder name in the repository')
				.addText(text => {
					text
						.setPlaceholder('Example: starlight')
						.setValue(this.plugin.settings.presetName)
						.onChange(async (value) => {
							this.plugin.settings.presetName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting((setting) => {
			setting.setName('Presets repository')
				.setDesc('GitHub repository containing the presets')
				.addText(text => {
					text
						.setPlaceholder('Example: owner/repo')
						.setValue(this.plugin.settings.presetsRepo)
						.onChange(async (value) => {
							this.plugin.settings.presetsRepo = value;
							await this.plugin.saveSettings();
						});
				});
		});

		presetGroup.addSetting((setting) => {
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

		// Project optimization group
		const optimizationGroup = createSettingsGroup(this.contentEl, 'Project optimization (optional)', 'vault-cms-optimization');

		// Check if project root is configured
		if (!this.plugin.settings.projectRoot) {
			optimizationGroup.addSetting((setting) => {
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

		optimizationGroup.addSetting((setting) => {
			this.gitSetting = setting;
			this.updateGitSetting(status.gitIgnoreStatus);
		});

		optimizationGroup.addSetting((setting) => {
			this.viteSetting = setting;
			this.updateViteSetting(status.viteIgnoreStatus);
		});
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
		this.viteSetting.setName('Ignore in Vite')
			.setDesc('Configure Vite to ignore internal folders')
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
}
