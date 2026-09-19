# n8n-nodes-typesafe

An [n8n](https://n8n.io) community node for [TypeSafe AI](https://typesafe.ai). Ask yes/no (noul),
choice and score questions about any text or JSON from a workflow and route on the typed answers.

Status: early, not yet published to npm, not yet exercised inside n8n. See [docs/DESIGN.md](docs/DESIGN.md).

## Operations
- **Ask Questions (System One)** – send a state (text or JSON) with named questions; get one item per input with
  `results.<name>` (label, score or probability) plus the full typed answers under `typesafe.answers`.
- **List Models** – the models the key can use.

## Install (self-hosted n8n)
Settings → Community Nodes → Install → `@biztactix/n8n-nodes-typesafe` (once published). Then add a
"TypeSafe AI API" credential with your API key.

## Develop
```sh
npm install
npm run build
TYPESAFE_API_KEY=... npm run smoke   # direct API call with the node's wire shapes
```

## Example
`examples/email-classifier.workflow.json` – email trigger → TypeSafe AI → Switch on category.

## License
MIT
