import { Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { PathResolver } from '../../utils/PathResolver';

// Helper function for setCssProps
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
    for (const [key, value] of Object.entries(props)) {
        element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
    }
}

export class PluginConfigurationStep extends BaseWizardStep {
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Plugin Configuration' });
        containerEl.createEl('p', {
            text: 'Your plugins will be automatically configured using your mapped frontmatter properties. Review the settings below.'
        });

        const enabledTypes = this.state.contentTypes.filter(ct => ct.enabled);

        if (enabledTypes.length === 0) {
            containerEl.createEl('p', {
                text: 'No content types enabled. Please go back and enable at least one content type.'
            });
            return;
        }

        // --- Base views Section ---
        const basesCMSDiv = containerEl.createDiv({ cls: 'plugin-config-section', attr: { style: 'margin-bottom: 2rem;' } });
        basesCMSDiv.createEl('b', { text: 'Base views to be created:', attr: { style: 'display: block; margin-bottom: 0.5rem;' } });
        const basesList = basesCMSDiv.createEl('ul', { attr: { style: 'margin-top: 0;' } });

        for (const contentType of enabledTypes) {
            const props = this.state.frontmatterProperties[contentType.id];
            if (props) {
                const properties: string[] = [];
                if (props.titleProperty) properties.push(props.titleProperty);
                if (props.dateProperty) properties.push(props.dateProperty);
                if (props.descriptionProperty) properties.push(props.descriptionProperty);
                if (props.tagsProperty) properties.push(props.tagsProperty);
                if (props.imageProperty) properties.push(props.imageProperty);
                if (props.draftProperty) properties.push(props.draftProperty);

                const propertiesText = properties.length > 0 ? properties.join(', ') : 'default properties';
                basesList.createEl('li', {
                    text: `${contentType.name}: ${propertiesText}`
                });
            }
        }

        // --- Creation logic Section ---
        const astroComposerDiv = containerEl.createDiv({ cls: 'plugin-config-section', attr: { style: 'margin-bottom: 2rem;' } });
        astroComposerDiv.createEl('b', { text: 'Creation logic:', attr: { style: 'display: block; margin-bottom: 0.5rem;' } });
        const astroList = astroComposerDiv.createEl('ul', { attr: { style: 'margin-top: 0;' } });

        for (const contentType of enabledTypes) {
            const modeLabel = contentType.fileOrganization === 'folder' ? 'folder-based' : 'file-based';
            astroList.createEl('li', {
                text: `${contentType.name} (${contentType.folder}): ${modeLabel}`
            });
        }

        // --- Configuration Section ---
        const configDiv = containerEl.createDiv({ cls: 'plugin-config-section', attr: { style: 'border-top: 1px solid var(--background-modifier-border); padding-top: 1rem;' } });

        // Check for property inconsistencies (SEO warning)
        const titleProperties = new Set<string>();
        const descriptionProperties = new Set<string>();
        for (const contentType of enabledTypes) {
            const props = this.state.frontmatterProperties[contentType.id];
            if (props) {
                if (props.titleProperty) titleProperties.add(props.titleProperty);
                if (props.descriptionProperty) descriptionProperties.add(props.descriptionProperty);
            }
        }

        if (titleProperties.size > 1 || descriptionProperties.size > 1) {
            const warningDiv = configDiv.createDiv({ cls: 'vault-cms-warning' });
            setCssProps(warningDiv, {
                padding: '10px',
                backgroundColor: 'var(--background-modifier-border)',
                borderLeft: '3px solid var(--text-warning)',
                marginBottom: '15px'
            });
            warningDiv.createEl('p', {
                text: '⚠️ Warning: Different content types use different properties for title or description. SEO will use the default content type\'s properties.',
                attr: { style: 'margin: 0; font-size: 0.9em;' }
            });
        }

        // Default Content Type Setting
        new Setting(configDiv)
            .setName('Default content type')
            .setDesc('Choose the default content type for new notes and Home base')
            .addDropdown(dropdown => {
                enabledTypes.forEach(ct => {
                    dropdown.addOption(ct.id, ct.name);
                });
                dropdown.setValue(this.state.defaultContentTypeId || (enabledTypes[0]?.id || ''));
                dropdown.onChange(value => {
                    this.state.defaultContentTypeId = value;
                });
            });

        // SEO Scan Directories Setting
        const pathResolver = new PathResolver(this.app);
        const defaultScanDirs = this.state.contentTypes
            .filter(ct => ct.enabled)
            .map(ct => pathResolver.getFolderPathFromVaultRoot(ct.folder, this.state.projectDetection))
            .join(',');
        const savedScanDirs = this.state.seoConfig?.scanDirectories;
        const initialScanDirs = savedScanDirs && savedScanDirs.trim() ? savedScanDirs : defaultScanDirs;

        if (!this.state.seoConfig.scanDirectories || !this.state.seoConfig.scanDirectories.trim()) {
            this.state.seoConfig.scanDirectories = initialScanDirs;
        }

        new Setting(configDiv)
            .setName('SEO Scan directories')
            .setDesc('Comma-separated list of directories to scan')
            .addText(text => text
                .setValue(initialScanDirs)
                .onChange(value => {
                    if (this.state.seoConfig) {
                        this.state.seoConfig.scanDirectories = value;
                    }
                }));
    }

    validate(): boolean {
        return this.state.contentTypes.some(ct => ct.enabled);
    }

    getTitle(): string {
        return 'Plugin configuration';
    }

    getDescription(): string {
        return 'Configure Bases, Astro Composer, SEO, and Default Type';
    }
}
