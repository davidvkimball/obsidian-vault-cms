import { App, Setting } from 'obsidian';
import { BaseWizardStep } from './BaseWizardStep';
import { WizardState } from '../../types';
import { ProjectDetector } from '../../utils/ProjectDetector';

export class ProjectDetectionStep extends BaseWizardStep {
	private projectDetector: ProjectDetector;
	private detected: boolean = false;

	constructor(app: App, containerEl: HTMLElement, state: WizardState, onNext: () => void, onBack: () => void, onCancel: () => void) {
		super(app, containerEl, state, onNext, onBack, onCancel);
		this.projectDetector = new ProjectDetector(app);
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Project Detection' });
		containerEl.createEl('p', { 
			text: 'Detecting your Astro project structure...' 
		});

		const result = await this.projectDetector.detectProject();
		
		if (result) {
			this.state.projectDetection = result;
			this.detected = true;

			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project Detected' });
			
			new Setting(containerEl)
				.setName('Project Root')
				.setDesc(result.projectRoot)
				.addText(text => text.setValue(result.projectRoot).setDisabled(true));

			new Setting(containerEl)
				.setName('Config File')
				.setDesc(result.configFilePath)
				.addText(text => text.setValue(result.configFilePath).setDisabled(true));

			containerEl.createEl('p', { 
				text: 'Project structure detected successfully. Click "Next" to continue.' 
			});
		} else {
			containerEl.empty();
			containerEl.createEl('h2', { text: 'Project Detection Failed' });
			containerEl.createEl('p', { 
				text: 'Could not detect Astro project structure. Please ensure you are in an Astro project directory.' 
			});

			new Setting(containerEl)
				.setName('Project Root')
				.setDesc('Enter the path to your Astro project root')
				.addText(text => text
					.setPlaceholder('e.g., /path/to/project')
					.onChange(value => {
						if (!this.state.projectDetection) {
							this.state.projectDetection = {
								projectRoot: value,
								configFilePath: '',
								vaultLocation: 'root'
							};
						} else {
							this.state.projectDetection.projectRoot = value;
						}
					}));

			new Setting(containerEl)
				.setName('Config File')
				.setDesc('Enter the path to your Astro config file')
				.addText(text => text
					.setPlaceholder('e.g., astro.config.ts')
					.onChange(value => {
						if (!this.state.projectDetection) {
							this.state.projectDetection = {
								projectRoot: '',
								configFilePath: value,
								vaultLocation: 'root'
							};
						} else {
							this.state.projectDetection.configFilePath = value;
						}
					}));
		}
	}

	validate(): boolean {
		return this.detected || (!!this.state.projectDetection?.projectRoot && !!this.state.projectDetection?.configFilePath);
	}

	getTitle(): string {
		return 'Project Detection';
	}

	getDescription(): string {
		return 'Detect Astro project structure';
	}
}

