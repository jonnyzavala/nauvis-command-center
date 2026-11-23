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

## Persistent footer dock (v0.19)

Quick Change and Quick Guide share one bottom dock on laptop and iPhone. The compact **+** Quick Change icon on iPhone retains an accessible name. The bottom rail is transparent so dashboard content can scroll through without an abrupt horizontal cutoff; each control retains its own opaque surface and shadow. The sticky header still uses its matching blueprint background to mask content. Quick Guide's explanation opens above the footer instead of resizing it. Only one expanded panel is shown at a time, and Escape or the Close control closes it.

## Recipe Ratio Explorer (v0.20)

Open the **Recipe ratios** expander inside **Build Next**, **Existing Factory**, or **Factory Balance**. It does not add a sixth tab.

- Choose any of the **33 modeled base Nauvis recipes**, an output rate/minute, Assembler 2/3, and a belt type.
- **Bus-fed:** counts the supporting recipes back to your assumed bus / chemical supply boundary.
- **Raw-material expansion:** additionally models included smelting and chemical recipes back toward ore, crude-related fluids, and other external ingredients. This is **not** a model of mining drills, refineries, cracking circuits or pipe networks.
- See each supporting step's needed items/min, per-machine capacity, **exact machine equivalents**, and **rounded whole machine counts**. The compact ratio shorthand shows rounded build counts, not a mathematically universal fixed ratio.
- Review external supplies and the minimum dedicated full-belt counts for solids. Pipe throughput is not modeled; fluids appear as fluid units/minute.
- Expand **Why this ratio?** for recipe time, output per craft, ingredients per craft, machine-speed arithmetic and rounding.
- **Send to Build Next** to make the selected ratio the *hypothetical planning goal*, without adding machines to Existing Factory. Cloud sync for actual plan settings continues through the existing Save flow.

**Verified regression example:** At 90 advanced circuits/min, Assembler 2 speed 0.75, and bus-fed inputs, the internally produced chain requires **5 copper-cable assemblers, 2 green-circuit assemblers and 12 red-circuit assemblers (19 total)**. The recipe references used here are the [advanced circuit](https://wiki.factorio.com/Advanced_circuit), [electronic circuit](https://wiki.factorio.com/Electronic_circuit), and [copper cable](https://wiki.factorio.com/Copper_cable) pages of the Factorio Wiki.

**Important model limitations:** The engine reuses the existing base recipe table, rather than inventing Space Age alternatives. It currently assumes normal quality, no modules/beacons, 2× furnace crafting speed and 1× chemical plant crafting speed. Assembler 1 is omitted because the planner uses one assembler tier for an entire recipe chain and Assembler 1 cannot process fluid inputs. It does not model technology unlocks, planetary alternatives, productivity bonuses, inserters, pumps or circuit-controlled cracking. Recipe assumptions should be checked when expanding coverage.

## Featured Visual Planner (v0.22)

The **Visual planner** is now its own clearly named main navigation destination (the existing Build tab, **not** an extra sixth tab). On opening that tab, the **Visual production chain** is the first section directly below the header and is **already expanded**, showing recipe selectors, large machine counts and the interactive flowchart.

The older preset-based calculator is preserved underneath in the expandable **Detailed step-by-step planner**. From the visual planner, **Open detailed planner with this goal** transfers the selected recipe and rate to that calculator, expands it, and scrolls directly to its results. This transfers a hypothetical target only and does not edit Existing Factory records.

### Previous release: Visual Production Flow (v0.21)

The **Recipe Ratio Explorer** now opens **Flow view** first. Its first result is **Build these machines**: large, readable counts such as **5 copper cable assemblers**, **2 green circuit assemblers**, and **12 red circuit assemblers** for the 90/min red-circuit example with Assembler 2.

Under the counts, a color-coded production flow shows upstream supplies, machine groups, directional connections and per-branch output rates. It derives every node and link from the same recipe analysis used by the original table. Tap a block to highlight the associated connections and review incoming and outgoing material rates. On iPhone, the flow stacks vertically so the overall page does not expand; on larger screens it reads left to right, scrolling inside the panel if necessary.

**Flow / Table** switches between the flowchart and the original detailed allocation table. **Show inputs** hides/shows raw feed nodes. The existing **Why this ratio?** expander retains the detailed math. **Send to Build Next** still changes only the hypothetical goal, not the actual Existing Factory inventory.

Input examples are labeled correctly: *copper cable assemblers* are different from *copper plate furnaces*. Numbers in the flowchart are theoretical requirements at the selected rate and speed, not live telemetry.

## Projects & Build Queue (v0.23)

NAUVIS now has five color-coordinated workspaces in order: **Quick Guide** (slate), **Factory** (gold), **Balance** (green), **Planner** (Factorio blueprint blue), and **Projects** (purple). The contextual Quick Guide stays in the persistent footer.

**Planner → Projects:** Choose a recipe and production rate in the visual planner and select **Save this build to Projects**. Save and name multiple projects, track machine counts, archive projects, and reopen saved goals in Planner. Projects begin with zero machines built. The original circuit district's full long-term plan and checklist stay preserved in a separate expandable legacy panel.

**Mark Built in one step:** Tapping **+** in a project's machine checklist increments the built count AND the corresponding linked row in Existing Factory, with no second recording action. Tapping **−** reverses both if the linked Factory row has not been independently edited. Newly recorded machines default to destination **Other** so the user can later assign their output. Factory Balance measures rated capacity, not necessarily actual output. An unpowered or underfed machine may be built but not producing.

**Duplicate safeguards:** Linked Factory rows store projectId and projectTask metadata. The update refuses operations when the linked recipe, tier, count, or number of related rows differs from the project. Existing manually entered machines remain untouched. Only mark truly new construction in Projects: machines already manually entered into Factory must not be counted again.

**Scope:** Project recording currently supports bus-fed assembler and chemical-plant chains. The visual graph can still explore raw-material chains, but these cannot yet be saved as projects, because the separate smelting inventory needs a proper project-allocation design for safe furnace handling.

**Sync and backups:** Projects are stored as an optional array in the existing plan JSON. The cloud snapshot protocol, Supabase tables, RLS, revision handling and conflict protection are unchanged. Old backups without projects remain valid.

## Sync and safety

See [Cloud Sync Setup](sync/README.md). Pair devices using a private recovery key and a public Supabase project URL and publishable key. **Never commit the private recovery key, service_role key, database password, or other secrets.** JSON backups are available in Future Plan.

## Tests

With Node.js installed:

```sh
node --test tests/*.test.cjs
```

The in-memory tests do not connect to live Supabase or substitute for visual testing on iPhone Safari.
