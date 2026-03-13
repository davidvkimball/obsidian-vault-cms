import { App } from 'obsidian';

const PLUGIN_ID = 'file-name-history';

type FileNameHistoryPlugin = {
    settings?: { fileExtensions?: string[] };
    saveSettings?: () => Promise<void>;
};

type PluginsAPI = {
    plugins?: Record<string, FileNameHistoryPlugin>;
};

export class FileNameHistoryConfigurator {
    constructor(private app: App) {}

    async saveConfig(enableMdxSupport: boolean): Promise<void> {
        const configPath = `${this.app.vault.configDir}/plugins/${PLUGIN_ID}/data.json`;

        try {
            const plugins = (this.app as { plugins?: PluginsAPI }).plugins;
            const plugin = plugins?.plugins?.[PLUGIN_ID];

            if (plugin?.settings) {
                plugin.settings.fileExtensions = enableMdxSupport ? ['md', 'mdx'] : ['md'];
                if (typeof plugin.saveSettings === 'function') {
                    await plugin.saveSettings();
                }
                return;
            }

            const data = await this.app.vault.adapter.read(configPath).catch(() => '{}');
            const parsed = JSON.parse(data || '{}') as Record<string, unknown>;
            parsed.fileExtensions = enableMdxSupport ? ['md', 'mdx'] : ['md'];
            await this.app.vault.adapter.write(configPath, JSON.stringify(parsed, null, 2) + '\n');
        } catch (error) {
            console.warn('[Vault CMS] Could not configure File Name History:', error);
        }
    }
}
