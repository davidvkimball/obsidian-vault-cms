import { App } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';

export class WelcomeStep extends BaseWizardStep {
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Welcome to Vault CMS Setup' });
		containerEl.createEl('p', { 
			text: 'This wizard will help you configure your Vault CMS setup. We\'ll guide you through:' 
		});

		const list = containerEl.createEl('ul');
		list.createEl('li', { text: 'Detecting your Astro project structure' });
		list.createEl('li', { text: 'Identifying your content types' });
		list.createEl('li', { text: 'Mapping frontmatter properties' });
		list.createEl('li', { text: 'Configuring plugins and themes' });
		list.createEl('li', { text: 'Setting up Bases CMS views' });
		list.createEl('li', { text: 'Configuring Astro Composer and SEO plugins' });

		containerEl.createEl('p', { 
			text: 'Click "Next" to begin the setup process.' 
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

