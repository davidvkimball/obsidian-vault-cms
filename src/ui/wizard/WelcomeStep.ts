import { BaseWizardStep } from './BaseWizardStep';

/**
 * Helper function for setCssProps
 */
function setCssProps(element: HTMLElement, props: Record<string, string>): void {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
	}
}

interface ObsidianSetting {
	open(): void;
	openTabById(id: string): void;
}

interface ObsidianAppWithSetting {
	setting: ObsidianSetting;
}

export class WelcomeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		containerEl.createEl('h2', { text: 'Welcome to Vault CMS' });
		containerEl.createEl('p', { 
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text: 'This wizard will help you configure Vault CMS for your project. We\'ll guide you through:' 
		});

		const list = containerEl.createEl('ul');
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Detecting your Astro project structure' });
		list.createEl('li', { text: 'Identifying your content types' });
		list.createEl('li', { text: 'Mapping frontmatter properties' });
		list.createEl('li', { text: 'Configuring plugins and themes' });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Setting up Home Base content views' });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		list.createEl('li', { text: 'Configuring Astro Composer and SEO plugins' });

		containerEl.createEl('p', { 
			text: 'Choose an option to continue:' 
		});

		const buttonContainer = containerEl.createDiv('wizard-welcome-buttons');
		setCssProps(buttonContainer, {
			display: 'flex',
			gap: '10px',
			marginTop: '20px'
		});

		const getStartedBtn = buttonContainer.createEl('button', {
			text: 'Get started',
			cls: 'mod-button mod-cta'
		});
		getStartedBtn.addEventListener('click', () => {
			this.onNext();
		});

		const selectPresetBtn = buttonContainer.createEl('button', {
			text: 'Select preset',
			cls: 'mod-button'
		});
		selectPresetBtn.addEventListener('click', () => {
			// Close modal and open settings tab
			this.onCancel();
			
			const appWithSetting = this.app as unknown as ObsidianAppWithSetting;
			if (appWithSetting.setting && typeof appWithSetting.setting.open === 'function') {
				appWithSetting.setting.open();
				if (typeof appWithSetting.setting.openTabById === 'function') {
					appWithSetting.setting.openTabById('vault-cms');
				}
			}
		});
	}

	validate(): boolean {
		return true;
	}

	getTitle(): string {
		return 'Welcome';
	}

	getDescription(): string {
		return 'Introduction to Vault CMS setup';
	}
}
