import { Plugin, Notice } from 'obsidian';
import { VaultCMSSettings, DEFAULT_SETTINGS } from './settings';
import { SettingsTab } from './ui/SettingsTab';
import { SetupWizardModal } from './ui/SetupWizardModal';
import { registerCommands } from './commands';
import { createApi, type VaultCMSAPI } from './api';
import * as path from 'path';

export default class VaultCMSPlugin extends Plugin {
	settings: VaultCMSSettings;
	/**
	 * Public API for other plugins. See src/api/public/vault-cms.d.ts for the
	 * consumer surface; that file is the canonical reference and is meant to
	 * be copied into downstream plugin projects for type-safe access.
	 *
	 * Access pattern: `app.plugins.plugins['vault-cms']?.api as VaultCMSAPI`.
	 */
	public api!: VaultCMSAPI;
	private startupTimeoutId?: number;

	async onload() {
		await this.loadSettings();

		// Build the public API after settings load so it can read projectRoot.
		this.api = createApi(this);

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
		// often leaves the Settings panel mounted (or pops it open AFTER the
		// wizard opens). Settings is a top-level overlay that renders ABOVE
		// Modals — so any time it shows up, the wizard becomes invisible.
		//
		// We keep the original 2s delay (don't punish startup with extra waiting),
		// and instead install a MutationObserver while the wizard is open: any
		// time Settings appears, we immediately close it. This is robust against
		// settings popping up before, during, or after the wizard launches.
		if (this.settings.runWizardOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				this.startupTimeoutId = window.setTimeout(() => {
					void (async () => {
						// Reload settings to check if user disabled the setting
						await this.loadSettings();
						if (!this.settings.runWizardOnStartup) return;

						this.closeSettingsPanelIfOpen();
						const wizard = new SetupWizardModal(this.app, undefined, this);
						this.guardWizardZOrder(wizard);
						wizard.open();
					})();
				}, 2000);
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
	 */
	private closeSettingsPanelIfOpen() {
		try {
			const setting = (this.app as any).setting;
			if (!setting) return;

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

	/**
	 * Keep the wizard the topmost overlay for as long as it's open. Obsidian's
	 * Settings panel can pop up at any time during startup (post-"Trust author"
	 * flow, other plugins triggering it, etc.) and renders above Modals.
	 *
	 * Strategy: observe document.body for a `.modal-container.mod-settings`
	 * being added, and close it the moment it appears while the wizard is up.
	 * The observer self-disconnects when the wizard's contentEl detaches, when
	 * the wizard's onClose runs, or after 60 seconds — whichever comes first.
	 *
	 * This is robust against the Settings panel appearing before, during, or
	 * after the wizard opens.
	 */
	private guardWizardZOrder(wizard: SetupWizardModal) {
		let stopped = false;

		const closeSettingsIfOpen = () => {
			const visible = document.body.querySelector('.modal-container.mod-settings');
			if (!visible) return;
			const setting = (this.app as any).setting;
			if (setting && typeof setting.close === 'function') {
				setting.close();
				console.debug('VaultCMS: closed Settings overlay covering wizard');
			}
		};

		const observer = new MutationObserver(() => {
			if (stopped) return;
			// If the wizard has detached from the DOM, we're done.
			if (!wizard.contentEl || !wizard.contentEl.isConnected) {
				stop();
				return;
			}
			closeSettingsIfOpen();
		});

		const stop = () => {
			if (stopped) return;
			stopped = true;
			observer.disconnect();
		};

		try {
			observer.observe(document.body, { childList: true });
		} catch (e) {
			console.debug('VaultCMS: guardWizardZOrder observe failed (non-fatal):', e);
			return;
		}

		// Also catch the case where Settings is already up at the moment we attach.
		closeSettingsIfOpen();

		// Belt-and-suspenders cleanup so a stuck wizard doesn't leak the observer.
		window.setTimeout(stop, 60_000);

		// Hook into the wizard's close so we stop immediately when the user
		// finishes / cancels the wizard, rather than waiting for the timeout.
		const originalOnClose = wizard.onClose.bind(wizard);
		wizard.onClose = () => {
			stop();
			return originalOnClose();
		};
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VaultCMSSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Resolve an absolute image path (e.g. /images/blog/1.jpg) against the
	 * project's image folders. Tries, in order: public/, src/assets/,
	 * static/, assets/ (relative to the configured project root). This means
	 * a path like /images/foo.jpg works whether the framework serves it raw
	 * from public/ OR optimizes it from a build-pipeline dir like Astro's
	 * src/assets/. Returns a file:// resource URL if found, null otherwise.
	 *
	 * Preserved at the top level for back-compat with consumers written
	 * before the namespaced API existed (Image Manager, Bases CMS). New
	 * consumers should prefer `api.assets.resolvePublicPath()` for the
	 * type-safe surface documented in src/api/public/vault-cms.d.ts.
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

