import { App, requestUrl, Notice } from 'obsidian';
import { ApplyPresetModal } from '../ui/ApplyPresetModal';

export interface GitHubFile {
	path: string;
	type: 'file' | 'dir';
	download_url: string | null;
	url: string;
}

interface ObsidianAppWithCommands extends App {
	commands: {
		executeCommandById: (id: string) => void;
	};
}

export class PresetManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async applyPreset(repo: string, presetName: string): Promise<void> {
		if (!repo || !presetName) {
			new Notice('Please configure both repository and preset name in settings.');
			return;
		}

		try {
			new Notice(`Fetching preset "${presetName}" from ${repo}...`);
			const files = await this.fetchPresetFilesRecursive(repo, presetName);
			
			if (files.length === 0) {
				new Notice(`No files found for preset "${presetName}" in repo ${repo}.`);
				return;
			}

			new Notice('Backing up configuration folder...');
			const backupPath = await this.backupObsidianFolder();

			new Notice(`Downloading and applying ${files.length} files...`);
			let successCount = 0;
			for (const file of files) {
				if (file.download_url) {
					// Map path: remove "presetName/" prefix
					const relativePath = file.path.substring(presetName.length + 1);
					try {
						await this.downloadAndWriteFile(file.download_url, relativePath);
						successCount++;
					} catch (e) {
						console.error(`Failed to download ${relativePath}:`, e);
					}
				}
			}

			new Notice(`Applied ${successCount} files.`);

			new ApplyPresetModal(this.app, backupPath, (deleteBackup) => {
				void (async () => {
					if (deleteBackup) {
						try {
							await this.app.vault.adapter.rmdir(backupPath, true);
							new Notice('Backup deleted.');
						} catch (e) {
							console.error('Failed to delete backup:', e);
							new Notice('Failed to delete backup folder. You may need to remove it manually.');
						}
					}
					
					// Trigger reload
					const appWithCommands = this.app as ObsidianAppWithCommands;
					if (appWithCommands.commands && typeof appWithCommands.commands.executeCommandById === 'function') {
						appWithCommands.commands.executeCommandById('app:reload');
					}
				})();
			}).open();

		} catch (error) {
			console.error('Failed to apply preset:', error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to apply preset: ${message}`);
		}
	}

	private async fetchPresetFilesRecursive(repo: string, path: string): Promise<GitHubFile[]> {
		const url = `https://api.github.com/repos/${repo}/contents/${path}`;
		
		try {
			const response = await requestUrl({ url });
			
			if (response.status !== 200) {
				throw new Error(`GitHub API returned status ${response.status}`);
			}

			const items = response.json as GitHubFile[];
			let allFiles: GitHubFile[] = [];

			for (const item of items) {
				if (item.type === 'dir') {
					const subFiles = await this.fetchPresetFilesRecursive(repo, item.path);
					allFiles = allFiles.concat(subFiles);
				} else if (item.type === 'file') {
					allFiles.push(item);
				}
			}

			return allFiles;
		} catch (e: unknown) {
			if (e && typeof e === 'object' && 'status' in e && e.status === 404) {
				throw new Error(`Preset folder "${path}" not found in repository "${repo}".`);
			}
			throw e;
		}
	}

	private async backupObsidianFolder(): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Math.floor(Date.now() / 1000);
		const configDir = this.app.vault.configDir;
		const backupPath = `${configDir}_backup_${timestamp}`;
		const adapter = this.app.vault.adapter;
		
		// Create backup directory
		await adapter.mkdir(backupPath);
		
		// Copy configuration directory recursively
		await this.copyRecursive(configDir, `${backupPath}/${configDir}`);
		
		return backupPath;
	}

	private async copyRecursive(source: string, destination: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		
		if (!(await adapter.exists(source))) {
			return;
		}

		const stats = await adapter.list(source);
		
		if (!(await adapter.exists(destination))) {
			await adapter.mkdir(destination);
		}
		
		// Copy files
		for (const file of stats.files) {
			const fileName = file.split('/').pop();
			if (fileName) {
				const destFile = destination + '/' + fileName;
				try {
					await adapter.copy(file, destFile);
				} catch (e) {
					console.error(`Failed to copy file ${file} to ${destFile}:`, e);
				}
			}
		}
		
		// Recurse into folders
		for (const folder of stats.folders) {
			const folderName = folder.split('/').pop();
			if (folderName) {
				const destFolder = destination + '/' + folderName;
				await this.copyRecursive(folder, destFolder);
			}
		}
	}

	private async downloadAndWriteFile(url: string, path: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const response = await requestUrl({ url });
		
		if (response.status !== 200) {
			throw new Error(`Failed to download ${path} from ${url}`);
		}

		// Ensure parent directory exists
		const parts = path.split('/');
		if (parts.length > 1) {
			for (let i = 1; i < parts.length; i++) {
				const dir = parts.slice(0, i).join('/');
				if (!(await adapter.exists(dir))) {
					await adapter.mkdir(dir);
				}
			}
		}

		// Write the file (using arrayBuffer to handle binary files safely)
		await adapter.writeBinary(path, response.arrayBuffer);
	}
}
