import { App, TFile } from 'obsidian';

export interface DataFilesEditorSettings {
    doLoadTxt: boolean;
    doCreateTxt: boolean;
    doLoadXml: boolean;
    doCreateXml: boolean;
    doLoadJson: boolean;
    doCreateJson: boolean;
    doLoadYaml: boolean;
    doCreateYaml: boolean;
    doLoadAstro: boolean;
    doCreateAstro: boolean;
    doLoadTs: boolean;
    doCreateTs: boolean;
    doLoadCss: boolean;
    doCreateCss: boolean;
    doLoadHtml: boolean;
    doCreateHtml: boolean;
    doLoadJs: boolean;
    doCreateJs: boolean;
    doLoadMjs: boolean;
    doCreateMjs: boolean;
    doAutosaveFiles: boolean;
    lineWrapping: boolean;
    [key: string]: unknown;
}

type PluginWithSettings = {
    settings?: DataFilesEditorSettings;
    saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
    plugins?: Record<string, PluginWithSettings>;
};

export class DataFilesEditorConfigurator {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async saveConfig(enabled: boolean): Promise<void> {
        const pluginId = 'data-files-editor';

        try {
            // Try to use plugin's live settings if available
            const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
            const plugin = plugins?.plugins?.[pluginId];

            if (plugin && plugin.settings) {
                console.debug('DataFilesEditorConfig: Using plugin.settings API');
                const settings = plugin.settings;

                this.applySettings(settings, enabled);

                // Save settings via plugin API
                if (typeof plugin.saveSettings === 'function') {
                    await plugin.saveSettings();
                    console.debug('DataFilesEditorConfig: Successfully saved via plugin.saveSettings()');
                    return;
                }
            }

            // Fallback to file method if plugin not available
            console.debug('DataFilesEditorConfig: Plugin API not available or settings not loaded, using fallback file method');
            await this.saveConfigFallback(enabled);
        } catch (error: unknown) {
            console.error('Failed to save Data Files Editor config:', error);
            // Try fallback anyway
            await this.saveConfigFallback(enabled);
        }
    }

    private applySettings(settings: DataFilesEditorSettings | Record<string, unknown>, enabled: boolean): void {
        // Set JSON and Astro based on the toggle
        settings.doLoadJson = enabled;
        settings.doCreateJson = enabled;
        settings.doLoadAstro = enabled;
        settings.doCreateAstro = enabled;

        // Default all other "load/create" settings to false as requested
        settings.doLoadTxt = false;
        settings.doCreateTxt = false;
        settings.doLoadXml = false;
        settings.doCreateXml = false;
        settings.doLoadYaml = false;
        settings.doCreateYaml = false;
        settings.doLoadTs = false;
        settings.doCreateTs = false;
        settings.doLoadCss = false;
        settings.doCreateCss = false;
        settings.doLoadHtml = false;
        settings.doCreateHtml = false;
        settings.doLoadJs = false;
        settings.doCreateJs = false;
        settings.doLoadMjs = false;
        settings.doCreateMjs = false;

        // Ensure these are true as requested
        settings.doAutosaveFiles = true;
        settings.lineWrapping = true;
    }

    private async saveConfigFallback(enabled: boolean): Promise<void> {
        const pluginId = 'data-files-editor';
        const configDir = this.app.vault.configDir;
        const pluginDataPath = `${configDir}/plugins/${pluginId}/data.json`;

        let existingData: Record<string, unknown> = {};
        const dataFile = this.app.vault.getAbstractFileByPath(pluginDataPath);

        if (dataFile instanceof TFile) {
            try {
                existingData = JSON.parse(await this.app.vault.read(dataFile)) as Record<string, unknown>;
            } catch (error: unknown) {
                console.warn('Failed to parse existing data-files-editor data.json:', error);
            }
        }

        // Apply the settings update
        this.applySettings(existingData, enabled);

        // Ensure plugin directory exists
        const pluginDir = `${configDir}/plugins/${pluginId}`;
        const pluginDirFile = this.app.vault.getAbstractFileByPath(pluginDir);
        if (!pluginDirFile) {
            try {
                await this.app.vault.createFolder(pluginDir);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage && !errorMessage.includes('already exists') && !errorMessage.includes('File already exists') && !errorMessage.includes('Folder already exists')) {
                    throw error;
                }
            }
        }

        // Save to file
        const content = JSON.stringify(existingData, null, 2);
        if (dataFile instanceof TFile) {
            await this.app.vault.modify(dataFile, content);
        } else {
            await this.app.vault.create(pluginDataPath, content);
        }
        console.debug('DataFilesEditorConfig: Successfully saved data-files-editor config via fallback');
    }
}
