import { App, Setting, Notice } from 'obsidian';

// Helper function for setCssProps (may not be in types yet)
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for path operations
import * as path from 'path';
// eslint-disable-next-line import/no-nodejs-modules -- Node.js module needed for file operations
import * as fs from 'fs';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { ProjectDetector } from '../../utils/ProjectDetector';
import { MdxDetector } from '../../utils/MdxDetector';
import { ContentTypeDetector } from '../../utils/ContentTypeDetector';

export class ProjectDetectionStep extends BaseWizardStep {
	private projectDetector: ProjectDetector;
	private mdxDetector: MdxDetector;
	private contentTypeDetector: ContentTypeDetector;
	private detected: boolean = false;
	private projectRootDisplay: HTMLElement | null = null;
	private configFileDisplay: HTMLElement | null = null;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.projectDetector = new ProjectDetector(app);
		this.mdxDetector = new MdxDetector(app);
		this.contentTypeDetector = new ContentTypeDetector(app);
	}

	async display(): Promise<void> {
		console.debug('ProjectDetectionStep.display: called');
		const { containerEl } = this;
		containerEl.empty();

		// Check if we have saved project detection values
		const hasSavedValues = this.state.projectDetection?.projectRoot && this.state.projectDetection?.configFilePath;
		console.debug('ProjectDetectionStep.display: hasSavedValues =', hasSavedValues);
		console.debug('ProjectDetectionStep.display: current enableMdxSupport =', this.state.enableMdxSupport);

		if (!hasSavedValues) {
			containerEl.createEl('h2', { text: 'Project detection' });
			containerEl.createEl('p', {
				text: 'Detecting your Astro project structure...'
			});

			const result = this.projectDetector.detectProject();
			console.debug('ProjectDetectionStep.display: detection result =', result);

			if (result) {
				// Store absolute paths for reliability within internal logic
				this.state.projectDetection = {
					projectRoot: result.projectRoot,
					configFilePath: result.configFilePath,
					vaultLocation: result.vaultLocation
				};
				console.debug('ProjectDetectionStep.display: set projectDetection =', this.state.projectDetection);
				this.detected = true;
			} else {
				// No detection, show manual selection
				this.detected = false;
			}
		} else {
			// Use saved values
			console.debug('ProjectDetectionStep.display: using saved projectDetection =', this.state.projectDetection);
			this.detected = true;
		}

		if (this.state.projectDetection && (this.detected || hasSavedValues)) {

			// Add slight delay before showing detected content (like astro-modular-settings)
			await new Promise(resolve => setTimeout(resolve, 500));

			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project detected' });
			containerEl.createEl('p', {
				text: 'Project structure detected successfully. You can modify the paths below if needed, then click "Next" to continue.'
			});

			// Project Root picker (with browse button even when detected)
			const projectRootSetting = new Setting(containerEl)
				.setName('Project root')
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot ? this.toRelativePath(this.state.projectDetection.projectRoot) : 'No folder selected',
				cls: 'vault-cms-path-display'
			});
			setCssProps(this.projectRootDisplay, { color: 'var(--text-normal)' });

			projectRootSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					(() => {
						const selectedPath = this.selectFolder();
						if (selectedPath) {
							this.state.projectDetection!.projectRoot = this.toRelativePath(selectedPath);
							if (this.projectRootDisplay) {
								this.projectRootDisplay.textContent = this.toRelativePath(selectedPath);
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
				text: this.state.projectDetection.configFilePath ? this.toRelativePath(this.state.projectDetection.configFilePath) : 'No file selected',
				cls: 'vault-cms-path-display'
			});
			setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });

			configFileSetting.addButton(button => button
				.setButtonText('Browse...')
				.setCta()
				.onClick(() => {
					(() => {
						const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
						const selectedPath = this.selectConfigFile(defaultPath);
						if (selectedPath) {
							this.state.projectDetection!.configFilePath = this.toRelativePath(selectedPath);
							if (this.configFileDisplay) {
								this.configFileDisplay.textContent = this.toRelativePath(selectedPath);
								setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });
							}
							// Update detected flag if user changes
							this.detected = false;
						}
					})();
				}));

			// MDX Support checkbox
			// Auto-detect MDX files if project is detected
			let autoDetectedMdx = false;
			if (this.state.projectDetection) {
				try {
					console.debug('ProjectDetectionStep: Starting MDX detection');
					console.debug('ProjectDetectionStep: projectDetection =', this.state.projectDetection);
					console.debug('ProjectDetectionStep: existing contentTypes =', this.state.contentTypes.length);

					// Get content types - use existing ones if available, otherwise detect them
					let contentTypesToUse = this.state.contentTypes;
					if (contentTypesToUse.length === 0) {
						console.debug('ProjectDetectionStep: No content types in state, detecting now...');
						// Content types not detected yet, detect them now for MDX scanning
						contentTypesToUse = this.contentTypeDetector.detectContentTypes(this.state.projectDetection);
						console.debug('ProjectDetectionStep: Detected content types =', contentTypesToUse.length, contentTypesToUse.map(ct => `${ct.name} (${ct.folder}, enabled: ${ct.enabled})`));
					} else {
						console.debug('ProjectDetectionStep: Using existing content types =', contentTypesToUse.map(ct => `${ct.name} (${ct.folder}, enabled: ${ct.enabled})`));
					}

					if (contentTypesToUse.length > 0) {
						console.debug('ProjectDetectionStep: Calling mdxDetector.detectMdxUsage...');
						autoDetectedMdx = this.mdxDetector.detectMdxUsage(
							this.state.projectDetection,
							contentTypesToUse
						);
						console.debug('ProjectDetectionStep: MDX detection result =', autoDetectedMdx);
					} else {
						console.debug('ProjectDetectionStep: No content types to scan');
					}
				} catch (error) {
					// If detection fails, default to false
					console.error('ProjectDetectionStep: MDX detection failed:', error);
					autoDetectedMdx = false;
				}
			} else {
				console.debug('ProjectDetectionStep: No projectDetection, skipping MDX detection');
			}

			// Always update enableMdxSupport with auto-detection result if it hasn't been set/detected yet
			// This ensures detection runs on first run but remembers user's manual choice thereafter
			if (this.state.enableMdxSupport === undefined) {
				this.state.enableMdxSupport = autoDetectedMdx;
				console.debug('ProjectDetectionStep: Set enableMdxSupport to', autoDetectedMdx, 'based on auto-detection');
			} else {
				console.debug('ProjectDetectionStep: enableMdxSupport already set to', this.state.enableMdxSupport, ', skipping auto-detection overwrite');
			}

			const mdxSetting = new Setting(containerEl)
				.setName('MDX file support')
				.setDesc('Enable MDX file support for Astro Composer, Property Over File Name, SEO, and UI Tweaker plugins.');

			mdxSetting.addToggle(toggle => {
				toggle
					.setValue(this.state.enableMdxSupport ?? false)
					.onChange(value => {
						this.state.enableMdxSupport = value;
					});

				// Show auto-detection message if MDX was detected
				if (autoDetectedMdx && this.state.enableMdxSupport) {
					const autoDetectMsg = mdxSetting.descEl.createDiv({
						text: 'MDX files detected in content folders',
						cls: 'vault-cms-auto-detect-msg'
					});
					setCssProps(autoDetectMsg, {
						color: 'var(--text-muted)',
						fontSize: '0.9em',
						marginTop: '4px'
					});
				}
			});

			// Extended File Types support (JSON, Astro)
			const extendedFileTypesSetting = new Setting(containerEl)
				.setName('Extended file types')
				.setDesc('Enable support to view, edit, and create .json and .astro files via the Data Files Editor plugin.');

			extendedFileTypesSetting.addToggle(toggle => {
				toggle
					.setValue(this.state.enableExtendedFileTypes ?? false)
					.onChange(value => {
						this.state.enableExtendedFileTypes = value;
					});
			});
		} else {
			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project detection failed' });
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
				.setName('Project root')
				.setDesc('Select the folder containing your Astro project root');

			// Display current selection
			this.projectRootDisplay = projectRootSetting.descEl.createDiv({
				text: this.state.projectDetection.projectRoot ? this.toRelativePath(this.state.projectDetection.projectRoot) : 'No folder selected',
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
					(() => {
						const selectedPath = this.selectFolder();
						if (selectedPath) {
							this.state.projectDetection!.projectRoot = this.toRelativePath(selectedPath);
							if (this.projectRootDisplay) {
								this.projectRootDisplay.textContent = this.toRelativePath(selectedPath);
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
				text: this.state.projectDetection.configFilePath ? this.toRelativePath(this.state.projectDetection.configFilePath) : 'No file selected',
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
					(() => {
						const defaultPath = this.state.projectDetection?.projectRoot || this.getVaultPath();
						const selectedPath = this.selectConfigFile(defaultPath);
						if (selectedPath) {
							this.state.projectDetection!.configFilePath = this.toRelativePath(selectedPath);
							if (this.configFileDisplay) {
								this.configFileDisplay.textContent = this.toRelativePath(selectedPath);
								setCssProps(this.configFileDisplay, { color: 'var(--text-normal)' });
							}
						}
					})();
				}));

			// MDX Support checkbox (for manual project selection)
			// Try to auto-detect MDX if we have project detection
			let autoDetectedMdx = false;
			if (this.state.projectDetection && this.state.projectDetection.projectRoot && this.state.projectDetection.configFilePath) {
				// Try to detect content types first
				try {
					const detectedContentTypes = this.contentTypeDetector.detectContentTypes(this.state.projectDetection);
					if (detectedContentTypes.length > 0) {
						autoDetectedMdx = this.mdxDetector.detectMdxUsage(
							this.state.projectDetection,
							detectedContentTypes
						);
					}
				} catch {
					// If detection fails, default to false
					autoDetectedMdx = false;
				}
			}

			// Always update enableMdxSupport with auto-detection result if it hasn't been set/detected yet
			// This ensures detection runs on first run but remembers user's manual choice thereafter
			if (this.state.enableMdxSupport === undefined) {
				this.state.enableMdxSupport = autoDetectedMdx;
				console.debug('ProjectDetectionStep (manual): Set enableMdxSupport to', autoDetectedMdx, 'based on auto-detection');
			} else {
				console.debug('ProjectDetectionStep (manual): enableMdxSupport already set to', this.state.enableMdxSupport, ', skipping auto-detection overwrite');
			}

			const mdxSetting = new Setting(containerEl)
				.setName('MDX file support')
				.setDesc('Enable MDX file support for Astro Composer, Property Over File Name, SEO, and UI Tweaker plugins.');

			mdxSetting.addToggle(toggle => {
				toggle
					.setValue(this.state.enableMdxSupport ?? false)
					.onChange(value => {
						this.state.enableMdxSupport = value;
					});

				// Show auto-detection message if MDX was detected
				if (autoDetectedMdx && this.state.enableMdxSupport) {
					const autoDetectMsg = mdxSetting.descEl.createDiv({
						text: 'MDX files detected in content folders',
						cls: 'vault-cms-auto-detect-msg'
					});
					setCssProps(autoDetectMsg, {
						color: 'var(--text-muted)',
						fontSize: '0.9em',
						marginTop: '4px'
					});
				}
			});

			// Extended File Types support (JSON, Astro)
			const extendedFileTypesSetting = new Setting(containerEl)
				.setName('Extended file types')
				.setDesc('Enable support to view, edit, and create .json and .astro files via the Data Files Editor plugin.');

			extendedFileTypesSetting.addToggle(toggle => {
				toggle
					.setValue(this.state.enableExtendedFileTypes ?? false)
					.onChange(value => {
						this.state.enableExtendedFileTypes = value;
					});
			});
		}
	}

	/**
	 * Open native folder picker dialog
	 */
	private selectFolder(): string | null {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } | null = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
				const electronRemote = require('@electron/remote') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } };
				dialog = electronRemote?.dialog || null;
			} catch {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
					const electron = ((window as { require?: (module: string) => unknown }).require?.('electron') || require('electron')) as { remote?: { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; properties: string[] }) => string[] | undefined } } };
					dialog = electron?.remote?.dialog || null;
				} catch {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
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
				return path.normalize(result[0]);
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
	private selectConfigFile(defaultPath?: string): string | null {
		try {
			// Try multiple ways to access Electron dialog API
			let dialog: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } | null = null;

			// Method 1: Try @electron/remote (newer Electron versions)
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
				const electronRemote = require('@electron/remote') as { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } };
				dialog = electronRemote?.dialog || null;
			} catch {
				// Not available, try next method
			}

			// Method 2: Try electron.remote.dialog (older Electron versions)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
					const electron = ((window as { require?: (module: string) => unknown }).require?.('electron') || require('electron')) as { remote?: { dialog?: { showOpenDialogSync?: (options: { title: string; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }>; properties: string[] }) => string[] | undefined } } };
					dialog = electron?.remote?.dialog || null;
				} catch {
					// Not available, try next method
				}
			}

			// Method 3: Try electron.dialog directly (main process, may not work)
			if (!dialog) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- dynamic require for Electron
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
					{ name: 'Astro Config Files', extensions: ['ts', 'mjs', 'js', 'mts', 'cjs', 'yml', 'yaml'] },
					{ name: 'All Files', extensions: ['*'] }
				],
				properties: ['openFile']
			});

			if (result && result.length > 0) {
				return path.normalize(result[0]);
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

