import { App, Setting, Notice, ButtonComponent } from 'obsidian';
import * as obsidian from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { GitManager } from '../../utils/GitManager';
import { ConfigFlushService } from '../../utils/ConfigFlushService';
import { SafeConfigWriter } from '../../utils/SafeConfigWriter';
import { resolveProjectRoot } from '../../utils/ProjectRootResolver';
import { DeploymentStep } from './DeploymentStep';
import * as path from 'path';

export class GitSetupStep extends BaseWizardStep {
    private gitManager: typeof GitManager;
    private configFlushService: ConfigFlushService;
    private safeConfigWriter: SafeConfigWriter;
    private pendingPat: string = ''; // In-memory only, never persisted

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
        this.gitManager = GitManager;
        this.configFlushService = new ConfigFlushService(app);
        this.safeConfigWriter = new SafeConfigWriter(app);
    }

    private getAbsoluteProjectRoot(): string | null {
        return resolveProjectRoot(this.app, this.state.projectDetection?.projectRoot || '.') ?? null;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Git Integration' });
        containerEl.createEl('p', {
            text: "Connect your project to GitHub to enable sync and deployment. Click \"Skip\" to set this up later.",
            attr: { style: 'font-style: italic; opacity: 0.8; margin-bottom: 2rem;' }
        });

        const projectRoot = this.getAbsoluteProjectRoot() ?? '';

        // 1. Static Layout Elements (Rendered Immediately)
        const rootInfo = containerEl.createDiv({ cls: 'git-root-info', attr: { style: 'margin-bottom: 1rem;' } });
        rootInfo.createEl('b', { text: 'Project Root: ' });
        rootInfo.createSpan({ text: projectRoot || '(not set)' });

        // Placeholder for dynamic status
        const statusEl = containerEl.createDiv({
            cls: 'git-status-message',
            attr: { style: 'margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; min-height: 50px;' }
        });
        statusEl.createEl('i', { text: 'Checking Git status...', attr: { style: 'opacity: 0.5;' } });

        // 2. Fetch data (Async)
        let isRepo = false;
        let remoteUrl: string | null = null;
        if (projectRoot) {
            isRepo = await this.gitManager.isRepo(projectRoot);
            if (isRepo) {
                remoteUrl = await this.gitManager.getRemoteUrl(projectRoot);
            }
        }

        // 3. Update Dynamic Layout
        statusEl.empty();
        if (isRepo) {
            statusEl.createEl('b', { text: 'Status: ' });
            statusEl.createSpan({
                text: 'Git is already initialized.',
                attr: { style: 'color: var(--text-success); font-weight: bold;' }
            });

            if (remoteUrl) {
                const remoteEl = statusEl.createDiv({ attr: { style: 'margin-top: 0.5rem;' } });
                remoteEl.createEl('b', { text: 'Remote: ' });
                remoteEl.createSpan({ text: remoteUrl });
            }
        } else {
            statusEl.createEl('b', { text: 'Status: ' });
            statusEl.createSpan({ text: 'Not a Git repository.' });
        }

        // Configuration Container
        const configContainer = containerEl.createDiv({ cls: 'git-config-container' });

        let setupContent: HTMLElement = configContainer;

        if (isRepo) {
            const details = configContainer.createEl('details', { attr: { style: 'margin-bottom: 2rem;' } });
            details.createEl('summary', {
                text: 'Update Settings',
                attr: { style: 'font-weight: bold; cursor: pointer; padding: 0.5rem 0; opacity: 0.8;' }
            });
            setupContent = details.createDiv({ attr: { style: 'padding: 1rem; border-left: 2px solid var(--background-modifier-border);' } });
        }


        const instructions = setupContent.createDiv({ cls: 'git-instructions' });
        instructions.createEl('p', {
            text: 'Connect your project to GitHub to publish your site. Click "Skip" to skip Git setup now and set it up later.'
        });

        const gitDownload = instructions.createEl('p');
        gitDownload.createSpan({ text: '1. ' });
        gitDownload.createEl('a', {
            text: 'Download and install Git',
            href: 'https://git-scm.com/'
        });

        const tokenLink = instructions.createEl('p');
        tokenLink.createSpan({ text: '2. ' });
        tokenLink.createEl('a', {
            text: 'Generate a new GitHub Personal access token',
            // Pre-checks both `repo` (for repo creation + push) and `workflow`
            // (required to push files under .github/workflows/, which most
            // modern Astro starters ship). Without `workflow`, the push fails
            // with "refusing to allow a Personal Access Token to update workflow".
            href: `https://github.com/settings/tokens/new?scopes=repo,workflow&description=${encodeURIComponent((this.state.gitConfig.repoName || 'Project') + ' (Vault CMS)')}`
        });

        const tokenHelp = instructions.createEl('ul');
        tokenHelp.createEl('li', { text: `Set a Note (like "${this.state.gitConfig.repoName || 'Project'} (Vault CMS)")` });
        tokenHelp.createEl('li', { text: 'Set Expiration to "No expiration"' });
        tokenHelp.createEl('li', { text: 'Check both the "repo" box AND the "workflow" box (the link above pre-checks them, required for Astro starters with GitHub Actions)' });
        tokenHelp.createEl('li', { text: 'Click "Generate token" at the bottom, copy it, and paste it below.' });

        if (!remoteUrl) {
            setupContent.createEl('h3', { text: isRepo ? 'Connect to GitHub' : 'Create New Repository' });
        } else {
            setupContent.createEl('h3', { text: 'Update GitHub Connection' });
        }

        // GitHub PAT Setting
        const patSetting = new Setting(setupContent)
            .setName('GitHub Personal Access Token')
            .setDesc('Stored securely in Obsidian Secrets.')
            .addExtraButton(btn => {
                btn.setIcon('link')
                    .setTooltip('Generate a new Personal access token on GitHub')
                    .onClick(() => {
                        const description = encodeURIComponent((this.state.gitConfig.repoName || 'Project') + ' (Vault CMS)');
                        window.open(`https://github.com/settings/tokens/new?scopes=repo,workflow&description=${description}`);
                    });
            });

        const secretId = 'vault-cms-github-pat';
        let secretValue = (this.app as any).secretStorage?.getSecret(secretId);

        // Ensure state is synced with secret storage on mount
        if (secretValue && !this.pendingPat) {
            // We don't want to "ghost" davidvkimball if it's stale
            // But if it's there, we keep it for the Sync button.
        }

        patSetting.addText(text => {
            text.setPlaceholder('ghp_xxxxxxxxxxxx')
                .setValue(secretValue ? '********' : '') // Show dots if we have a saved secret
                .onChange(value => {
                    this.pendingPat = value.trim();
                });
            text.inputEl.type = 'password';
        });

        const patStatus = setupContent.createDiv({ cls: 'pat-status-info', attr: { style: 'margin-bottom: 1rem; font-size: 0.9em; color: var(--text-muted);' } });
        if (secretValue) {
            patStatus.createSpan({ text: '✓ Linked to Obsidian Secret: ', attr: { style: 'color: var(--text-success); font-weight: bold;' } });
            patStatus.createSpan({ text: secretId });
        }

        patSetting.addButton(button => {
            button.setButtonText('Verify Token')
                .onClick(async () => {
                    // 1. Resolve Token
                    let token = this.pendingPat;

                    // If the field is blank, contains dots, or the ID string, pull from storage
                    if (!token || token === '********' || token === 'vault-cms-github-pat') {
                        token = (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');
                    }

                    if (!token) {
                        new Notice('Please enter or paste your GitHub Personal Access Token.');
                        return;
                    }
                    button.setDisabled(true);
                    button.setButtonText('Verifying...');

                    patStatus.empty();
                    try {
                        const verified = await this.gitManager.verifyToken(token);
                        if (verified && verified.login) {
                            const username = verified.login;
                            new Notice(`Token verified successfully as ${username}!`);
                            patStatus.createSpan({ text: `✓ Verified as `, attr: { style: 'color: var(--text-success);' } });
                            patStatus.createEl('b', { text: username });

                            // Classic PAT → scopes are reported. Fine-grained PATs report no
                            // scopes (length 0) — skip validation in that case and let the
                            // push-time error surface any missing permission.
                            const scopes = verified.scopes;
                            if (scopes.length > 0 && !scopes.includes('workflow')) {
                                const description = encodeURIComponent((this.state.gitConfig.repoName || 'Project') + ' (Vault CMS)');
                                const regenLink = `https://github.com/settings/tokens/new?scopes=repo,workflow&description=${description}`;
                                patStatus.createEl('br');
                                const warn = patStatus.createSpan({
                                    text: '⚠ Token is missing the `workflow` scope. ',
                                    attr: { style: 'color: var(--text-warning); display: inline-block; margin-top: 0.4rem;' },
                                });
                                warn.createEl('a', {
                                    text: 'Regenerate with `repo` + `workflow`',
                                    href: regenLink,
                                });
                                warn.appendChild(document.createTextNode(
                                    '. Required to push GitHub Actions files (`.github/workflows/*.yml`) that most Astro starters ship with.'
                                ));
                                new Notice(
                                    'Token verified, but it is missing the `workflow` scope. ' +
                                    'Regenerate with both `repo` and `workflow` checked, or the initial push will fail.'
                                );
                            }

                            if ((this.app as any).secretStorage) {
                                await (this.app as any).secretStorage.setSecret('vault-cms-github-pat', token);
                            }
                            // Use standard localStorage directly if this.app.saveLocalStorage is missing/broken
                            try {
                                (this.app as any).saveLocalStorage('obsidian-git:username', username);
                            } catch (e) {
                                localStorage.setItem('obsidian-git:username', username);
                            }
                            this.state.gitConfig.enabled = true;
                            button.setButtonText('Verified');
                            button.buttonEl.style.backgroundColor = 'var(--interactive-accent)';
                            button.buttonEl.style.color = 'var(--text-on-accent)';
                        } else {
                            new Notice('Invalid token or GitHub API error.');
                            patStatus.createSpan({ text: '✗ Invalid token or GitHub API error.', attr: { style: 'color: var(--text-error);' } });
                            button.setButtonText('Verify Token');
                            button.setDisabled(false);
                        }
                    } catch (e) {
                        new Notice('Verification failed. Check your connection.');
                        patStatus.createSpan({ text: '✗ Verification failed. Check your connection.', attr: { style: 'color: var(--text-error);' } });
                        button.setButtonText('Verify Token');
                        button.setDisabled(false);
                    }
                });
        });

        // Repo creation settings
        new Setting(setupContent)
            .setName(remoteUrl ? 'New Repository Name' : 'Repository Name')
            .setDesc('The name of your GitHub repository.')
            .addText(text => {
                const defaultName = projectRoot ? projectRoot.split(/[\\/]/).pop() : '';
                const initialValue = this.state.gitConfig.repoName || defaultName || '';

                // Proactively set the state so it's not empty if the user doesn't change it
                if (!this.state.gitConfig.repoName) {
                    this.state.gitConfig.repoName = initialValue;
                }

                text.setPlaceholder('my-blog')
                    .setValue(initialValue)
                    .onChange(value => {
                        this.state.gitConfig.repoName = value.trim();
                    });
            });

        new Setting(setupContent)
            .setName('Description')
            .setDesc('A short description for your repository.')
            .addText(text => {
                text.setPlaceholder('My personal blog')
                    .setValue(this.state.gitConfig.repoDescription || '')
                    .onChange(value => {
                        this.state.gitConfig.repoDescription = value.trim();
                    });
            });

        new Setting(setupContent)
            .setName('Private Repository')
            .setDesc('Keep this repository private and hidden from the public.')
            .addToggle(toggle => {
                toggle.setValue(this.state.gitConfig.isPrivate)
                    .onChange(value => {
                        this.state.gitConfig.isPrivate = value;
                    });
            });

        // Branch Name
        new Setting(setupContent)
            .setName('Default Branch')
            .setDesc('The name of the initial branch ("main" or "master").')
            .addText(text => {
                const initialBranch = this.state.gitConfig.branchName || 'main';
                if (!this.state.gitConfig.branchName) {
                    this.state.gitConfig.branchName = initialBranch;
                }
                text.setPlaceholder('main')
                    .setValue(initialBranch)
                    .onChange(value => {
                        this.state.gitConfig.branchName = value.trim() || 'main';
                    });
            });

        // Auto-configure obsidian-git
        new Setting(setupContent)
            .setName('Auto-configure Git plugin')
            .setDesc('Automatically set up the "Git" plugin to work with this project.')
            .addToggle(toggle => {
                toggle.setValue(this.state.gitConfig.autoConfigureObsidianGit)
                    .onChange(value => {
                        this.state.gitConfig.autoConfigureObsidianGit = value;
                    });
            });

        // Action Button
        const actionContainer = setupContent.createDiv({ cls: 'git-action-container', attr: { style: 'margin-top: 2rem;' } });
        let buttonText = isRepo ? (remoteUrl ? 'Update Remote & Push' : 'Connect to GitHub') : 'Initialize & Push to GitHub';

        const createBtn = new ButtonComponent(actionContainer)
            .setButtonText(buttonText)
            .setCta()
            .onClick(async () => {
                await this.handleGitSetup(createBtn, isRepo, !!remoteUrl);
            });

        configContainer.createEl('p', {
            cls: 'git-skip-info',
            attr: { style: 'font-size: 0.8em; color: var(--text-muted); margin-top: 1rem; border-top: 1px solid var(--background-modifier-border); padding-top: 1rem;' },
            text: 'Click "Skip" to skip Git setup.'
        });
    }


    private hasAdvanced = false;

    private async handleGitSetup(button: ButtonComponent, alreadyRepo: boolean, alreadyHasRemote: boolean) {
        if (this.hasAdvanced) return;

        let pat = this.pendingPat;
        const { repoName, repoDescription, isPrivate, branchName } = this.state.gitConfig;
        const projectRoot = this.getAbsoluteProjectRoot();
        const branch = branchName || 'main';

        // 1. Resolve Token: pending input -> Secret Storage -> Null
        if (!pat || pat === '********' || pat === 'vault-cms-github-pat') {
            pat = (this.app as any).secretStorage?.getSecret('vault-cms-github-pat') || pat;
        }

        const token = pat;

        if (!token || token === '********' || token === 'vault-cms-github-pat' || !projectRoot) {
            new Notice('Please provide a valid Token and ensure project root is detected.');
            button.setDisabled(false);
            return;
        }

        if (!alreadyHasRemote && !repoName) {
            new Notice('Please provide a Repository Name.');
            button.setDisabled(false);
            return;
        }

        button.setDisabled(true);
        button.setButtonText(alreadyHasRemote ? 'Updating...' : 'Initializing...');

        try {
            // 1. Git Init (only if not already a repo)
            if (!alreadyRepo) {
                await this.gitManager.initRepo(projectRoot);
                new Notice('Local Git repository initialized.');
            }

            // 2. Create GitHub Repo & Set Remote
            // If already has remote, we create a NEW repo and UPDATE the remote
            new Notice(alreadyHasRemote ? 'Creating new GitHub repository...' : 'Creating GitHub repository...');
            const repoInfo = await this.gitManager.createGitHubRepo(token, repoName!, repoDescription || '', isPrivate);

            await this.gitManager.setRemote(projectRoot, repoInfo.clone_url);
            new Notice(`Successfully ${alreadyHasRemote ? 'updated' : 'connected'} to ${repoInfo.html_url}`);

            // 3. Early Flush: Save configurations to disk BEFORE committing
            // This ensures the initial commit contains the user's wizard settings
            try {
                await this.configFlushService.flush(this.state);
                console.debug('GitSetupStep: Early configuration flush successful');
            } catch (flushError) {
                console.warn('GitSetupStep: Early configuration flush failed, but continuing with sync:', flushError);
            }

            // Initial commit + push. Any failure here propagates to the outer
            // catch so the wizard surfaces the real error to the user instead
            // of silently advancing to a "Success!" state with an empty remote.
            await this.gitManager.initialCommitAndPush(projectRoot, branch, 'origin', token);
            new Notice('Successfully synced with GitHub!');

            // Align GitHub's default branch with the branch the user typed —
            // otherwise an empty `main` placeholder branch ends up the default
            // when the user picked `master` (or any custom name), and Netlify
            // auto-deploys the empty branch.
            try {
                await this.gitManager.setDefaultBranch(token, repoInfo.full_name, branch);
                console.debug(`GitSetupStep: Set default branch on ${repoInfo.full_name} to ${branch}`);
            } catch (defaultBranchError) {
                // Non-fatal: push already succeeded, the repo has content. Worst
                // case the user has to flip the default branch manually on GitHub.
                console.warn('GitSetupStep: Could not set default branch on GitHub:', defaultBranchError);
                new Notice(
                    `Pushed to GitHub, but could not set "${branch}" as the default branch. ` +
                    `You may need to change the default branch manually in repo settings.`
                );
            }

            // 4. Configure Obsidian Git
            if (this.state.gitConfig.autoConfigureObsidianGit) {
                await this.configureObsidianGit(token, projectRoot, branch);
            }

            // 5. Securely save token if it was just entered
            if (pat && (this.app as any).secretStorage) {
                await (this.app as any).secretStorage.setSecret('vault-cms-github-pat', pat);
            }

            // Clear plain-text PAT from state before finishing
            this.pendingPat = '';

            this.state.gitConfig.enabled = true;
            button.setButtonText('Success!');
            new Notice('Git setup complete!');

            // Show deploy button if a platform was selected
            const selectedPlatform = (this.state as any).deploymentPlatform as string || '';
            if (selectedPlatform) {
                const platformName = DeploymentStep.getPlatformName(selectedPlatform);
                const deployUrl = DeploymentStep.getDeployUrl(selectedPlatform);
                if (platformName && deployUrl) {
                    const deployContainer = this.containerEl.createDiv({ attr: { style: 'margin-top: 1.5rem; padding: 1rem; border: 1px solid var(--interactive-accent); border-radius: 8px; text-align: center;' } });
                    deployContainer.createEl('p', { text: `Your code has been pushed. Connect your repo to ${platformName} to go live.` });
                    new Setting(deployContainer)
                        .addButton(btn => btn
                            .setButtonText(`Deploy on ${platformName}`)
                            .setCta()
                            .onClick(() => {
                                window.open(deployUrl);
                            }));
                }
            }

            // Auto-advance after delay if no platform selected
            if (!this.hasAdvanced) {
                this.hasAdvanced = true;
                if (!selectedPlatform) {
                    setTimeout(() => this.onNext(), 1500);
                }
            }

        } catch (error) {
            console.error('Git integration failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            new Notice(`Setup failed: ${errorMessage}`);
            button.setDisabled(false);
            button.setButtonText(alreadyHasRemote ? 'Update Settings & Sync' : 'Initialize & Push to GitHub');
        }
    }

    private async configureObsidianGit(pat: string, projectRoot: string, branch: string) {
        console.debug('GitSetupStep: Configuring Obsidian Git plugin...');

        // 1. Set credentials in localStorage (standard fallback for Obsidian Git)
        try {
            (this.app as any).saveLocalStorage('obsidian-git:password', pat);
        } catch (e) {
            localStorage.setItem('obsidian-git:password', pat);
        }

        const adapter = this.app.vault.adapter as any;
        const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : '';

        if (vaultRoot && projectRoot) {
            // Ensure projectRoot is absolute for comparison
            const absoluteProjectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(vaultRoot, projectRoot);
            const relativePath = path.relative(vaultRoot, absoluteProjectRoot).replace(/\\/g, '/');

            const configUpdates: Record<string, any> = {
                basePath: relativePath || '',
                gitRemote: 'origin',
                remoteName: 'origin', // Some versions use this
                mainBranch: branch,
                branch: branch,       // Some versions use this
                currentRemote: 'origin'
            };

            // 2. Update settings in-memory if the plugin is already loaded
            // This is the most reliable way to prevent prompts from a running plugin
            const gitPlugin = (this.app as any).plugins?.getPlugin('obsidian-git');
            if (gitPlugin) {
                console.debug('GitSetupStep: Found running Obsidian Git plugin, updating in-memory settings');
                gitPlugin.settings = {
                    ...gitPlugin.settings,
                    ...configUpdates
                };
                if (typeof gitPlugin.saveSettings === 'function') {
                    await gitPlugin.saveSettings();
                }
            }

            // 3. Always merge/write to data.json as a persistent fallback
            // We use mergeConfig which handles it even if data.json doesn't exist yet
            await this.safeConfigWriter.mergeConfig('obsidian-git', configUpdates);
        }

        new Notice('Obsidian Git plugin configured.');
    }

    validate(): boolean {
        return true; // Optional step
    }

    getTitle(): string {
        return 'Git Integration';
    }

    getDescription(): string {
        return 'Connect to GitHub';
    }
}
