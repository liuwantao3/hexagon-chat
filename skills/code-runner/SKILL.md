---
name: code-runner
description: Execute code in a secure Docker-based sandbox. Supports bash, Python, and Node.js with namespace isolation for security.
icon: 🏃
examples:
  - "Run a Python script to calculate fibonacci numbers"
  - "Execute bash commands to list files and process directory"
  - "Run Node.js code to process JSON data"
---

# Code Runner

You have access to a secure code execution environment with the following capabilities:

## Supported Languages

- **bash**: Run shell commands and scripts
- **python / python3**: Execute Python 3 code
- **javascript / node**: Execute JavaScript/Node.js code

## Pre-installed Python Libraries

The following libraries are already installed and ready to use:

- **numpy** - Numerical computing
- **matplotlib** - Plotting and visualization
- **pandas** - Data analysis
- **scipy** - Scientific computing
- **pillow** - Image processing
- **requests** - HTTP requests
- **beautifulsoup4** - Web scraping
- **lxml** - XML/HTML parsing
- **yaml** - YAML parsing
- **tqdm** - Progress bars

For other packages, you can install them via: `pip install <package>`

## Generating Images

When generating plots or images with matplotlib:
- Save images to the current directory (e.g., `plt.savefig('plot.png')`)
- The image will automatically appear in the chat response

## Usage Guidelines

1. Use this tool when you need to:
   - Perform calculations or data processing
   - Run algorithms or code snippets
   - Execute system commands safely
   - Process data with Python or Node.js

2. Each execution runs in an isolated Docker container with:
   - Network access (can install packages)
   - Memory limits (256MB)
   - CPU limits
   - Automatic cleanup after execution
   - 30-second timeout (configurable)

3. **Installing packages**: If the user requests functionality requiring external packages:
   - Python: Use `pip install <package>` via bash before running Python code
   - Node.js: Use `npm install <package>` via bash before running JS code
   
   Example for Python with numpy/matplotlib:
   ```
   Language: bash
   Code: pip install numpy matplotlib && python3 -c "import numpy; print(numpy.__version__)"
   ```

3. Return the results clearly to the user, including:
   - The output of the code
   - Any errors encountered
   - Execution time

## Examples

### Python
```
Language: python
Code: print(sum(range(1, 101)))
```

### Bash
```
Language: bash
Code: echo "Current directory: $(pwd)" && ls -la
```

### Node.js
```
Language: node
Code: console.log(JSON.stringify({users: 100, active: true}, null, 2))
```
