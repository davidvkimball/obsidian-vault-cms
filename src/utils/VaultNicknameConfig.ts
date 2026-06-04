import { App } from 'obsidian';

interface VaultNicknamePlugin {
	settings?: Record<string, unknown>;
	sharedSettings?: { nickname?: string;[key: string]: unknown };
	saveSettings?: () => Promise<void>;
	refreshVaultDisplayName?: () => void;
}

interface PluginsApi {
	plugins?: { plugins?: Record<string, VaultNicknamePlugin> };
}

/**
 * Reads and writes the vault nickname used by the Vault Nickname plugin.
 *
 * Important: the nickname does NOT live in the plugin's data.json. The plugin
 * keeps two separate stores:
 *   - data.json        -> { overrideAppTitle, enableBackwardsCompatibilty }
 *   - data-shared.json -> { nickname }   (the value its settings tab edits)
 *
 * So we update data-shared.json. When the plugin is loaded we go through its
 * own saveSettings() so it also refreshes the vault switcher and window title
 * and writes the legacy file when backwards compatibility is enabled. A blank
 * value is stored as an empty string, which makes the plugin fall back to the
 * vault's folder name (matching what its own settings field does when cleared).
 */
export class VaultNicknameConfigurator {
	private app: App;
	private readonly pluginId = 'vault-nickname';
	private readonly sharedFileName = 'data-shared.json';

	constructor(app: App) {
		this.app = app;
	}

	/** The currently saved nickname (empty string when none is set). */
	async getNickname(): Promise<string> {
		const live = this.livePlugin();
		if (live?.sharedSettings && typeof live.sharedSettings.nickname === 'string') {
			return live.sharedSettings.nickname;
		}
		const data = await this.readShared();
		const nickname = data['nickname'];
		return typeof nickname === 'string' ? nickname : '';
	}

	/** Save the nickname; a blank value falls back to the vault's folder name. */
	async saveNickname(nickname: string): Promise<void> {
		const value = nickname.trim();
		const live = this.livePlugin();

		// Preferred path: the plugin is loaded. Update its in-memory shared
		// settings and let it persist + refresh the UI through its own logic
		// (writes data-shared.json, refreshes the vault switcher and window
		// title, and writes the legacy file when backwards compatibility is on).
		if (live?.sharedSettings && typeof live.saveSettings === 'function') {
			live.sharedSettings.nickname = value;
			// Remove a stray nickname key that an earlier version of this
			// configurator wrote into data.json by mistake.
			if (live.settings && 'nickname' in live.settings) {
				delete live.settings['nickname'];
			}
			await live.saveSettings();
			return;
		}

		// Fallback: the plugin isn't loaded. Write the shared settings file
		// directly so the value is applied the next time the plugin loads.
		const shared = await this.readShared();
		shared['nickname'] = value;
		await this.writeShared(shared);
		await this.cleanupStrayDataJsonKey();
	}

	private livePlugin(): VaultNicknamePlugin | undefined {
		return (this.app as unknown as PluginsApi).plugins?.plugins?.[this.pluginId];
	}

	private pluginDir(): string {
		return `${this.app.vault.configDir}/plugins/${this.pluginId}`;
	}

	private sharedPath(): string {
		return `${this.pluginDir()}/${this.sharedFileName}`;
	}

	private async readShared(): Promise<Record<string, unknown>> {
		return this.readJson(this.sharedPath());
	}

	private async writeShared(data: Record<string, unknown>): Promise<void> {
		const adapter = this.app.vault.adapter;
		const dir = this.pluginDir();
		if (!(await adapter.exists(dir))) {
			await adapter.mkdir(dir);
		}
		await adapter.write(this.sharedPath(), JSON.stringify(data, null, 2));
	}

	/** Remove the nickname key an earlier version mistakenly wrote to data.json. */
	private async cleanupStrayDataJsonKey(): Promise<void> {
		const path = `${this.pluginDir()}/data.json`;
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(path))) {
			return;
		}
		const data = await this.readJson(path);
		if ('nickname' in data) {
			delete data['nickname'];
			await adapter.write(path, JSON.stringify(data, null, 2));
		}
	}

	private async readJson(path: string): Promise<Record<string, unknown>> {
		const adapter = this.app.vault.adapter;
		if (await adapter.exists(path)) {
			try {
				return JSON.parse(await adapter.read(path)) as Record<string, unknown>;
			} catch (error) {
				console.warn('VaultNicknameConfig: could not parse', path, error);
			}
		}
		return {};
	}
}
