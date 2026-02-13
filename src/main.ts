import { Plugin, Notice } from 'obsidian';
import { VaultCMSSettings, DEFAULT_SETTINGS } from './settings';
import { SettingsTab } from './ui/SettingsTab';
import { SetupWizardModal } from './ui/SetupWizardModal';
import { registerCommands } from './commands';
import * as path from 'path';

export default class VaultCMSPlugin extends Plugin {
	settings: VaultCMSSettings;
	private startupTimeoutId?: number;

	async onload() {
		await this.loadSettings();

		// Repair relative projectRoot to absolute for reliability
		if (this.settings.projectRoot && !path.isAbsolute(this.settings.projectRoot)) {
			const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
			const vaultPath = adapter.basePath || adapter.path;
			if (vaultPath) {
				const absolutePath = path.resolve(vaultPath, this.settings.projectRoot);
				console.debug(`[Vault CMS] Repairing relative projectRoot: ${this.settings.projectRoot} -> ${absolutePath}`);
				this.settings.projectRoot = absolutePath;
				await this.saveSettings();
			}
		}

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Open wizard on startup if configured
		if (this.settings.runWizardOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				// Delay the wizard to let Obsidian fully load (like astro-modular-settings)
				this.startupTimeoutId = window.setTimeout(() => {
					void (async () => {
						// Reload settings to check if user disabled the setting
						await this.loadSettings();
						if (this.settings.runWizardOnStartup) {
							const wizard = new SetupWizardModal(this.app, undefined, this);
							wizard.open();
						}
					})();
				}, 2000); // 2-second delay
			});
		}
	}

	onunload() {
		if (this.startupTimeoutId) {
			window.clearTimeout(this.startupTimeoutId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VaultCMSSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

