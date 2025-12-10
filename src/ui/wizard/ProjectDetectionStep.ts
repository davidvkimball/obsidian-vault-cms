import { App, Setting, Notice } from 'obsidian';
import * as path from 'path';
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
			containerEl.createEl('h2', { text: 'Project Detection' });
			containerEl.createEl('p', { 
				text: 'Detecting your Astro project structure...' 
			});

			const result = await this.projectDetector.detectProject();
			
			if (result) {
				// Initialize state with detected values
				this.state.projectDetection = result;
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
			containerEl.createEl('h2', { text: 'Project Detected' });
			containerEl.createEl('p', { 
				text: 'Project structure detected successfully. You can modify the paths below if needed, then click "Next" to continue.' 
			});
			
			// Project Root picker (with browse button even when detected)
			const projectRootSetting = new Setting(containerEl)
				.setName('Project Root')
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot || 'No folder selected',
				cls: 'vault-cms-path-display'
			});
			this.projectRootDisplay.style.color = 'var(--text-normal)';

			projectRootSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(async () => {
					const selectedPath = await this.selectFolder();
					if (selectedPath) {
						this.state.projectDetection!.projectRoot = selectedPath;
						if (this.projectRootDisplay) {
							this.projectRootDisplay.textContent = selectedPath;
							this.projectRootDisplay.style.color = 'var(--text-normal)';
						}
						// Update detected flag if user changes
						this.detected = false;
					}
				}));

			// Config File picker (with browse button even when detected)
			const configFileSetting = new Setting(containerEl)
				.setName('Config File')
				.setDesc('Select your Astro config file (astro.config.ts, astro.config.mjs, src/config.ts, etc.)');

			// Display current selection
			this.configFileDisplay = configFileSetting.descEl.createDiv({
				text: this.state.projectDetection.configFilePath || 'No file selected',
				cls: 'vault-cms-path-display'
			});
			this.configFileDisplay.style.color = 'var(--text-normal)';

			configFileSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(async () => {
					const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
					const selectedPath = await this.selectConfigFile(defaultPath);
					if (selectedPath) {
						this.state.projectDetection!.configFilePath = selectedPath;
						if (this.configFileDisplay) {
							this.configFileDisplay.textContent = selectedPath;
							this.configFileDisplay.style.color = 'var(--text-normal)';
						}
						// Update detected flag if user changes
						this.detected = false;
					}
				}));
		} else {
			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project Detection Failed' });
			containerEl.createEl('p', { 
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
				.setName('Project Root')
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot || 'No folder selected',
				cls: 'vault-cms-path-display'
			});
			if (this.state.projectDetection.projectRoot) {
				this.projectRootDisplay.style.color = 'var(--text-normal)';
			} else {
				this.projectRootDisplay.style.color = 'var(--text-muted)';
			}

			projectRootSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(async () => {
					const selectedPath = await this.selectFolder();
					if (selectedPath) {
						this.state.projectDetection!.projectRoot = selectedPath;
						if (this.projectRootDisplay) {
							this.projectRootDisplay.textContent = selectedPath;
							this.projectRootDisplay.style.color = 'var(--text-normal)';
						}
					}
				}));

			// Config File picker
			const configFileSetting = new Setting(containerEl)
				.setName('Config File')
				.setDesc('Select your Astro config file (astro.config.ts, astro.config.mjs, etc.)');

			// Display current selection
			this.configFileDisplay = configFileSetting.descEl.createDiv({
				text: this.state.projectDetection.configFilePath || 'No file selected',
				cls: 'vault-cms-path-display'
			});
			if (this.state.projectDetection.configFilePath) {
				this.configFileDisplay.style.color = 'var(--text-normal)';
			} else {
				this.configFileDisplay.style.color = 'var(--text-muted)';
			}

			configFileSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(async () => {
					const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
					const selectedPath = await this.selectConfigFile(defaultPath);
					if (selectedPath) {
						this.state.projectDetection!.configFilePath = selectedPath;
						if (this.configFileDisplay) {
							this.configFileDisplay.textContent = selectedPath;
							this.configFileDisplay.style.color = 'var(--text-normal)';
						}
					}
				}));
		}
	}

	/**
	 * Open native folder picker dialog
	 */
	private async selectFolder(): Promise<string | null> {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: any = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				const electronRemote = require('@electron/remote');
				dialog = electronRemote?.dialog;
			} catch (e) {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					const electron = (window as any).require?.('electron') || require('electron');
					dialog = electron?.remote?.dialog;
				} catch (e) {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					const electron = require('electron');
					dialog = electron?.dialog;
				} catch (e) {
					// Not available
				}
			}

			if (!dialog || typeof dialog.showOpenDialogSync !== 'function') {
				throw new Error('Electron dialog API not available');
			}

			const vaultPath = this.getVaultPath();
			const defaultPath = this.state.projectDetection?.projectRoot || vaultPath;

			const result = dialog.showOpenDialogSync({
				title: 'Select Astro Project Root Folder',
				defaultPath: defaultPath,
				properties: ['openDirectory']
			});

			if (result && result.length > 0) {
				return path.normalize(result[0]);
			}
		} catch (error) {
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
			let dialog: any = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				const electronRemote = require('@electron/remote');
				dialog = electronRemote?.dialog;
			} catch (e) {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					const electron = (window as any).require?.('electron') || require('electron');
					dialog = electron?.remote?.dialog;
				} catch (e) {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					const electron = require('electron');
					dialog = electron?.dialog;
				} catch (e) {
					// Not available
				}
			}

			if (!dialog || typeof dialog.showOpenDialogSync !== 'function') {
				throw new Error('Electron dialog API not available');
			}

			const startPath = defaultPath || this.getVaultPath();

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
				const selectedPath = path.normalize(result[0]);
				// Accept any file selected - user knows what they're doing
				// The file picker already filters for common config extensions
				return selectedPath;
			}
		} catch (error) {
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
		const adapter = this.app.vault.adapter as any;
		const vaultPath = adapter.basePath || adapter.path;
		return vaultPath ? path.resolve(vaultPath) : process.cwd();
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

		// Check if paths exist
		try {
			if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
				return false;
			}
			if (!fs.existsSync(configFilePath) || !fs.statSync(configFilePath).isFile()) {
				return false;
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	getTitle(): string {
		return 'Project Detection';
	}

	getDescription(): string {
		return 'Detect Astro project structure';
	}
}

