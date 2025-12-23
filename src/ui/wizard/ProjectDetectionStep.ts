import { App, Setting, Notice } from 'obsidian';

// Helper function for setCssProps (may not be in types yet)
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}
// eslint-disable-next-line import/no-nodejs-modules
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules
import * as fs from 'fs';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { ProjectDetector } from '../../utils/ProjectDetector';

export class ProjectDetectionStep extends BaseWizardStep {
	private projectDetector: ProjectDetector;
	private detected: boolean = false;
	private projectRootDisplay: HTMLElement | null = null;
	private configFileDisplay: HTMLElement | null = null;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.projectDetector = new ProjectDetector(app);
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		// Check if we have saved project detection values
		const hasSavedValues = this.state.projectDetection?.projectRoot && this.state.projectDetection?.configFilePath;
		
		if (!hasSavedValues) {
			containerEl.createEl('h2', { text: 'Project detection' });
			containerEl.createEl('p', { 
				// False positive: "Astro" is a proper noun (framework name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Detecting your Astro project structure...' 
			});

			const result = await this.projectDetector.detectProject();
			
			if (result) {
				// Convert absolute paths to relative paths (like browse button does)
				const relativeProjectRoot = this.toRelativePath(result.projectRoot);
				const relativeConfigFilePath = this.toRelativePath(result.configFilePath);
				
				// Initialize state with detected values (converted to relative paths)
				this.state.projectDetection = {
					projectRoot: relativeProjectRoot,
					configFilePath: relativeConfigFilePath,
					vaultLocation: result.vaultLocation
				};
				this.detected = true;
			} else {
				// No detection, show manual selection
				this.detected = false;
			}
		} else {
			// Use saved values
			this.detected = true;
		}
		
