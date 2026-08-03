# Development

## Prerequisites

- Node.js 24 LTS
- pnpm 11.18.0

## Quality gate

Run the complete local gate from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The gate checks formatting, linting, strict TypeScript, and Vitest. Development commands must not be run as root and must not access `/usr/bin/satdump`, `/home/vaggos/autotracking_config.json`, or an SDR device.
