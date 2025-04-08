# Tyk Docs MCP Server

This is a pre-built [Model Context Protocol (MCP)](https://github.com/probe-ai/probe-docs-mcp) server for Tyk documentation, designed to enable AI assistants to search the Tyk API Management documentation using natural language queries.

Built on top of the [`@buger/probe-docs-mcp`](https://github.com/buger/docs-mcp) project, this package comes with Tyk’s documentation already bundled, offering a plug-and-play experience.

## Usage

You can run the Tyk Docs MCP Server with `npx`:

```bash
npx -y @tyk-technologies/docs-mcp@latest
```

This will start a local MCP server with a tool named `search_tyk_docs`, exposing the Tyk documentation to connected AI assistants.

## Configuration

No configuration is required. All content and settings (tool name, description, source) are pre-bundled.

### Default Tool Settings

- **Tool Name:** `search_tyk_docs`
- **Tool Description:** `Search Tyk API Management Documentation`
- **Documentation Source:** [https://github.com/TykTechnologies/tyk-docs](https://github.com/TykTechnologies/tyk-docs)

If needed, you can fork this project and modify the configuration in `docs-mcp.config.json` before rebuilding and publishing your own version.

## Built With

This server is built using the [Probe Docs MCP](https://github.com/buger/probe-docs-mcp) project.

## License

MIT
