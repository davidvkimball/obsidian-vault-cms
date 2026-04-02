import { App } from 'obsidian';
import { WizardState } from '../types';
import { BasesCMSConfigurator } from './BasesCMSConfig';
import { AstroComposerConfigurator } from './AstroComposerConfig';
import { SEOConfigurator } from './SEOConfig';
import { PropertyOverFileNameConfigurator } from './PropertyOverFileNameConfig';
import { UITweakerConfigurator } from './UITweakerConfig';
import { ImageManagerConfigurator } from './ImageManagerConfig';
import { HomeBaseConfigurator } from './HomeBaseConfig';
import { ExplorerFocusConfigurator } from './ExplorerFocusConfig';
import { DataFilesEditorConfigurator } from './DataFilesEditorConfig';
import { EditingToolbarConfigurator } from './EditingToolbarConfig';
import { FileNameHistoryConfigurator } from './FileNameHistoryConfig';

export class ConfigFlushService {
    private basesCMSConfigurator: BasesCMSConfigurator;
    private astroComposerConfigurator: AstroComposerConfigurator;
    private seoConfigurator: SEOConfigurator;
    private propertyOverFileNameConfigurator: PropertyOverFileNameConfigurator;
    private uiTweakerConfigurator: UITweakerConfigurator;
    private imageManagerConfigurator: ImageManagerConfigurator;
    private homeBaseConfigurator: HomeBaseConfigurator;
    private explorerFocusConfigurator: ExplorerFocusConfigurator;
    private dataFilesEditorConfigurator: DataFilesEditorConfigurator;
    private editingToolbarConfigurator: EditingToolbarConfigurator;
    private fileNameHistoryConfigurator: FileNameHistoryConfigurator;

    constructor(private app: App) {
        this.basesCMSConfigurator = new BasesCMSConfigurator(app);
        this.astroComposerConfigurator = new AstroComposerConfigurator(app);
        this.seoConfigurator = new SEOConfigurator(app);
        this.propertyOverFileNameConfigurator = new PropertyOverFileNameConfigurator(app);
        this.uiTweakerConfigurator = new UITweakerConfigurator(app);
        this.imageManagerConfigurator = new ImageManagerConfigurator(app);
        this.homeBaseConfigurator = new HomeBaseConfigurator(app);
        this.explorerFocusConfigurator = new ExplorerFocusConfigurator(app);
        this.dataFilesEditorConfigurator = new DataFilesEditorConfigurator(app);
        this.editingToolbarConfigurator = new EditingToolbarConfigurator(app);
        this.fileNameHistoryConfigurator = new FileNameHistoryConfigurator(app);
    }

    /**
     * Flushes current wizard state to various plugin configuration files.
     * This ensures the disk reflects the current wizard configuration without
     * needing to reach the finalization step.
     */
    async flush(state: WizardState): Promise<void> {
        console.debug('ConfigFlushService: Starting configuration flush');

        // 1. Configure Bases CMS
        await this.basesCMSConfigurator.createOrUpdateBaseFile(
            state.contentTypes,
            state.frontmatterProperties,
            state.defaultContentTypeId,
            state.projectDetection,
            state.enableMdxSupport === true
        );
        // Pass the resolved base file path into Home Base so it opens the file we created/found
        const baseFilePath = await this.basesCMSConfigurator.resolveBaseFilePath();
        state.homeBase = { ...state.homeBase, homeBaseType: 'File', homeBaseValue: baseFilePath };

        // 2. Configure Astro Composer
        if (state.projectDetection) {
            const astroConfig = await this.astroComposerConfigurator.configureAstroComposer(
                state.contentTypes,
                state.frontmatterProperties,
                state.projectDetection.projectRoot,
                state.projectDetection.configFilePath,
                state.defaultContentTypeId,
                state.projectDetection,
                state.enableMdxSupport
            );
            state.astroComposerConfig = astroConfig;
            await this.astroComposerConfigurator.saveConfig(astroConfig);
        }

        // 3. Configure SEO (merge: preserve user-edited scan directories from the wizard)
        const generatedSeo = this.seoConfigurator.generateSEOConfig(
            state.contentTypes,
            state.frontmatterProperties,
            state.projectDetection,
            state.enableMdxSupport,
            state.defaultContentTypeId
        );
        const userScanDirs = state.seoConfig?.scanDirectories?.trim();
        state.seoConfig = {
            ...generatedSeo,
            scanDirectories: userScanDirs || generatedSeo.scanDirectories
        };
        await this.seoConfigurator.saveConfig(state.seoConfig);

        // 4. Configure Property Over File Name
        const firstType = state.contentTypes.find(ct => ct.enabled);
        const firstProps = firstType ? state.frontmatterProperties[firstType.id] : undefined;
        if (firstProps && firstProps.titleProperty) {
            state.propertyOverFileName.propertyKey = firstProps.titleProperty;
        }
        state.propertyOverFileName.enableMdxSupport = state.enableMdxSupport === true;
        await this.propertyOverFileNameConfigurator.saveConfig(state.propertyOverFileName);

        // 5. Configure UI Tweaker
        await this.uiTweakerConfigurator.saveConfig(state.enableMdxSupport === true);

        // 5b. Configure File Name History (mdx when MDX support enabled)
        if (state.enabledPlugins.includes('file-name-history')) {
            await this.fileNameHistoryConfigurator.saveConfig(state.enableMdxSupport === true);
        }

        // 6. Configure Image Manager
        if (state.enabledPlugins.includes('image-manager') || Object.keys(state.imageManager).length > 0) {
            await this.imageManagerConfigurator.resolveAndSyncImageProperty(state);
            await this.imageManagerConfigurator.saveConfig(state.imageManager);
        }

        // 7. Configure Home Base
        if (state.enabledPlugins.includes('home-base') || Object.keys(state.homeBase).length > 0) {
            await this.homeBaseConfigurator.saveConfig(state.homeBase);
        }

        // 8. Configure Explorer Focus
        // Auto-configure based on vault location if not manually set
        if (state.projectDetection && (!state.explorerFocus || Object.keys(state.explorerFocus).length === 0)) {
            const vaultLocation = state.projectDetection.vaultLocation;
            if (vaultLocation === 'root') {
                // Root install: focus on src/content so users see content, not project files
                state.explorerFocus = {
                    showRightClickMenu: true,
                    showFileExplorerIcon: true,
                    focusLevel: 'custom',
                    customFolderPath: 'src/content',
                    hideAncestorFolders: false
                };
                console.debug('ConfigFlushService: Auto-configured Explorer Focus for root install (custom: src/content)');
            } else {
                // Content or nested-content install: use default parent focus
                state.explorerFocus = {
                    showRightClickMenu: true,
                    showFileExplorerIcon: true,
                    focusLevel: 'parent',
                    hideAncestorFolders: false
                };
                console.debug('ConfigFlushService: Auto-configured Explorer Focus for content install (parent)');
            }
        }
        if (state.enabledPlugins.includes('explorer-focus') || Object.keys(state.explorerFocus).length > 0) {
            await this.explorerFocusConfigurator.saveConfig(state.explorerFocus);
        }

        // 9. Configure WYSIWYG Toolbar (toggle visibility directly)
        await this.editingToolbarConfigurator.toggleVisibility(this.app, state.enableEditingToolbar);

        // 10. Configure Data Files Editor
        await this.dataFilesEditorConfigurator.saveConfig(state.enableExtendedFileTypes === true);

        console.debug('ConfigFlushService: Configuration flush complete');
    }
}
