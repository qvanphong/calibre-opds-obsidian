import { Modal, App } from 'obsidian';
import { ConflictAction } from 'src/types';


export default class PDFConflictModal extends Modal {
    constructor(app: App, fileName: string, onResult: (action: ConflictAction) => void) {
        super(app);
        this.setTitle('File conflict');
        this.fileName = fileName;
        this.onResult = onResult;
    }
    fileName: string;
    onResult: (action: ConflictAction) => void;

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: `File "${this.fileName}" already exists. What do you want to do?` });
        const btnOpen = contentEl.createEl('button', { text: 'Open' });
        btnOpen.setAttr('style', 'background: var(--interactive-accent); color: var(--text-on-accent); margin-right: 8px;');


        const btnOverwrite = contentEl.createEl('button', { text: 'Overwrite' });
        const btnNewName = contentEl.createEl('button', { text: 'Create with different name' });
        const btnCancel = contentEl.createEl('button', { text: 'Cancel' });

        btnOpen.onclick = () => { this.close(); this.onResult('open'); };
        btnOverwrite.onclick = () => { this.close(); this.onResult('overwrite'); };
        btnNewName.onclick = () => { this.close(); this.onResult('newname') };
        btnCancel.onclick = () => { this.close(); this.onResult('cancel'); };
    }
    onClose() { this.contentEl.empty(); }
}