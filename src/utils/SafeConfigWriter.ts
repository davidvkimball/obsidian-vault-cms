import { App, Notice, TFile } from 'obsidian';

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
	 * Creates a backup of a plugin's data.json file
	 */
	private async createBackup(pluginId: string, originalFile: TFile): Promise<void> {
		try {
			const content = await this.app.vault.read(originalFile);
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = `${this.app.vault.configDir}/plugins/${pluginId}/data.json.backup-${timestamp}`;

			await this.app.vault.create(backupPath, content);
			console.debug(`SafeConfigWriter: Created backup at ${backupPath}`);
		} catch (error: unknown) {
			console.warn(`SafeConfigWriter: Failed to create backup for ${pluginId}:`, error);
			// Don't throw - backup failure shouldn't block the operation
		}
	}

	/**
	 * Safely reads a plugin's data.json file
	 */
	async readConfig(pluginId: string): Promise<Record<string, unknown> | null> {
		const configPath = `${this.app.vault.configDir}/plugins/${pluginId}/data.json`;
		const dataFile = this.app.vault.getAbstractFileByPath(configPath);

		if (!dataFile || !(dataFile instanceof TFile)) {
			console.debug(`SafeConfigWriter: Config file not found for ${pluginId}`);
			return null;
		}

		try {
			const content = await this.app.vault.read(dataFile);
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

		try {
			// Check if file exists
			const dataFile = this.app.vault.getAbstractFileByPath(configPath);

			if (dataFile && dataFile instanceof TFile) {
				// Create backup before modifying
				if (createBackup) {
					await this.createBackup(pluginId, dataFile);
				}

				// Modify existing file
				const content = JSON.stringify(data, null, 2);
				await this.app.vault.modify(dataFile, content);
				console.debug(`SafeConfigWriter: Successfully updated ${pluginId} config`);
			} else {
				// Create new file via the DataAdapter rather than the Vault API.
				//
				// Why: Obsidian's vault index does NOT reliably track paths under
				// `.obsidian/` (where plugin configs live). `getAbstractFileByPath`
				// returns `null` for an installed plugin's folder/data.json even
				// when both exist on disk, which sends us down this "create new"
				// branch. The Vault API's `createFolder`/`create` then throw
				// "Folder already exists" / "File already exists" because the
				// items ARE there on disk, just not in the index.
				//
				// The adapter writes directly to the filesystem, and `mkdir` and
				// `write` are both idempotent for the existence cases we care
				// about (mkdir tolerates an existing dir, write overwrites).
				const pluginDir = `${this.app.vault.configDir}/plugins/${pluginId}`;
				const adapter = this.app.vault.adapter;

				try {
					if (!(await adapter.exists(pluginDir))) {
						await adapter.mkdir(pluginDir);
					}
				} catch (folderError) {
					const folderMsg = folderError instanceof Error ? folderError.message : String(folderError);
					if (!/already exists/i.test(folderMsg)) throw folderError;
				}

				const content = JSON.stringify(data, null, 2);
				await adapter.write(configPath, content);
				console.debug(`SafeConfigWriter: Successfully created ${pluginId} config via adapter`);
			}

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
