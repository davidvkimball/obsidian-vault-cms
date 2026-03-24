import { App, Setting, Notice, TFile } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { GitManager } from '../../utils/GitManager';
import { resolveProjectRoot } from '../../utils/ProjectRootResolver';
import * as path from 'path';

export class DeploymentStep extends BaseWizardStep {
    private remoteUrl: string | null = null;

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
    }

    private getTailoredInstructions() {
        const vaultLocation = this.state.projectDetection?.vaultLocation || 'root';
        const projectRoot = this.state.projectDetection?.projectRoot || '';

        let rootDir = '/';
        let buildCommand = 'npm run build';
        let outputDir = 'dist';

        // For nested-content, we need to instruct the user about the Build settings
        if (vaultLocation === 'nested-content' || vaultLocation === 'content') {
            // Usually in our setups, the projectRoot is where the package.json is,
            // so instructions remain standard unless it's a monorepo.
        }

        return {
            rootDir,
            buildCommand,
            outputDir
        };
    }

    async shouldSkip(): Promise<boolean> {
        const absoluteRoot = this.getAbsoluteProjectRoot();
        if (absoluteRoot) {
            this.remoteUrl = await GitManager.getRemoteUrl(absoluteRoot);
        }
        return !this.remoteUrl;
    }

    private getAbsoluteProjectRoot(): string | null {
        return resolveProjectRoot(this.app, this.state.projectDetection?.projectRoot);
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Deployment Setup' });
        containerEl.createEl('p', {
            text: "Your site is ready to be published! Choose a deployment platform to host your Astro site. Click \"Next\" when you're done or to set this up later."
        });

        const instructions = this.getTailoredInstructions();
        const platformContainer = containerEl.createDiv({
            cls: 'deployment-platforms',
            attr: { style: 'min-height: 400px;' }
        });
        platformContainer.createEl('i', {
            text: 'Resolving repository details...',
            attr: { style: 'opacity: 0.5;' }
        });

        // 1. Fetch remote URL (Async)
        const absoluteRoot = this.getAbsoluteProjectRoot();
        if (absoluteRoot) {
            this.remoteUrl = await GitManager.getRemoteUrl(absoluteRoot);
        }

        // 2. Clear skeleton and render platforms
        platformContainer.empty();

        // Netlify
        this.renderPlatform(platformContainer, {
            name: 'Netlify',
            description: 'Fast and reliable hosting. Great developer experience.',
            url: this.getNetlifyDeployUrl(),
            instructions: [
                `Base directory: ${instructions.rootDir === '/' ? '(leave empty)' : instructions.rootDir}`,
                `Build command: ${instructions.buildCommand}`,
                `Publish directory: ${instructions.outputDir}`
            ],
            configGenerator: () => this.generateConfigFile('netlify.toml', [
                '[build]',
                `  command = "pnpm run build"`,
                `  publish = "dist"`,
                ''
            ].join('\n'))
        });

        // Vercel
        this.renderPlatform(platformContainer, {
            name: 'Vercel',
            description: 'Optimized for frontend frameworks with zero-config deployment.',
            url: this.getVercelDeployUrl(),
            instructions: [
                `Framework Preset: Astro`,
                `Root Directory: ${instructions.rootDir}`,
                `Build Command: ${instructions.buildCommand}`
            ],
            configGenerator: () => this.generateConfigFile('vercel.json', JSON.stringify({ framework: 'astro' }, null, 2) + '\n')
        });

        // Cloudflare
        this.renderPlatform(platformContainer, {
            name: 'Cloudflare',
            description: 'Host your site on Cloudflare Workers.',
            url: this.getCloudflareDeployUrl(),
            instructions: [
                `A wrangler.toml will be created for static asset hosting.`,
                `Build your site with: pnpm run build`,
                `Deploy with: npx wrangler deploy`
            ],
            configGenerator: () => {
                const today = new Date().toISOString().split('T')[0];
                const projectName = this.getProjectName();
                return this.generateConfigFile('wrangler.toml', [
                    `name = "${projectName}"`,
                    `compatibility_date = "${today}"`,
                    '',
                    '[assets]',
                    '  directory = "./dist"',
                    '  not_found_handling = "404-page"',
                    ''
                ].join('\n'));
            }
        });

        // GitHub
        this.renderPlatform(platformContainer, {
            name: 'GitHub',
            description: 'Host directly from your GitHub repository. (Requires Public repository for free accounts)',
            url: this.getGitHubPagesUrl(),
            instructions: [
                'Requires a GitHub Action to build and deploy.',
                'Go to Repository Settings > Pages > Build and deployment > Source: GitHub Actions.',
                'Ensure your repository is PUBLIC to use GH Pages for free.'
            ]
        });
    }

    private getNetlifyDeployUrl(): string {
        if (this.remoteUrl) {
            return `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(this.remoteUrl)}`;
        }
        return 'https://app.netlify.com/';
    }

    private getVercelDeployUrl(): string {
        return 'https://vercel.com/new/import';
    }

    private getCloudflareDeployUrl(): string {
        return 'https://dash.cloudflare.com/';
    }

    private getGitHubPagesUrl(): string {
        if (this.remoteUrl) {
            // Convert https://github.com/user/repo.git to https://github.com/user/repo/settings/pages
            let cleanUrl = this.remoteUrl.trim();
            if (cleanUrl.endsWith('.git')) {
                cleanUrl = cleanUrl.slice(0, -4);
            }
            return `${cleanUrl}/settings/pages`;
        }
        return 'https://github.com/features/pages';
    }

    private renderPlatform(container: HTMLElement, platform: { name: string; description: string; url: string; instructions: string[]; recommended?: boolean; configGenerator?: () => Promise<void> }) {
        const platformEl = container.createDiv({
            cls: 'deployment-platform',
            attr: { style: 'margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--background-modifier-border); border-radius: 8px;' }
        });

        const header = platformEl.createEl('h3', { attr: { style: 'margin-top: 0;' } });
        header.createSpan({ text: platform.name });
        if (platform.recommended) {
            header.createSpan({
                text: ' RECOMMENDED',
                attr: { style: 'font-size: 0.6em; vertical-align: middle; background: var(--interactive-accent); color: var(--text-on-accent); padding: 2px 6px; border-radius: 4px; margin-left: 10px;' }
            });
        }

        platformEl.createEl('p', { text: platform.description });

        const instructionList = platformEl.createEl('ul');
        platform.instructions.forEach((inst: string) => {
            instructionList.createEl('li', { text: inst });
        });

        new Setting(platformEl)
            .addButton(btn => btn
                .setButtonText(`Set up on ${platform.name}`)
                .setCta()
                .onClick(async () => {
                    if (platform.configGenerator) {
                        await platform.configGenerator();
                    }
                    window.open(platform.url);
                }));
    }

    private async generateConfigFile(filename: string, content: string): Promise<void> {
        const projectRoot = this.getAbsoluteProjectRoot();
        if (!projectRoot) return;

        const filePath = path.join(projectRoot, filename);

        try {
            // Check if file already exists using Node fs
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

    private getProjectName(): string {
        const projectRoot = this.getAbsoluteProjectRoot();
        if (projectRoot) {
            return projectRoot.split(/[\\/]/).pop() || 'my-site';
        }
        return 'my-site';
    }

    validate(): boolean {
        return true;
    }

    getTitle(): string {
        return 'Deployment';
    }

    getDescription(): string {
        return 'Publish your site';
    }
}
