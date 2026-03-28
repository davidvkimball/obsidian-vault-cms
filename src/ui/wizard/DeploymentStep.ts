import { App, Setting, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { resolveProjectRoot } from '../../utils/ProjectRootResolver';
import * as path from 'path';

type Platform = 'netlify' | 'vercel' | 'cloudflare' | 'github-pages';

interface PlatformInfo {
    id: Platform;
    name: string;
    description: string;
    url: string;
    configFile?: string;
    configContent?: () => string;
}

export class DeploymentStep extends BaseWizardStep {
    private selectedPlatform: Platform | '' = '';

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
    }

    async shouldSkip(): Promise<boolean> {
        return false;
    }

    private getAbsoluteProjectRoot(): string | null {
        return resolveProjectRoot(this.app, this.state.projectDetection?.projectRoot);
    }

    private getProjectName(): string {
        const projectRoot = this.getAbsoluteProjectRoot();
        if (projectRoot) {
            return projectRoot.split(/[\\/]/).pop() || 'my-site';
        }
        return 'my-site';
    }

    private getPlatforms(): PlatformInfo[] {
        return [
            {
                id: 'netlify',
                name: 'Netlify',
                description: 'Fast and reliable hosting with a great developer experience.',
                url: 'https://app.netlify.com/start',
                configFile: 'netlify.toml',
                configContent: () => [
                    '[build]',
                    '  command = "pnpm run build"',
                    '  publish = "dist"',
                    ''
                ].join('\n')
            },
            {
                id: 'vercel',
                name: 'Vercel',
                description: 'Optimized for frontend frameworks with zero-config deployment.',
                url: 'https://vercel.com/new/import',
                configFile: 'vercel.json',
                configContent: () => JSON.stringify({ framework: 'astro' }, null, 2) + '\n'
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare',
                description: 'Global edge network with generous free tier.',
                url: 'https://dash.cloudflare.com/',
                configFile: 'wrangler.toml',
                configContent: () => {
                    const today = new Date().toISOString().split('T')[0];
                    const projectName = this.getProjectName();
                    return [
                        `name = "${projectName}"`,
                        `compatibility_date = "${today}"`,
                        '',
                        '[assets]',
                        '  directory = "./dist"',
                        '  not_found_handling = "404-page"',
                        ''
                    ].join('\n');
                }
            },
            {
                id: 'github-pages',
                name: 'GitHub Pages',
                description: 'Host directly from your GitHub repository. Requires a public repo for free accounts.',
                url: 'https://github.com/features/pages'
            }
        ];
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Deployment' });
        containerEl.createEl('p', {
            text: 'Choose where you want to host your site. A config file will be created for your chosen platform.'
        });

        // Restore previous selection if any
        this.selectedPlatform = (this.state as any).deploymentPlatform || '';

        const platforms = this.getPlatforms();

        for (const platform of platforms) {
            const setting = new Setting(containerEl);
            setting.setName(platform.name);
            setting.setDesc(platform.description);

            setting.addButton(btn => {
                const isSelected = this.selectedPlatform === platform.id;
                btn.setButtonText(isSelected ? 'Selected' : 'Select');
                if (isSelected) btn.setCta();
                if (isSelected) btn.setDisabled(true);

                btn.onClick(async () => {
                    this.selectedPlatform = platform.id;
                    (this.state as any).deploymentPlatform = platform.id;

                    // Generate config file if applicable
                    if (platform.configFile && platform.configContent) {
                        await this.generateConfigFile(platform.configFile, platform.configContent());
                    }

                    // Re-render to update button states
                    await this.display();
                });
            });
        }
    }

    private async generateConfigFile(filename: string, content: string): Promise<void> {
        const projectRoot = this.getAbsoluteProjectRoot();
        if (!projectRoot) return;

        const filePath = path.join(projectRoot, filename);

        try {
            const fs = require('fs');
            if (fs.existsSync(filePath)) {
                return; // File exists, don't overwrite
            }
            fs.writeFileSync(filePath, content, 'utf-8');
            new Notice(`Created ${filename}`);
        } catch {
            // Silent failure
        }
    }

    /**
     * Returns the deploy URL for the selected platform.
     * Called by GitSetupStep after a successful push.
     */
    public static getDeployUrl(platform: string): string {
        switch (platform) {
            case 'netlify': return 'https://app.netlify.com/start';
            case 'vercel': return 'https://vercel.com/new/import';
            case 'cloudflare': return 'https://dash.cloudflare.com/';
            case 'github-pages': return 'https://github.com/features/pages';
            default: return '';
        }
    }

    public static getPlatformName(platform: string): string {
        switch (platform) {
            case 'netlify': return 'Netlify';
            case 'vercel': return 'Vercel';
            case 'cloudflare': return 'Cloudflare';
            case 'github-pages': return 'GitHub Pages';
            default: return '';
        }
    }

    validate(): boolean {
        return true;
    }

    getTitle(): string {
        return 'Deployment';
    }

    getDescription(): string {
        return 'Choose your hosting platform';
    }
}