		if (this.state.projectDetection && (this.detected || hasSavedValues)) {

			// Add slight delay before showing detected content (like astro-modular-settings)
			await new Promise(resolve => setTimeout(resolve, 500));

			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project detected' });
			containerEl.createEl('p', { 
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Project structure detected successfully. You can modify the paths below if needed, then click "Next" to continue.' 
			});
			
			// Project Root picker (with browse button even when detected)
			const projectRootSetting = new Setting(containerEl)
				.setName('Project root')
				// False positive: "Astro" is a proper noun (framework name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot || 'No folder selected',
				cls: 'vault-cms-path-display'
			});
			setCssProps(this.projectRootDisplay, { color: 'var(--text-normal)' });

			projectRootSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					void (async () => {
						const selectedPath = await this.selectFolder();
						if (selectedPath) {
							this.state.projectDetection!.projectRoot = selectedPath;
							if (this.projectRootDisplay) {
								this.projectRootDisplay.textContent = selectedPath;
								setCssProps(this.projectRootDisplay, { color: 'var(--text-normal)' });
							}
							// Update detected flag if user changes
							this.detected = false;
						}
					})();
				}));

			// Config File picker (with browse button even when detected)
			const configFileSetting = new Setting(containerEl)
				.setName('Config file')
				.setDesc('Select your Astro config file (astro.config.mjs, astro.config.js, src/config.ts, etc.)');

			// Display current selection
			this.configFileDisplay = configFileSetting.descEl.createDiv({
				text: this.state.projectDetection.configFilePath || 'No file selected',
				cls: 'vault-cms-path-display'
			});
			setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });

			configFileSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					void (async () => {
						const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
						const selectedPath = await this.selectConfigFile(defaultPath);
						if (selectedPath) {
							this.state.projectDetection!.configFilePath = selectedPath;
							if (this.configFileDisplay) {
								this.configFileDisplay.textContent = selectedPath;
								setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });
							}
							// Update detected flag if user changes
							this.detected = false;
						}
					})();
				}));
		} else {
			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project detection failed' });
			containerEl.createEl('p', { 
				// False positive: "Astro" is a proper noun (framework name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'Could not detect Astro project structure. Please select your Astro project root and config file manually.' 
			});

			// Initialize state if needed
			if (!this.state.projectDetection) {
				this.state.projectDetection = {
					projectRoot: '',
					configFilePath: '',
					vaultLocation: 'root'
				};
			}

			// Project Root picker
			const projectRootSetting = new Setting(containerEl)
				.setName('Project root')
				// False positive: "Astro" is a proper noun (framework name) and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot || 'No folder selected',
				cls: 'vault-cms-path-display'
			});
			if (this.state.projectDetection.projectRoot) {
				setCssProps(this.projectRootDisplay, { color: 'var(--text-normal)' });
			} else {
				setCssProps(this.projectRootDisplay, { color: 'var(--text-muted)' });
			}

			projectRootSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					void (async () => {
						const selectedPath = await this.selectFolder();
						if (selectedPath) {
							this.state.projectDetection!.projectRoot = selectedPath;
							if (this.projectRootDisplay) {
								this.projectRootDisplay.textContent = selectedPath;
								setCssProps(this.projectRootDisplay, { color: 'var(--text-normal)' });
							}
						}
					})();
				}));

			// Config File picker
			const configFileSetting = new Setting(containerEl)
				.setName('Config file')
				.setDesc('Select your Astro config file (astro.config.mjs, astro.config.js, src/config.ts, etc.)');

			// Display current selection
			this.configFileDisplay = configFileSetting.descEl.createDiv({
				text: this.state.projectDetection.configFilePath || 'No file selected',
				cls: 'vault-cms-path-display'
			});
			if (this.state.projectDetection.configFilePath) {
				setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });
			} else {
				setCssProps(this.configFileDisplay, { color: 'var(--text-muted)' });
			}

			configFileSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					void (async () => {
						const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
						const selectedPath = await this.selectConfigFile(defaultPath);
						if (selectedPath) {
							this.state.projectDetection!.configFilePath = selectedPath;
							if (this.configFileDisplay) {
								this.configFileDisplay.textContent = selectedPath;
								setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });
							}
						}
					})();
				}));
		}
	}

	/**
	 * Open native folder picker dialog
	 */
	private async selectFolder(): Promise<string | null> {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } | null = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
				const electronRemote = require('@electron/remote') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } };
				dialog = electronRemote?.dialog || null;
			} catch {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
					const electron = ((window as { require?: (module: string) => unknown }).require?.('electron') || require('electron')) as { remote?: { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } } };
					dialog = electron?.remote?.dialog || null;
				} catch {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
					const electron = require('electron') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } };
					dialog = electron?.dialog || null;
				} catch {
					// Not available
				}
			}

			if (!dialog || typeof dialog.showOpenDialogSync !== 'function') {
				throw new Error('Electron dialog API not available');
			}

			const vaultPath = this.getVaultPath();
			let defaultPath = this.state.projectDetection?.projectRoot || vaultPath;
			
			// Convert relative path to absolute if needed
			if (defaultPath && !path.isAbsolute(defaultPath)) {
				defaultPath = path.resolve(vaultPath, defaultPath);
			}

			const result = dialog.showOpenDialogSync({
				title: 'Select Astro Project Root Folder',
				defaultPath: defaultPath,
				properties: ['openDirectory']
			});

			if (result && result.length > 0) {
				const absolutePath = path.normalize(result[0]);
				return this.toRelativePath(absolutePath);
			}
		} catch (error: unknown) {
			console.error('Error opening folder picker:', error);
			// Show user-friendly error
			new Notice('Unable to open folder picker. Please ensure you are using Obsidian on desktop.');
		}

		return null;
	}

	/**
	 * Open native file picker dialog for config file
	 */
	private async selectConfigFile(defaultPath?: string): Promise<string | null> {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } | null = null;

		// Method 1: Try @electron/remote (newer Electron versions)
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
			const electronRemote = require('@electron/remote') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } };
			dialog = electronRemote?.dialog || null;
		} catch {
			// Not available, try next method
		}

		// Method 2: Try electron.remote.dialog (older Electron versions)
		if (!dialog) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
				const electron = ((window as { require?: (module: string) => unknown }).require?.('electron') || require('electron')) as { remote?: { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } } };
				dialog = electron?.remote?.dialog || null;
			} catch {
				// Not available, try next method
			}
		}

		// Method 3: Try electron.dialog directly (main process, may not work)
		if (!dialog) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
				const electron = require('electron') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } };
				dialog = electron?.dialog || null;
			} catch {
				// Not available
			}
		}

			if (!dialog || typeof dialog.showOpenDialogSync !== 'function') {
				throw new Error('Electron dialog API not available');
			}

			const vaultPath = this.getVaultPath();
			let startPath = defaultPath || vaultPath;
			
			// If we have a detected config file path, use its directory
			if (!defaultPath && this.state.projectDetection?.configFilePath) {
				const configPath = this.state.projectDetection.configFilePath;
				if (path.isAbsolute(configPath)) {
					startPath = path.dirname(configPath);
				} else {
					startPath = path.dirname(path.resolve(vaultPath, configPath));
				}
			} else if (defaultPath && !path.isAbsolute(defaultPath)) {
				// Convert relative path to absolute if needed
				startPath = path.resolve(vaultPath, defaultPath);
				// If it's a file path, use its directory
				if (path.extname(startPath)) {
					startPath = path.dirname(startPath);
				}
			} else if (defaultPath && path.isAbsolute(defaultPath)) {
				// If it's a file path, use its directory
				if (path.extname(defaultPath)) {
					startPath = path.dirname(defaultPath);
				} else {
					startPath = defaultPath;
				}
			}

			const result = dialog.showOpenDialogSync({
				title: 'Select Astro Config File',
				defaultPath: startPath,
				filters: [
					{ name: 'Astro Config Files', extensions: ['ts', 'mjs', 'js', 'mts', 'cjs'] },
					{ name: 'All Files', extensions: ['*'] }
				],
				properties: ['openFile']
			});

			if (result && result.length > 0) {
				const absolutePath = path.normalize(result[0]);
				return this.toRelativePath(absolutePath);
			}
		} catch (error: unknown) {
			console.error('Error opening file picker:', error);
			// Show user-friendly error
			new Notice('Unable to open file picker. Please ensure you are using Obsidian on desktop.');
		}

		return null;
	}

	/**
	 * Get the vault path
	 */
	private getVaultPath(): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		// Resolve path (convert relative to absolute, normalize separators)
		if (vaultPath) {
			// If already absolute, return as-is (normalized)
			if (vaultPath.startsWith('/') || /^[A-Z]:/.test(vaultPath)) {
				return vaultPath.replace(/\\/g, '/');
			}
			// For relative paths, we'd need to resolve, but in Obsidian context, basePath should be absolute
			return vaultPath.replace(/\\/g, '/');
		}
		// Fallback - in Obsidian context this shouldn't happen
		return '/';
	}

	/**
	 * Convert absolute path to relative path from vault root
	 */
	private toRelativePath(absolutePath: string): string {
		const adapter = this.app.vault.adapter as { basePath?: string; path?: string };
		const vaultPath = adapter.basePath || adapter.path;
		if (!vaultPath) {
			return absolutePath;
		}
		
		const vaultNormalized = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');
		const absoluteNormalized = absolutePath.replace(/\\/g, '/').replace(/\/$/, '');
		
		// If the absolute path is within the vault, return relative path
		if (absoluteNormalized.startsWith(vaultNormalized)) {
			const relative = absoluteNormalized.slice(vaultNormalized.length);
			// Remove leading path separator
			return relative.startsWith('/') ? relative.slice(1) : relative;
		}
		
		// If path is outside vault, calculate relative path manually
		try {
			// Split paths into parts
			const vaultParts = vaultNormalized.split('/').filter(p => p);
			const absoluteParts = absoluteNormalized.split('/').filter(p => p);
			
			// Find common prefix
			let commonLength = 0;
			while (commonLength < vaultParts.length && commonLength < absoluteParts.length && vaultParts[commonLength] === absoluteParts[commonLength]) {
				commonLength++;
			}
			
			// Calculate relative path
			const upLevels = vaultParts.length - commonLength;
			const relativeParts = absoluteParts.slice(commonLength);
			const relative = (upLevels > 0 ? '../'.repeat(upLevels) : '') + relativeParts.join('/');
			return relative || absolutePath;
		} catch {
			// If relative path calculation fails, return absolute path
			return absolutePath;
		}
	}

	validate(): boolean {
		if (this.detected) {
			return true;
		}

		// Validate that both paths are set and exist
		const projectRoot = this.state.projectDetection?.projectRoot;
		const configFilePath = this.state.projectDetection?.configFilePath;

		if (!projectRoot || !configFilePath) {
			return false;
		}

		// Check if paths exist (resolve relative paths to absolute)
		try {
			const vaultPath = this.getVaultPath();
			const resolvedProjectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.join(vaultPath, projectRoot);
			const resolvedConfigFilePath = path.isAbsolute(configFilePath) ? configFilePath : path.join(vaultPath, configFilePath);
			
			if (!fs.existsSync(resolvedProjectRoot) || !fs.statSync(resolvedProjectRoot).isDirectory()) {
				return false;
			}
			if (!fs.existsSync(resolvedConfigFilePath) || !fs.statSync(resolvedConfigFilePath).isFile()) {
				return false;
			}
			return true;
		} catch {
			return false;
		}
	}

	getTitle(): string {
		return 'Project detection';
	}

	getDescription(): string {
		return 'Detect Astro project structure';
	}
}

