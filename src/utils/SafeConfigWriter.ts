import { App, Notice } from 'obsidian';

/**
 * Utility for safely reading and writing plugin configuration files
 * with backup creation, JSON validation, and error handling.
 */
export class SafeConfigWriter {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Validates that a value is a valid JSON object
	 */
	private validateJSON(data: unknown): boolean {
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			return false;
		}

		try {
			// Try to stringify and parse to ensure it's valid JSON
			JSON.parse(JSON.stringify(data));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Safely reads a plugin's data.json file via the DataAdapter.
	 *
	 * IMPORTANT: This MUST use `app.vault.adapter` (filesystem) rather than the
	 * Vault API. `vault.getAbstractFileByPath()` does NOT consistently track
	 * paths under `.obsidian/`, so it returns `null` for plugin data files
	 * that exist on disk. If `mergeConfig` then reads via the Vault API and
	 * gets `null`, it'll merge updates into `{}` and overwrite the entire
	 * existing data.json with just the new keys — silently wiping every
	 * other setting (commit message, status bar prefs, etc.).
	 *
	 * Returns `null` only when the file truly doesn't exist or fails to parse.
	 */
	async readConfig(pluginId: string): Promise<Record<string, unknown> | null> {
		const configPath = `${this.app.vault.configDir}/plugins/${pluginId}/data.json`;
		const adapter = this.app.vault.adapter;

		try {
			if (!(await adapter.exists(configPath))) {
				console.debug(`SafeConfigWriter: Config file not found for ${pluginId}`);
				return null;
			}
			const content = await adapter.read(configPath);
			const parsed = JSON.parse(content) as unknown;

			if (!this.validateJSON(parsed)) {
				console.error(`SafeConfigWriter: Invalid JSON structure in ${pluginId} config`);
				return null;
			}

			return parsed as Record<string, unknown>;
		} catch (error: unknown) {
			console.error(`SafeConfigWriter: Failed to read/parse config for ${pluginId}:`, error);
			return null;
		}
	}

	/**
	 * Safely writes to a plugin's data.json file with backup and validation
	 */
	async writeConfig(
		pluginId: string,
		data: Record<string, unknown>,
		options: { showNotice?: boolean; createBackup?: boolean } = {}
	): Promise<boolean> {
		const { showNotice = true, createBackup = true } = options;

		// Validate the data structure
		if (!this.validateJSON(data)) {
			const message = `Invalid configuration data for ${pluginId}`;
			console.error(`SafeConfigWriter: ${message}`);
			if (showNotice) {
				new Notice(`Failed to save ${pluginId} settings: Invalid data`);
			}
			return false;
		}

		const configPath = `${this.app.vault.configDir}/plugins/${pluginId}/data.json`;
		const pluginDir = `${this.app.vault.configDir}/plugins/${pluginId}`;
		const adapter = this.app.vault.adapter;

		// Use the DataAdapter throughout for `.obsidian/` paths — the Vault API
		// (`getAbstractFileByPath`, `createFolder`, `create`, `modify`) does NOT
		// reliably track paths under `.obsidian/`, leading to:
		//   - "Folder/File already exists" errors when items are present on disk
		//     but missing from the vault index
		//   - misleading null reads that cause `mergeConfig` to overwrite all
		//     existing settings instead of merging them
		// The adapter operates on the actual filesystem and avoids both classes
		// of bug.
		try {
			const exists = await adapter.exists(configPath);

			if (exists) {
				// Best-effort backup before overwriting. We can't use
				// `vault.create` because the .obsidian path isn't tracked, so
				// write the backup via the adapter too.
				if (createBackup) {
					try {
						const original = await adapter.read(configPath);
						const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
						const backupPath = `${pluginDir}/data.json.backup-${timestamp}`;
						await adapter.write(backupPath, original);
						console.debug(`SafeConfigWriter: Created backup at ${backupPath}`);
					} catch (backupError) {
						console.warn(`SafeConfigWriter: Backup failed for ${pluginId} (non-fatal):`, backupError);
					}
				}
			} else {
				// Ensure the plugin directory exists. `mkdir` is idempotent
				// against vault-indexed directories but throws "already exists"
				// when the directory is on disk but not indexed — swallow that.
				try {
					if (!(await adapter.exists(pluginDir))) {
						await adapter.mkdir(pluginDir);
					}
				} catch (folderError) {
					const folderMsg = folderError instanceof Error ? folderError.message : String(folderError);
					if (!/already exists/i.test(folderMsg)) throw folderError;
				}
			}

			const content = JSON.stringify(data, null, 2);
			await adapter.write(configPath, content);
			console.debug(`SafeConfigWriter: Successfully ${exists ? 'updated' : 'created'} ${pluginId} config via adapter`);

			return true;
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`SafeConfigWriter: Failed to write config for ${pluginId}:`, error);

			if (showNotice) {
				new Notice(`Failed to save ${pluginId} settings: ${message}`);
			}

			return false;
		}
	}

	/**
	 * Safely merges new settings into existing plugin config
	 */
	async mergeConfig(
		pluginId: string,
		updates: Record<string, unknown>,
		options: { showNotice?: boolean; createBackup?: boolean } = {}
	): Promise<boolean> {
		const existingConfig = await this.readConfig(pluginId) || {};
		const mergedConfig = { ...existingConfig, ...updates };
		return this.writeConfig(pluginId, mergedConfig, options);
	}
}
