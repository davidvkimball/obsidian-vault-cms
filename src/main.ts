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

		// Migrate absolute projectRoot to vault-relative for portability
		if (this.settings.projectRoot && path.isAbsolute(this.settings.projectRoot)) {
			const { getVaultPath } = await import('./utils/VaultPathHelper');
			const vaultPath = getVaultPath(this.app);
			if (vaultPath) {
				const relativePath = path.relative(vaultPath, this.settings.projectRoot).split(path.sep).join('/') || '.';
				console.debug(`[Vault CMS] Migrating absolute projectRoot to relative: ${this.settings.projectRoot} -> ${relativePath}`);
				this.settings.projectRoot = relativePath;
				// Also migrate configFilePath if absolute
				if (this.settings.configFilePath && path.isAbsolute(this.settings.configFilePath)) {
					const relativeConfig = path.relative(vaultPath, this.settings.configFilePath).split(path.sep).join('/');
					console.debug(`[Vault CMS] Migrating absolute configFilePath to relative: ${this.settings.configFilePath} -> ${relativeConfig}`);
					this.settings.configFilePath = relativeConfig;
				}
				await this.saveSettings();
			}
		}

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Open wizard on startup if configured.
		//
		// On first vault open, Obsidian's "Trust author and enable plugins" flow
		// often leaves the Settings panel mounted (typically on Community Plugins).
		// Settings is a top-level overlay that renders ABOVE Modals — so if the
		// wizard opens while Settings is up, the wizard is invisible to the user.
		//
		// Two mitigations applied together:
		//   1. Wait 3s instead of 2 — past most of Obsidian's startup auto-opens.
		//   2. Close the Settings panel if it's currently open before opening the
		//      wizard, so the wizard becomes the topmost overlay.
		if (this.settings.runWizardOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				this.startupTimeoutId = window.setTimeout(() => {
					void (async () => {
						// Reload settings to check if user disabled the setting
						await this.loadSettings();
						if (!this.settings.runWizardOnStartup) return;

						this.closeSettingsPanelIfOpen();
						const wizard = new SetupWizardModal(this.app, undefined, this);
						wizard.open();
					})();
				}, 3000);
			});
		}
	}

	onunload() {
		if (this.startupTimeoutId) {
			window.clearTimeout(this.startupTimeoutId);
		}
	}

	/**
	 * If Obsidian's Settings panel is currently open, close it. Used right
	 * before opening the wizard on startup so the wizard isn't hidden behind
	 * the post-trust Settings overlay.
	 *
	 * Settings is exposed on the (untyped) `app.setting` object. Failing to
	 * find or close it is non-fatal — worst case the wizard renders behind
	 * Settings and the user can close Settings manually.
	 */
	private closeSettingsPanelIfOpen() {
		try {
			const setting = (this.app as any).setting;
			if (!setting) return;

			// Heuristic: the settings overlay's container is mounted in the DOM
			// while the panel is visible. `containerEl` and a visible
			// `.modal-container.mod-settings` both indicate it's open.
			const isOpen =
				(setting.containerEl && setting.containerEl.parentElement) ||
				document.body.querySelector('.modal-container.mod-settings');

			if (isOpen && typeof setting.close === 'function') {
				setting.close();
				console.debug('VaultCMS: Closed Settings panel before opening wizard');
			}
		} catch (e) {
			console.debug('VaultCMS: closeSettingsPanelIfOpen failed (non-fatal):', e);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VaultCMSSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Public API: Resolve an absolute image path (e.g. /images/blog/1.jpg)
	 * against the Astro project's public/ folder.
	 * Returns a file:// resource URL if the file exists, null otherwise.
	 * Other plugins (Image Manager, Bases CMS) can call this via:
	 *   app.plugins.plugins['vault-cms']?.resolvePublicPath('/images/blog/1.jpg')
	 */
	resolvePublicPath(absolutePath: string): string | null {
		if (!this.settings.resolvePublicImages || !this.settings.projectRoot) return null;
		if (!absolutePath.startsWith('/')) return null;

		try {
			const fs = require('fs') as typeof import('fs');
			const pathModule = require('path') as typeof import('path');
			const { Platform } = require('obsidian') as typeof import('obsidian');

			const adapter = this.app.vault.adapter as unknown as { basePath?: string; path?: string };
			const vaultPath = String(adapter.basePath || adapter.path || '');
			if (!vaultPath) return null;

			const projectRoot = pathModule.resolve(vaultPath, this.settings.projectRoot);
			const relativePath = absolutePath.slice(1); // Remove leading /

			// Try multiple common asset locations
			const candidates = [
				pathModule.join(projectRoot, 'public', relativePath),
				pathModule.join(projectRoot, 'src', 'assets', relativePath),
				pathModule.join(projectRoot, 'static', relativePath),
				pathModule.join(projectRoot, 'assets', relativePath),
			];

			for (const candidate of candidates) {
				if (fs.existsSync(candidate)) {
					return Platform.resourcePathPrefix + candidate.replace(/\\/g, '/');
				}
			}

			return null;
		} catch {
			return null;
		}
	}
}

