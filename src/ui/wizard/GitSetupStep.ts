import { App, Setting, Notice, ButtonComponent } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { GitManager } from '../../utils/GitManager';
import { SafeConfigWriter } from '../../utils/SafeConfigWriter';
import * as path from 'path';

export class GitSetupStep extends BaseWizardStep {
    private gitManager: typeof GitManager;
    private safeConfigWriter: SafeConfigWriter;

    constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
        super(app, containerEl, state, onNext, onBack, onCancel);
        this.gitManager = GitManager;
        this.safeConfigWriter = new SafeConfigWriter(app);
    }

    private getAbsoluteProjectRoot(): string {
        const relativeRoot = this.state.projectDetection?.projectRoot || '.';
        if (path.isAbsolute(relativeRoot)) {
            return relativeRoot;
        }

        const adapter = this.app.vault.adapter as any;
        const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : '';
        return path.resolve(vaultRoot, relativeRoot);
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Git Integration (Optional)' });

        const projectRoot = this.getAbsoluteProjectRoot();
        let isRepo = false;
        let remoteUrl: string | null = null;

        if (projectRoot) {
            isRepo = await this.gitManager.isRepo(projectRoot);
            if (isRepo) {
                remoteUrl = await this.gitManager.getRemoteUrl(projectRoot);

                const rootInfo = containerEl.createDiv({ cls: 'git-root-info', attr: { style: 'margin-bottom: 1rem;' } });
                rootInfo.createEl('b', { text: 'Project Root: ' });
                rootInfo.createSpan({ text: projectRoot });

                const statusEl = containerEl.createDiv({
                    cls: 'git-status-message',
                    attr: { style: 'margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--background-modifier-border); border-radius: 4px;' }
                });
                statusEl.createEl('b', { text: 'Status: ' });
                statusEl.createSpan({ text: 'Git is already initialized.' });

                if (remoteUrl) {
                    const remoteEl = statusEl.createDiv({ attr: { style: 'margin-top: 0.5rem;' } });
                    remoteEl.createEl('b', { text: 'Remote: ' });
                    remoteEl.createSpan({ text: remoteUrl });
                }
            }
        }

        // Configuration Container (hide if remote exists)
        const configContainer = containerEl.createDiv({ cls: 'git-config-container' });
        if (isRepo && remoteUrl) {
            configContainer.hide();

            // Re-label the skip info slightly to be more proactive
            containerEl.createEl('p', {
                cls: 'git-skip-info',
                attr: { style: 'font-size: 0.8em; color: var(--text-muted); margin-top: 1rem; border-top: 1px solid var(--background-modifier-border); padding-top: 1rem;' },
                text: 'Git is already configured. Click "Next" to continue to the final step.'
            });
        } else {
            const instructions = configContainer.createDiv({ cls: 'git-instructions' });
            instructions.createEl('p', {
                text: 'Connect your project to GitHub to publish your site. You can skip this and set it up later or if you already set it up.'
            });

            const tokenLink = instructions.createEl('p');
            tokenLink.createSpan({ text: '1. ' });
            tokenLink.createEl('a', {
                text: 'Generate a new GitHub Personal Access Token',
                href: 'https://github.com/settings/tokens/new'
            });

            const tokenHelp = instructions.createEl('ul');
            tokenHelp.createEl('li', { text: 'Set a Note (e.g., "My blog")' });
            tokenHelp.createEl('li', { text: 'Set Expiration to "No expiration"' });
            tokenHelp.createEl('li', { text: 'Check the "repo" box (so all top options are selected)' });
            tokenHelp.createEl('li', { text: 'Click "Generate token" at the bottom, copy it, and paste it below.' });

            if (!remoteUrl) {
                configContainer.createEl('h3', { text: isRepo ? 'Connect to GitHub' : 'Create New Repository' });
            }

            // GitHub PAT Setting
            const patSetting = new Setting(configContainer)
                .setName('GitHub Personal Access Token')
                .setDesc('Stored securely in Obsidian Secrets.')
                .addText(text => {
                    const savedSecret = (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');
                    text.setPlaceholder('ghp_xxxxxxxxxxxx')
                        .setValue(this.state.gitConfig.pat || savedSecret || '')
                        .onChange(value => {
                            this.state.gitConfig.pat = value.trim();
                        });
                    text.inputEl.type = 'password';
                });

            patSetting.addButton(button => {
                button.setButtonText('Verify Token')
                    .onClick(async () => {
                        const token = this.state.gitConfig.pat || (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');
                        if (!token) {
                            new Notice('Please enter a token first.');
                            return;
                        }
                        button.setDisabled(true);
                        button.setButtonText('Verifying...');

                        try {
                            const username = await this.gitManager.verifyToken(token);
                            if (username) {
                                new Notice(`Token verified successfully as ${username}!`);
                                if ((this.app as any).secretStorage) {
                                    (this.app as any).secretStorage.setSecret('vault-cms-github-pat', token);
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
                                button.setButtonText('Verify Token');
                                button.setDisabled(false);
                            }
                        } catch (e) {
                            new Notice('Verification failed. Check your connection.');
                            button.setButtonText('Verify Token');
                            button.setDisabled(false);
                        }
                    });
            });

            // Repo creation settings (if no remote yet)
            if (!remoteUrl) {
                new Setting(configContainer)
                    .setName('Repository Name')
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

                new Setting(configContainer)
                    .setName('Description')
                    .setDesc('A short description for your repository.')
                    .addText(text => {
                        text.setPlaceholder('My personal blog')
                            .setValue(this.state.gitConfig.repoDescription || '')
                            .onChange(value => {
                                this.state.gitConfig.repoDescription = value.trim();
                            });
                    });

                new Setting(configContainer)
                    .setName('Private Repository')
                    .setDesc('Keep this repository private and hidden from the public.')
                    .addToggle(toggle => {
                        toggle.setValue(this.state.gitConfig.isPrivate)
                            .onChange(value => {
                                this.state.gitConfig.isPrivate = value;
                            });
                    });
            }

            // Branch Name
            new Setting(configContainer)
                .setName('Default Branch')
                .setDesc('The name of the initial branch (e.g., "main" or "master").')
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
            new Setting(configContainer)
                .setName('Auto-configure Git plugin')
                .setDesc('Automatically set up the "Git" plugin to work with this project.')
                .addToggle(toggle => {
                    toggle.setValue(this.state.gitConfig.autoConfigureObsidianGit)
                        .onChange(value => {
                            this.state.gitConfig.autoConfigureObsidianGit = value;
                        });
                });

            // Action Button
            const actionContainer = configContainer.createDiv({ cls: 'git-action-container', attr: { style: 'margin-top: 2rem;' } });
            let buttonText = isRepo ? 'Connect to GitHub' : 'Initialize & Push to GitHub';

            const createBtn = new ButtonComponent(actionContainer)
                .setButtonText(buttonText)
                .setCta()
                .onClick(async () => {
                    await this.handleGitSetup(createBtn, isRepo, !!remoteUrl);
                });

            configContainer.createEl('p', {
                cls: 'git-skip-info',
                attr: { style: 'font-size: 0.8em; color: var(--text-muted); margin-top: 1rem; border-top: 1px solid var(--background-modifier-border); padding-top: 1rem;' },
                text: 'Click "Next" to skip Git setup or if you already have it manually configured.'
            });
        }
    }

    private hasAdvanced = false;

    private async handleGitSetup(button: ButtonComponent, alreadyRepo: boolean, alreadyHasRemote: boolean) {
        if (this.hasAdvanced) return;

        const { pat, repoName, repoDescription, isPrivate, branchName } = this.state.gitConfig;
        const projectRoot = this.getAbsoluteProjectRoot();
        const branch = branchName || 'main';

        // Try to get token from secret storage if not provided for this run
        const token = pat || (this.app as any).secretStorage?.getSecret('vault-cms-github-pat');

        if (!token || !projectRoot) {
            new Notice('Please provide a Token and ensure project root is detected.');
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

            // 2. Create GitHub Repo & Set Remote (only if no remote)
            if (!alreadyHasRemote) {
                new Notice('Creating GitHub repository...');
                const repoInfo = await this.gitManager.createGitHubRepo(token, repoName!, repoDescription || '', isPrivate);

                await this.gitManager.setRemote(projectRoot, repoInfo.clone_url);
                new Notice(`Successfully connected to ${repoInfo.html_url}`);
            }

            // 3. Initial Commit and Push (always good to sync if we're here)
            new Notice(`Syncing with ${branch}...`);
            await this.gitManager.initialCommitAndPush(projectRoot, branch);
            new Notice('Successfully synced with GitHub!');

            // 4. Configure Obsidian Git
            if (this.state.gitConfig.autoConfigureObsidianGit) {
                await this.configureObsidianGit(token, projectRoot);
            }

            // 5. Securely save token if it was just entered
            if (pat && (this.app as any).secretStorage) {
                (this.app as any).secretStorage.setSecret('vault-cms-github-pat', pat);
            }

            // Clear plain-text PAT from state before finishing
            this.state.gitConfig.pat = '';

            this.state.gitConfig.enabled = true;
            button.setButtonText('Success!');
            new Notice('Git setup complete!');

            // Auto-advance after small delay
            if (!this.hasAdvanced) {
                this.hasAdvanced = true;
                setTimeout(() => this.onNext(), 1500);
            }

        } catch (error) {
            console.error('Git integration failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            new Notice(`Setup failed: ${errorMessage}`);
            button.setDisabled(false);
            button.setButtonText(alreadyHasRemote ? 'Update Settings & Sync' : 'Initialize & Push to GitHub');
        }
    }

    private async configureObsidianGit(pat: string, projectRoot: string) {
        // Set PAT in localStorage (with fallback)
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
                basePath: relativePath
            };

            const currentGitConfig = await this.safeConfigWriter.readConfig('obsidian-git');
            if (currentGitConfig) {
                await this.safeConfigWriter.mergeConfig('obsidian-git', configUpdates);
            }
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
