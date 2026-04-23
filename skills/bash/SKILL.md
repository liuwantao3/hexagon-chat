---
name: bash
description: Execute shell commands on the host filesystem
icon: 💻
category: system
source: local
---

# Execute on Host

Execute shell commands directly on your machine (not in Docker).

## Why use this?

| Tool | Filesystem | Use case |
|------|-----------|---------|
| execute_on_host | **Your machine** | List files, grep code, git commands |
| execute_code_in_docker | Docker container | Python/Node code that needs isolation |

## Tools Available

| Tool | Description |
|------|-------------|
| execute_on_host | Run shell commands on host machine |

## Note on Images

This skill only executes commands and returns text output. **It does not display images in the chat.**

To display generated images (plots, charts, etc.) in the chat, use the **display-image** skill after running your command.

## Use Cases

```
User: List all TypeScript files in src/

Assistant calls:
execute_on_host(command="find src -name '*.ts' -type f")

User: What's the git status?

Assistant calls:
execute_on_host(command="git status")

User: Search for "TODO" in the codebase

Assistant calls:
execute_on_host(command="grep -r 'TODO' --include='*.ts' .")

User: Plot sin(x) using matplotlib

Assistant calls:
execute_on_host(command="python3 -c 'import matplotlib.pyplot as plt; ...; plt.savefig(\"plot.png\")'")
# Then calls display_image to show the plot
```

## Security Note

This tool runs commands with the same permissions as the server process. Use with caution on shared hosting environments.