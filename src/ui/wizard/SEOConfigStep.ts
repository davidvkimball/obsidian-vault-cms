import { Setting } from 'obsidian';

// Helper function for setCssProps (may not be in types yet)
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}
import { BaseWizardStep } from './BaseWizardStep';
import { PathResolver } from '../../utils/PathResolver';

export class SEOConfigStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// False positive: "SEO" is an acronym and should be capitalized
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'SEO plugin configuration' });
		containerEl.createEl('p', { 
			// False positive: "SEO" is an acronym and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'SEO plugin will be configured using your mapped frontmatter properties.' 
		});

		const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);
		const firstType = enabledTypes[0];
		const firstProps = firstType ? this.state.frontmatterProperties[firstType.id] : undefined;

		// Check if different content types use different properties
		const titleProperties = new Set<string>();
		const descriptionProperties = new Set<string>();
		
		for (const contentType of enabledTypes) {
			const props = this.state.frontmatterProperties[contentType.id];
			if (props) {
				if (props.titleProperty) {
					titleProperties.add(props.titleProperty);
				}
				if (props.descriptionProperty) {
					descriptionProperties.add(props.descriptionProperty);
				}
			}
		}

		// Show warning if properties differ across content types
		if (titleProperties.size > 1 || descriptionProperties.size > 1) {
			const warningDiv = containerEl.createDiv({ cls: 'vault-cms-warning' });
			setCssProps(warningDiv, {
				padding: '10px',
				backgroundColor: 'var(--background-modifier-border)',
				borderLeft: '3px solid var(--text-warning)',
				marginBottom: '15px'
			});
			
			warningDiv.createEl('p', { 
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: '⚠️ Warning: Different content types use different properties for title or description.',
				attr: { style: 'margin: 0 0 5px 0; font-weight: bold;' }
			});
			warningDiv.createEl('p', { 
				// False positive: "SEO" is an acronym and should be capitalized
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				text: 'The SEO plugin will use the first content type\'s properties. You may need to manually configure SEO settings for other content types.',
				attr: { style: 'margin: 0;' }
			});
		}

		if (firstProps) {
			containerEl.createEl('h3', { text: 'Configuration:' });
			containerEl.createEl('p', { 
				text: `Title property: ${firstProps.titleProperty || '(using filename)'}` 
			});
			if (firstProps.descriptionProperty) {
				containerEl.createEl('p', { 
					text: `Description property: ${firstProps.descriptionProperty}` 
				});
			}

			const scanDirs = enabledTypes
				.map(ct => ct.folder)
				.join(', ');

			containerEl.createEl('p', { 
				text: `Scan directories: ${scanDirs}` 
			});
		}

		// Use saved scanDirectories if it exists, otherwise default to enabled content type folders
		// Use PathResolver to get the correct folder paths (e.g., "content/docs" instead of "docs")
		const pathResolver = new PathResolver(this.app);
		const defaultScanDirs = this.state.contentTypes
			.filter(ct => ct.enabled)
			.map(ct => pathResolver.getFolderPathFromVaultRoot(ct.folder, this.state.projectDetection))
			.join(',');
		const savedScanDirs = this.state.seoConfig?.scanDirectories;
		const initialScanDirs = savedScanDirs && savedScanDirs.trim() ? savedScanDirs : defaultScanDirs;
		
		// Initialize scanDirectories if not set
		if (!this.state.seoConfig.scanDirectories || !this.state.seoConfig.scanDirectories.trim()) {
			this.state.seoConfig.scanDirectories = initialScanDirs;
		}
		
		new Setting(containerEl)
			.setName('Scan directories')
			.setDesc('Comma-separated list of directories to scan (you can customize this)')
			.addText(text => text
				.setValue(initialScanDirs)
				.onChange(value => {
					// Store custom scan directories if user changes them
					if (this.state.seoConfig) {
						this.state.seoConfig.scanDirectories = value;
					}
				}));
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'SEO configuration';
	}

	getDescription(): string {
		return 'Configure SEO plugin';
	}
}

