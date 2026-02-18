import { App, Setting, Notice } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { GitManager } from '../../utils/GitManager';
import * as path from 'path';

export class DeploymentStep extends BaseWizardStep {
    private remoteUrl: string | null = null;

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
        this.showNextButton = false;
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
        const projectRoot = this.state.projectDetection?.projectRoot;
        if (projectRoot) {
            this.remoteUrl = await GitManager.getRemoteUrl(projectRoot);
        }
        return !this.remoteUrl;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Deployment Setup' });
        containerEl.createEl('p', {
            text: "Your site is ready to be published! Choose a deployment platform to host your Astro site. Select 'skip' if you've already set this up."
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
        const projectRoot = this.state.projectDetection?.projectRoot;
        if (projectRoot) {
            this.remoteUrl = await GitManager.getRemoteUrl(projectRoot);
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
            ]
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
            ]
        });

        // Cloudflare
        this.renderPlatform(platformContainer, {
            name: 'Cloudflare',
            description: 'Host your site on Cloudflare Pages or Workers.',
            url: this.getCloudflareDeployUrl(),
            instructions: [
                `Framework Preset: Astro`,
                `Root Directory: ${instructions.rootDir}`,
                `Build Command: ${instructions.buildCommand}`,
                `Output Directory: ${instructions.outputDir}`
            ]
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
        if (this.remoteUrl) {
            return `https://vercel.com/new/clone?repository-url=${encodeURIComponent(this.remoteUrl)}`;
        }
        return 'https://vercel.com/new';
    }

    private getCloudflareDeployUrl(): string {
        if (this.remoteUrl) {
            return `https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(this.remoteUrl)}`;
        }
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

    private renderPlatform(container: HTMLElement, platform: any) {
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
                .onClick(() => window.open(platform.url)));
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
