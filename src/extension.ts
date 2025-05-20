import * as vscode from 'vscode';

// PCG Grammar Formatter Class
class PCGFormatter {
	private indentSize: number;
	private indentLevel: number;

	constructor(indentSize: number = 2) {
		this.indentSize = indentSize;
		this.indentLevel = 0;
	}

	format(grammarString: string): string {
		// Reset indent level for each format operation
		this.indentLevel = 0;

		let input = grammarString.trim();
		let result = '';
		let i = 0;

		while (i < input.length) {
			const char = input[i];

			switch (char) {
				case '<':
				case '[':
				case '{':
					// Opening bracket - add it and increase indent
					result += this.getIndent() + char + '\n';
					this.indentLevel++;
					break;

				case '>':
				case ']':
				case '}':
					// Closing bracket - decrease indent and add it
					this.indentLevel--;
					result += this.getIndent() + char;

					// Check if there's a comma after closing bracket
					if (i + 1 < input.length && input[i + 1] === ',') {
						result += ',';
						i++; // Skip the comma since we already added it

						// Only add newline if there's content after the comma
						if (i + 1 < input.length && input[i + 1] !== ' ' && input[i + 1] !== ',' && input[i + 1] !== '>') {
							result += '\n';
						}
					} else if (i + 1 < input.length && input[i + 1] !== ' ' && input[i + 1] !== ',') {
						result += '\n';
					}
					break;

				case ',':
					// Comma - just add it without newline
					result += ',\n';
					break;

				case ' ':
					// Skip spaces (we'll add our own formatting)
					break;

				default:
					// Regular content - collect until we hit a special character
					let content = '';
					while (i < input.length && !'<>[]{}(), '.includes(input[i])) {
						content += input[i];
						i++;
					}
					i--; // Back up one since we'll increment at the end of the loop

					if (content) {
						result += this.getIndent() + content;

						// Check what comes next to decide formatting
						if (i + 1 < input.length) {
							const nextChar = input[i + 1];
							// Only add newline before opening brackets, not after commas
							if ('<[{('.includes(nextChar)) {
								result += '\n';
							}
						}
					}
					break;
			}
			i++;
		}

		return this.cleanupResult(result);
	}

	private getIndent(): string {
		return ' '.repeat(this.indentLevel * this.indentSize);
	}

	private cleanupResult(result: string): string {
		// Clean up extra newlines and formatting issues
		return result
			.split('\n')
			.map(line => line.trimRight())
			.filter(line => {
				// Remove empty lines
				return line.trim() !== '';
			})
			.join('\n')
			.trim();
	}
}

// Extension activation
export function activate(context: vscode.ExtensionContext) {
	// Create status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	context.subscriptions.push(statusBarItem);

	// Register the format command
	const formatCommand = vscode.commands.registerCommand('pcg-formatter.format', () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const document = editor.document;
		const selection = editor.selection;

		try {
			// Get text to format
			let textToFormat: string;
			let range: vscode.Range;

			if (selection.isEmpty) {
				// No selection - format entire document
				textToFormat = document.getText();
				range = new vscode.Range(
					document.positionAt(0),
					document.positionAt(textToFormat.length)
				);
			} else {
				// Format selected text
				textToFormat = document.getText(selection);
				range = selection;
			}

			// Create formatter and format text
			const formatter = new PCGFormatter(2); // 2-space indent
			const formattedText = formatter.format(textToFormat);

			// Apply the formatting
			editor.edit(editBuilder => {
				editBuilder.replace(range, formattedText);
			}).then(success => {
				if (success) {
					// Show success in status bar
					statusBarItem.text = '$(check) PCG Formatted';
					statusBarItem.show();

					// Hide status after 2 seconds
					setTimeout(() => {
						statusBarItem.hide();
					}, 2000);

					vscode.window.showInformationMessage('PCG Grammar formatted successfully!');
				} else {
					vscode.window.showErrorMessage('Failed to format PCG Grammar');
				}
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error formatting PCG Grammar: ${error}`);
			console.error('PCG Formatter Error:', error);
		}
	});

	context.subscriptions.push(formatCommand);

	// Show activation message
	console.log('PCG Grammar Formatter extension is now active!');
}

// Extension deactivation
export function deactivate() {
	console.log('PCG Grammar Formatter extension is now deactivated!');
}