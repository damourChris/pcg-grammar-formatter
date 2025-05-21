# PCG Grammar Formatter

## Description

[PCG Grammar](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-shape-grammar-with-pcg-in-unreal-engine) is a domain-specific language (DSL) for defining grammars available in Unreal Engine 5. 

These grammars are used to generate procedural content, such as levels, assets, and other game elements. As these grammars can become complex and difficult to read, the PCG Grammar Formatter extension for Visual Studio Code provides a way to format and beautify these grammars, making them easier to understand and work with.

## Features

- **Format PCG Grammar**: The extension provides a command to format PCG Grammar, making them more readable and consistent.
- **Syntax Highlighting**: Syntax highlighting for PCG Grammar, providing visual cues for different modules. 
- **Code Snippets**: Code snippets for common PCG Grammar constructs
- **Error Checking**: Error checking for PCG Grammar files,finding uncomplete or incorrect grammar definitions.

## Futures Features

- [ ]  **Unreal Engine Integration**: Integration with Unreal Engine to provide real-time feedback and validation of PCG Grammar files.

<!-- \!\[feature X\]\(images/feature-x.png\) -->


## Requirements

* Visual Studio Code version 1.0.0 or higher
* Unreal Engine 5.0 or higher

## Extension Settings

* `pcgGrammarFormatter.enable`: Enable or disable the extension.
* `pcgGrammarFormatter.formatOnSave`: Enable or disable formatting on save.
* `pcgGrammarFormatter.indentSize`: Set the number of spaces to use for indentation.
* `pcgGrammarFormatter.useTabs`: Use tabs instead of spaces for indentation.
* `pcgGrammarFormatter.insertNewLineBeforeBrackets`: Insert a newline before opening brackets.
* `pcgGrammarFormatter.insertNewLineAfterBrackets`: Insert a newline after closing brackets.
* `pcgGrammarFormatter.insertFinalNewline`: Insert a final newline at the end of the file.
* `pcgGrammarFormatter.trimTrailingWhitespace`: Trim trailing whitespace on each line.


## Known Issues

* The extension is still in development and may have bugs or incomplete features. If you encounter any issues, please report them on the [GitHub repository](https://github.com/damourChris/pcg-grammar-formatter/issues).

# Release Notes

Full changelog is available [here]()(CHANGELOG.md).
---

# Extra Information

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request on the [GitHub repository]()

This project (tries to) follows  the conventional commits specifications https://www.conventionalcommits.org/en/v1.0.0/

## PCG Grammar Resources

* [PCG Grammar Documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-shape-grammar-with-pcg-in-unreal-engine)
* [PCG Grammar Examples](https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-a-fence-generator-using-shape-grammar-in-unreal-engine)
