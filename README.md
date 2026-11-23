# NAUVIS Command Center

A local-first Factorio 2.0 / Space Age factory planning dashboard. Built for desktop and iPhone, with optional private Supabase sync.

**Live app:** https://jonnyzavala.github.io/nauvis-command-center/

## Workspaces

- **Quick Guide:** plain-language production basics
- **Existing Factory:** actual smelting, refinery, assembler and belt records
- **Factory Balance:** potential production vs. recorded consumption
- **Future Plan:** optional long-term circuit district and construction checklist
- **Build Next:** guided recipe, machine-count and belt calculations

All throughput figures are estimates, not a live connection to Factorio. Modules, quality, beacons, inserters, circuit pumps and physical routing are not fully modeled.

## Quick Add / Quick Change (v0.18)

Use the floating **Quick change** control from any tab. This writes directly to the same records as **Existing Factory** and **Future Plan**, not a duplicate inventory.

- **Machines:** add an actual production line or select an existing one to edit recipe, count, assembler tier or destination. Remove a line if no longer used.
- **Smelting:** change actual furnace totals, output belts, iron-for-steel routing or furnace/belt tier.
- **Oil:** edit refinery and cracking plant counts.
- **Belts:** record or update resource routes, belt tiers, quantities and destinations. Transport is not counted as production.
- **Progress:** update the existing Future Plan construction checklist.
- **Undo:** reverse the most recent Quick Change in the current browser session. Undo is disabled if the factory data has changed since that action, to avoid overwriting a newer save.

Changes are saved locally first, including offline. Paired devices synchronize changes through the existing cloud outbox. A conflict must still be resolved explicitly when both devices edit concurrently.

## Sync and safety

See [Cloud Sync Setup](sync/README.md). Pair devices using a private recovery key and a public Supabase project URL and publishable key. **Never commit the private recovery key, service_role key, database password, or other secrets.** JSON backups are available in Future Plan.

## Tests

With Node.js installed:

```sh
node --test tests/*.test.cjs
```

The in-memory tests do not connect to live Supabase or substitute for visual testing on iPhone Safari.
