import { App, Modal, Setting } from 'obsidian';

export class ApplyPresetModal extends Modal {
	private onConfirm: (deleteBackup: boolean) => void;
	private backupPath: string;

	constructor(app: App, backupPath: string, onConfirm: (deleteBackup: boolean) => void) {
		super(app);
		this.backupPath = backupPath;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Preset applied successfully' });
		contentEl.createEl('p', { text: 'The preset has been applied successfully. You need to reload Obsidian for all changes to take effect.' });
		contentEl.createEl('p', { text: `A backup of your original configuration folder was created at: ${this.backupPath}` });

		new Setting(contentEl)
			.setName('Delete backup and reload')
			.setDesc('Remove the backup folder and reload Obsidian. This is the recommended "clean" option.')
			.addButton((button: any) => button
				.setButtonText('Delete and reload')
				.setCta()
				.onClick(() => {
					this.close();
					this.onConfirm(true);
				}));

		new Setting(contentEl)
			.setName('Keep backup and reload')
			.setDesc('Keep the backup folder for safety and reload Obsidian.')
			.addButton((button: any) => button
				.setButtonText('Keep and reload')
				.onClick(() => {
					this.close();
					this.onConfirm(false);
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
