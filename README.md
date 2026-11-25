# NAUVIS Command Center

A local-first Factorio 2.0 / Space Age factory planning dashboard. Built for desktop and iPhone, with optional private Supabase sync.

**Live app:** https://jonnyzavala.github.io/nauvis-command-center/

## Workspaces

- **Quick Guide** (gold): learning notes, examples, and contextual help
- **Factory & Balance**: one top-level workspace with **Inventory** (rose) and **Balance Analysis** (purple); these modes use the same underlying factory records.
- **Plan & Build**: one top-level workspace with **Blueprint Designer** (Factorio blueprint blue) and **Construction Queue** (blueprint-placement teal). Explore a recipe, save a project, then track what you actually build.

Each workspace has an overview, compact headline metrics, jump links and collapsible secondary panels. The live model is still user-entered rated capacity, not automatic game telemetry.

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

## Original Industrial Item Icons & Navigation Spectrum (v0.24)

NAUVIS includes its own **original vector item icon set** for all 33 modeled base recipes and common raw inputs (ore, coal, stone, water, oils, lubricant). Icons appear in the Visual Planner's machine counts and node flow, detailed ratio breakdown, input supplies, recipe shortcuts, Projects, Factory rows, Balance ledger, and Quick Change preview. Every icon is compact inline SVG drawn using simple industrial geometry and bundled locally, so retina/iPhone rendering is sharp and works offline. The item name always remains visible, and redundant icons are hidden from screen readers.

**Art ownership:** These are **NAUVIS-original icons**, **not actual in-game Factorio/Wube sprites**. The [Official Factorio Wiki copyright notice](https://wiki.factorio.com/Factorio:Copyrights) explicitly excludes Wube-owned game art from its Creative Commons license; the [Factorio terms](https://www.factorio.com/terms-of-service) reserve the game art's rights. No game sprites, wiki image downloads or third-party licensed sprite sheets were copied into this public GitHub repository. Future use of actual game assets requires independent rights verification or permission.

**Palette and gradient fix:** The tab rail follows **Quick Guide slate → Factory gold → Balance mint green → Planner blueprint blue → Projects violet**. Each tab renders its own three-stop gradient segment with blended neighbors, so the rail stays aligned with variable-width tabs while scrolling on iPhone. Navigation dots, active-panel hues, background grids, and segments share the same CSS palette variables. The layered command console, colored gradients, blueprint texture and persistent contextual guide are preserved.

## Streamlined Plan & Build + Activity Journal (v0.25)

**Four top-level tabs:** Quick Guide (gold) → Factory (rose) → Balance (purple) → Plan & Build. Inside the last tab, **Blueprint Designer** stays Factorio blueprint blue and **Construction Queue** changes the whole canvas to placement-confirmation teal. The last selected blue/teal mode is remembered when switching among tabs. The same layered gradients and indicator lights remain, but the five-color palette now ends at the blue/teal blueprint workspace.

**Less scrolling:** Every workspace gets a summary with context-aware metrics and clickable section jumps. On Factory, Smelting and Machines stay expanded while Oil, Belts, Compare, and Inventory tools are collapsed initially; tapping a jump link opens the destination automatically. In Balance the production/capacity ledger and warnings stay visible; interpretive notes are optional. The original visual production flow remains open by default. All previous functionality and underlying section IDs remain intact.

**Construction Journal:** The teal Construction Queue contains a compact recent activity preview and an expandable **Activity Journal · Recent Changes**. New construction checks record a single event (project, item, previous and new built counts, and the linked Factory update). Factory edits, oil/smelting edits, belt changes, and old circuit-district checklist activity are also captured. You may save dated field notes without modifying Factory. Events are capped at the most recent 250 per factory. This is an audit trail of **NAUVIS user actions from v0.25 forward**, not a historical reconstruction or a direct connection to Factorio.

**Duplicate-entry warning:** Build events include hints when matching *unlinked* manual Factory rows exist. The journal doesn't automatically merge, delete, or reassign machines based on similarities. Existing protections against editing project-linked machine rows independently remain in place.

**Backups, resets, and cloud:** The journal is an optional `plan.journal` array inside the existing local/cloud JSON snapshot. No new Supabase tables, migrations or RLS changes. Older snapshots without a journal still import. Resetting the **original circuit district** checklist now preserves saved Projects and the new journal; it does **not** reset actual Factory inventory. There is no automatic factory wipe or "fresh start" of existing counts. Before rebuilding a potentially inaccurate inventory, export a backup and reconcile entries rather than deleting historical evidence.

## Three Workspaces and Expanded Nauvis Planner (v0.26)

**Three top-level tabs:** Quick Guide, Factory & Balance, Plan & Build. Inventory/Analysis and Designer/Construction are each two modes of one workspace. Selecting a tab returns to the mode you last used during the current browser session. The background, gradient, indicator lights and accents follow the actual current mode: gold → rose/purple → blue/teal. None of the existing production, inventory, journal or Construction functionality was removed.

**Expanded recipe catalog:** The search-enabled visual Designer now supports **182 deterministic, single-result, standard Nauvis recipes** rather than the original 33. This includes familiar circuits, modules, automation, batteries, accumulators, solar panels, laser turrets, robots, military materials and standard buildings. Each item is calculated with its recipe's ingredient quantities and base crafting time; the same recipe graph supports the flowchart and table. The catalog is derived from **Factorio 2.0.77 base-game recipe prototype metadata** (publicly available in Wube's `factorio-data` game files; the comparison dataset used was [2.0.77 extracted recipe data](https://github.com/0sdknum/factorio-live-planner/blob/main/internal/entities/factorio-recipe/config/catalog-2.0.77.json)). No game imagery was copied. Updated rocket fuel's crafting time to **15 seconds** per that metadata. This is not yet all Space Age planet-specific recipes, multi-product refinery/uranium processing, or probabilistic alternative results; those need richer production models.

**Choose how much to make:** For every modeled item, select **Starter**, **Balanced** (default when choosing a new recipe), **More**, or **Custom**. The starting recommendation is either an explicitly curated practical quantity (e.g., 90 advanced circuits/min, 30 batteries/min, 10 accumulators/min) or a transparent rough two-machine heuristic. **Balanced is not derived from actual demand**, and it should not be mistaken for an optimal factory-wide rate. The exact chosen target remains editable. Options and rationale are available in the visual Designer; the detailed legacy calculator shares the same quantities.

**Scope:** Items needing a different machine type (centrifuge, rocket silo production, crushers, foundries, biochambers, etc.), stochastic yields, unique planetary conditions, beacons, modules, quality and logistics constraints need further modeling. Space Age remains deliberately out of the initial 182-recipe catalog until those assumptions can be represented accurately.

## Placed Infrastructure, Deployments and Optional Clean Factory Reset (v0.27)

**Installed infrastructure ledger:** Factory & Balance → Inventory now includes Infrastructure & deployed equipment. Record the item, **how many are physically placed/installed**, category, area/block, optional note, and whether the count has been verified in-game. Typical items: mining drills, laser turrets, solar panels, accumulators, roboports, belts, installed modules and other buildings. This ledger (`setup.assets`) is **separate from `setup.machines`**: an assembler *making* accumulators is a production line; an accumulator already placed is a deployed asset. Infrastructure does not inflate rated production capacity or invent electrical telemetry. Two identical records in one area are highlighted for duplicate review.

**Construction deployments:** Plan & Build → Construction Queue now lets you create an **infrastructure deployment** specifying a planned item quantity and area. Each + / − check changes **the project's placement count and exactly one tagged infrastructure row in Factory**, while logging one construction event. Existing manual infrastructure is not silently claimed, and if matching items already exist, confirmation is required before counting a new one. Existing production-machine construction remains separate and unchanged. Projects and deployments both use the current cloud snapshot.

**Fresh Start is optional and never automatic:** Inventory Tools contains a **data-only clean factory** workflow. It requires (1) requesting a full JSON backup download, (2) affirming the backup was actually saved, (3) opening the reset dialog and typing `RESET FACTORY`. Only then does it clear production lines, smelting/oil quantities, belt records and placed infrastructure, and set built/placed quantities in all saved projects to 0. Project designs, journal history, original circuit-district plans and checkbox history, guide, preferences, app code and cloud pairing are **not reset**. The single reset journal event identifies the cleared records. The new zeroed active inventory is saved locally and then propagated to paired devices by normal sync. It cannot be undone without importing the saved backup. **Do not click this until you're ready to re-enter your verified Factorio inventory.** No reset was performed during development.

**Legacy compatibility:** Older local and synced Factory snapshots without `assets` load as an empty infrastructure ledger. Existing JSON export/import includes it. The cloud schema, RLS, recovery-key pairing, conflict management, and active Factory's single-snapshot representation are unchanged.

## Advanced Production Profiles (v0.28)

**Optional machine upgrades in the blue Designer:** Under **Machine upgrades & module effects**, choose a *uniform machine profile* for each production chain: **None**, **Speed Module 1**, **Efficiency Module 1**, or **Productivity Module 1**, plus up to four normal-quality modules requested per machine, crafting-machine quality (Normal, Uncommon, Rare, Epic, Legendary), and an optional **effective beacon speed bonus**. The profile is applied to compatible assembler and chemical-plant recipe stages, with module count capped per stage at its available slots (Assembler 2: two, Assembler 3: four, chemical plant: three). Ineligible productivity recipes are **skipped**, using whitelist data from Factorio 2.0.77 game prototypes. Generic smelting furnace groups are intentionally held at 2× speed without modules or quality because an actual furnace type has not been specified.

**Actual calculation effects:**
- Speed 1: +20% crafting speed/module; additive +50% electrical energy consumption/module.
- Efficiency 1: -30% electrical energy consumption/module, bottoming at 20% of base; **no fabricated production increase**.
- Productivity 1, where eligible: +4% expected output and -5% crafting speed/module. The extra product reduces upstream ingredient requirements. This is throughput/expected yield, not probability of rare product quality.
- Higher-quality crafting machines: speed multipliers **1.0×, 1.3×, 1.6×, 1.9×, 2.5×**. These affect the speed of the machine, **not the quality of the items it makes**.
- Beacon speed: enter the *actual effective additive speed bonus (%) contributed by beacons* as observed in Factorio. Entering **number of beacons** here would be wrong because Factorio 2.0 transmissions have diminishing returns; geometry and beacon module configuration are not inferred.

**The same math flows into Factory and Balance:** Saving a visual build carries module/quality/beacon settings into its project design and each linked production-machine inventory row. Existing Factory rows have collapsible Machine Upgrade controls. The Factory's theoretical production-capacity totals and ingredient-consumption estimates use those recorded settings. The Activity Journal records subsequent profile changes, and Construction detects a mismatch between its saved blueprint profile and an edited linked Factory line rather than silently counting it twice. The **legacy detailed preset calculator** is still available but explicitly warns that it uses base rates if you transfer a modified visual goal.

**Scope limits:** The displayed module-only electricity multiplier does **not** include any energy effect transmitted to machines by beacons or the power consumed by the beacons themselves. No module tier 2/3, mixed profiles within a machine group, product rarity/quality probability, actual beacon placement and transmission geometry, energy/pollution telemetry, probabilistic/planet-specific recipe types, train/inserter/logistics limits, or electrical grid simulation. Quality and beacon effects here are assumptions you specify, not telemetry. No Supabase schema changes or resets to existing records. Existing old factory rows with no upgrade settings remain normal quality and unmoduled.

**Factorio mechanics:** [Modules](https://wiki.factorio.com/Module), [Productivity Module 1](https://wiki.factorio.com/Productivity_module), [Machine quality](https://wiki.factorio.com/Quality), and [Beacons](https://wiki.factorio.com/Beacon).

## Sync and safety

See [Cloud Sync Setup](sync/README.md). Pair devices using a private recovery key and a public Supabase project URL and publishable key. **Never commit the private recovery key, service_role key, database password, or other secrets.** JSON backups remain available in Plan & Build → Construction Queue → Original circuit district.

## Tests

With Node.js installed:

```sh
node --test tests/*.test.cjs
```

The in-memory tests do not connect to live Supabase or substitute for visual testing on iPhone Safari.


## Factory-focused Fresh Start (v0.29)

The manually maintained installed-infrastructure ledger and new deployment projects are retired from the UI. Historical asset records and old deployment projects remain in exported snapshots until an explicit Fresh Start; they are excluded from active construction and overview statistics. Production of infrastructure items remains available through the recipe catalog and normal production projects.

Fresh Start now clears all factory-specific production and route records, legacy installed assets, active/archived projects, district targets and checklist, and journal history. The hypothetical Balance scenario is disabled. Calculator settings, reusable presets, code, and cloud pairing are unchanged. The backup must match the current snapshot; changes since download require a new backup. Applying the cleared snapshot suppresses intermediate change logs and cloud uploads, then queues the complete snapshot for normal revision-aware sync. No schema changes. New local installations start with empty counts; sample layouts require explicit user action. No reset is performed by deploying v0.29.


## Compact portrait production graphs (v0.33)

Mobile charts retain two columns per production stage at narrow phone widths, reduce machine and supply card padding, tighten the stage spacing and compact the build count list. Selected nodes still reveal full input/output details and links remain calculated from actual card coordinates. Desktop flow layout and all recipe calculations, saves and cloud settings remain unchanged. Roadmap: one factory/save only; use Fresh Start for a new game. Planetary Space Age expansion deferred; continue with machine profiles, resource allocation and construction integration.


## Canvas zoom (v0.34)

Flow view has 50%, 65%, 75% and 100% zoom controls (mobile starts at 75%, desktop at 100%). Zoom affects the actual diagram, not the rest of the page. On portrait phones, lower zoom levels fit three or four nodes per stage. Full-size selected-node details remain below the chart. The SVG and diagram use the same unscaled coordinates, and the visible canvas height is reduced proportionally. No production or factory data changes.


## Automatically fitted production map (v0.35)

Replaces manual canvas zoom with a fit-to-available-width-and-height overview. The renderer evaluates horizontal and vertical layered layouts and chooses the larger readable scale. Every connection uses reserved inter-stage channels and a separate exterior rail when skipping a stage; lines never pass through a node. Crossings between unrelated connections may remain in nonplanar graphs; the routes are color-coded with dark crossing outlines. Full-size selected-node input and output details and the Table view remain available. For especially complex chains, automatic fitting necessarily reduces label size. No factory data or calculation changes.


## Shared resource connections (v0.36)

One output port and shared departure trunk per producer. Branches use common reserved channels and one bypass rail per resource source; duplicate segments are merged, corners rounded, and true junctions marked with dots. Different resource crossings have dark outlines and no junction. Exact per-branch rates remain in selected-node details rather than overlapping lines in the overview. Automatic fitting and production data remain unchanged.


## Crossing-aware layout (v0.37)

The production map scores actual shared resource segments for overlaps and intersections, then tests barycentric stage ordering, adjacent swaps, lane directions and inbound port assignment. A bounded search retains the original route if no better candidate is found. Shorter routing wins ties. Connections have larger rounded elbows and redundant collinear waypoints are removed. Optimized geometry is cached for each rendered recipe, so selection and resize do not repeat the search. This is a heuristic, not a guarantee of zero crossings; production math and save data are unchanged.


## Flowchart focus (v0.38)

Direct focus highlights the selected node, its immediate inputs and consumers, and only the relevant branches of shared resource trunks. Upstream tree also traces all transitive upstream dependencies, while still showing direct downstream outputs. Unrelated nodes and routes are dimmed, not removed. Focus scope is retained per explorer during the session. Arrowheads are 12% larger, selected cards and connected cards glow, and active lines have a luminous under-stroke. No geometry, production math, or factory records change.


## Neutral overview and compact corner tools (v0.39)

The flowchart starts with no focused item and all cards and routes at normal visibility. Tap an item to focus it, tap it again to clear; changing recipes clears the selection. Upstream tree is a checkbox alongside Show inputs, and keeps its session setting. The contextual guide is a compact left-corner button with an on-demand upward panel; Quick Change is on the right. Existing contextual help, inventory edits and sync are preserved.


## Corner button cleanup (v0.40)

Removed decorative dots from Quick Guide and Quick Change. Actual cloud sync status and navigation indicators remain unchanged.


## Tier 2/3 and mixed machine modules (v0.41)

Normal-quality speed, efficiency and productivity modules now support tiers 1–3. Each uniform Designer profile and recorded production line can specify a primary and secondary module group; compatible slots fill in that order, and disallowed productivity modules are skipped. Effects are additive, with the existing 20% speed/energy floors. Both groups persist in project goals and linked inventory and are used by Balance. Existing records default to no second module. Product quality outputs, per-stage overrides, electric furnace profiles, and beacon geometry remain future work. Source: https://wiki.factorio.com/Module .


## Editable Logistics (v0.42)

Factory & Balance has a third Logistics mode. Create separate resource networks, link producers and destinations to recorded machine groups or saved project external demand, or enter manual full-belt-equivalent assumptions. Connect nodes with integer physical yellow/red/blue belts; splitters use equal allocation by default and ordinary branches distribute by route capacity. Relative share weights can override defaults. Directed acyclic graphs cap each route by transport capacity and never create supply at a junction. Linked iron smelting uses main-bus output after the existing steel allocation. No live throughput, downstream backpressure redistribution, train/fluid simulation, or automatic deduction from the global ledger. Projects are full planned scenarios. Graphs live inside the existing setup snapshot, participate in sync/backups, and are cleared by Fresh Start. Undo is session-local and invalidated on incoming snapshots.


## Six-mode spectrum (v0.43)

The workspace palette is amber Guide, coral Inventory, rose Balance, violet Logistics, blueprint blue Designer, and teal Construction. The three parent tabs retain their existing grouping; the spectrum rail displays all six hues in order regardless of active mode, while the active parent dot and workspace chrome follow the selected mode. Resource, belt and warning colors are unchanged.


## Logistics interaction (v0.44)

Each physical belt is drawn separately, with individual ports and routing lanes. A single Add Node picker offers compatible recorded machine groups (including live recorded counts), smelting groups, project demands, and manual supply/demand and junctions. Nodes may be linked by dragging the + output port onto a compatible receiving card or by tapping the port and then the card. A belt-tier brush, slider and exact count control are adjacent to the diagram; selecting a route edits it. The existing resource-specific graph model is retained: a smelter group can be represented as a consumer in its input resource network and a producer in its output network. Iron gross and post-steel bus supply cannot be counted twice. Graphs remain auto-laid-out and scrollable; there is no free-placement canvas yet. No changes to cloud snapshot shape.


## Network diagnostics (v0.45)

Logistics now marks destinations short, near capacity (less than 15% modeled delivery headroom), sufficient, or unknown. Known input shortages propagate across resource networks linked by matching recorded production-group identities, using conservative monotone iteration (64-pass limit). Unrecorded inputs are not verified; rated output remains conditional. Missing sources and unmodeled inputs are disclosed. Diagnostics check incoming transport capacity and reachable supply, and test bounded local belt additions, tier upgrades, and allocation changes against other known destinations. No automatic routing changes are made. The expansion handoff uses the known demand gap above rated source capacity, not the additional shortfall caused by modeled input starvation; it opens Blueprint Designer at the deficit rate using the existing assembler preference and a normal, unboosted baseline. Full project demands may overlap already-built inventory and must be interpreted as scenarios. Global Balance remains independent; no changes to stored records or cloud schema.

## Inventory boundary (v0.46)
Actual Inventory changes only through explicit record/correction actions and construction built-count adjustments (apart from deliberate import/reset/sample replacement). Inventory add buttons open Quick Change without writing a default row. Quick edits retain existing metadata. Project-linked recipe, count, tier, removal and module/profile changes are locked outside Construction; destination edits remain allowed. Profile reconciliation for genuine upgrades remains future work. Queue construction creates plans only; legacy district milestones remain checklist-only. Logistics edits affect network assumptions and links, not actual machines. Queued full-project demand is opt-in in Logistics; it is explicitly hypothetical and may overlap already-built machines. Existing data is retained. No schema migration or interface consolidation.

## Unified production entities (v0.47)
Production network is a new default Logistics view. It groups existing endpoint records by production group, generates available input/output ports from actual recorded arrays, and lets a user select an array without typing a name. Connecting a matching pair of ports creates the underlying resource endpoints only when necessary. Resource detail remains the original route editor. No destructive migration: the saved nodes and edges retain their IDs and shape, with an optional entityAnchor field for an unconnected input-only anchor. Unconnected ingredient ports remain unverified. Fluid ports may be displayed but cannot be connected with belts. Gross and post-steel iron stay alternate output representations; existing links retain their choice. Group identity still uses recipe and destination; renaming or reallocating those records can require relinking. Mixed physical lanes, oil processing groups, proposed arrays and stable persistent inventory entity IDs are subsequent work. Cross-resource cycles fall back to cards and explicit route list. No Inventory mutation from entity operations.

## Lane-aware logistics and per-array belt planning (v0.48)
Full belts are unchanged by default; half routes reserve one lane. Pair two unpaired half routes of equal tier and count delivering distinct ingredients to the same linked recorded production group. A shared bundle represents the final feeder, not shared upstream tiles; both lane allocations share tier and belt count, and may be unpaired. Each lane gets exactly half the rated throughput. Single-resource counterfactual capacity upgrades exclude mixed feeders and prompt reviewing both lanes. The network map uses dashed half-route lines and a shared-feeder list (not tile geometry). Pairing does not change Inventory. Old routes without lanes are full belts. One homogeneous lane allocation per source/destination route; dedicated and half routes between identical endpoints require separate distribution nodes for now. Blueprint Designer's Ingredient belt layout pairs odd residual lanes within a single selected receiving array, offers exact-target or full-rounded-machine sizing, and excludes pipe inputs. Recommendations are advisory, not automatically committed to Logistics or Construction. No changes to cloud schema.

## Shared engineering calculations (v0.49)
Production-effects exports recipeRates and recordedRates for consistent output and input demand across Inventory, Blueprint, Logistics and Balance. Balance retains its original rated ledger, with a separate route-constrained output and margin when explicitly modeled input routes restrict a production group. Route warnings link to Resource detail. Actual network excludes queued scenarios; manual source assumptions never become additional inventory production. Missing routes are unverified. Smelting uses the existing belt/steel allocation ceiling and a separate rated-input ceiling, avoiding multiplying an already constrained output by an input fraction. Legacy net bus iron allocation is retained; gross iron and net bus iron are alternative source representations, not two outputs. No automatic inference of unmodeled routing or global spare capacity; oil remains the existing aggregate estimate. No inventory or cloud schema change.

## Blueprint-to-Logistics preview (v0.50)
Blueprint Designer has a Preview in Logistics action that copies the exact current goal/profile into an isolated session-only Build preview. It lists proposed arrays, remaining external inputs and per-stage shared feeder recommendations. Explicitly opt into reusing existing production from groups assigned Available for new build, with no outgoing modeled routes and no duplicate producer links. Route-constrained rates cap eligible output; a nonconvergent or invalid network disables reuse. Selected supply is deducted once from aggregate ingredient demand before recursively sizing upstream stages, never from the final additional output goal. Existing producer inputs remain part of actual factory demand; selected reuse is hypothetical, not a reservation or a verified delivery. Recomputed proposals do not change saved Logistics, Inventory, projects or synced data. Returning to Blueprint restores the original full goal, not the reduced plan. Incremental construction handoff, persistent draft graph and explicit existing-to-proposed connections remain future work. Preview is cleared on reload or snapshot replacement.

## Incremental construction handoff (v0.51)
Queue an incremental preview directly from Logistics. The project freezes its exact analysis, reused rates, feeder recommendations and baseline machine count. Only additional planned machines become construction tasks; existing reuse is never recorded again. Reuse claims subtract from future eligible capacity and persist even after archiving or completion, because physical use may continue. For a cancelled archived project with zero built machines, explicit release is available; released projects cannot be restored. Claims are planning commitments, not verified delivery or hard constraints on physical routes. Before saving, the preview is recalculated against current local records and commitments; a changed plan requires reopening the preview. Saved designs reopen read-only in Logistics with current project built counts and frozen lane recommendations. Construction lists the machine items still required, not their raw crafting ingredients or unmeasured belt lengths. Optional design metadata stays inside existing project snapshots. Raw plans still containing furnace tasks are rejected until smelting inventory ownership is reconciled. Legacy projects are unchanged. No automatic actual route creation or Inventory mutation on queueing.

## Raw-smelting construction and ownership (v0.52)
Raw plans may be queued with an explicit steel or unboosted electric furnace item, only at the existing aggregate 2× smelting speed. Each built action updates the matching aggregate actual furnace count and a project-owned subset under `setup.smelt.projectBuilt`, not a second producer. Reverse removes only that project's furnace. Inventory and Quick Change may correct total counts above the owned subset; reducing below the owned total, incompatible speed changes, or sample replacement while owned furnaces exist are blocked. Ownership must agree with all built furnace tasks. Output belts, ore and fuel remain manually recorded; no auto-routing. Construction materials include gross immediate recipe ingredients for remaining machines, not recursively expanded raw ores or stocked items. Fresh Start still requires explicit backup and confirmation, and clears ownership along with projects. Existing 2× generic smelting ignores electric furnace modules and mixed speed populations.

## Backup restore safeguards (v0.53)
Full backup imports and cloud snapshot restoration share the replacement path and validate smelting ownership before mutating live state. Legacy district-only imports preserve current actual inventory, construction projects and journal. Full imports replace old smelting metadata rather than merging it. The user confirms which type of import will occur. Journal baseline is refreshed before persisting a restored snapshot. No reset is performed automatically.


## Mixed actual smelting profiles (v0.54)
Inventory → Smelting → Mixed furnace types & electric furnace upgrades records subsets of existing totals. Unassigned furnaces retain baseline stone or steel/electric speed. Explicit normal stone and steel groups and electric groups (two normal-quality tier 1–3 module slots, machine quality, effective beacon speed) can coexist. Profiles cannot overlap Construction-owned furnaces or exceed actual counts, including Quick Change and backup restore. Removing profiles returns their counts to the baseline, not zero. Sample replacements and Fresh Start clear profiles. Shared rated output and ingredient demand feed Inventory, Balance and Logistics. Mixed steel capacity assumes proportional utilization; bus allocation remains reserved even if steel cannot use it all. Raw Blueprint/Construction remains unboosted 2×; project-owned profile upgrades, exact fuel/power, beacon geometry, burner quality, and technology productivity are not modeled. No cloud schema change or automatic reset. Sources: https://wiki.factorio.com/Electric_furnace and https://wiki.factorio.com/Steel_plate .


## Expanded construction materials (v0.55)
Construction Queue separates remaining finished machines, immediate components, and a gross recursive raw/external-input alternative. The expansion aggregates all demand before rounding each standard recipe to whole crafting batches and reports intermediate surplus, including shared ingredients. Oil fractions and raw resources remain external; missing recipes are flagged as unresolved rather than treated as verified raw resources. Existing production reference checks explicitly available, uncommitted recorded lines using the same Logistics eligibility and route constraints as reuse. Each item has an independent conditional acquisition estimate (quantity/rate); these estimates are not an additive schedule, inventory or reserved output. No deduction from the gross bill, no new factory data, no reset or schema change. Machine materials only; installed modules, poles, inserters, belts, fuel, alternative recipes and actual stock remain outside the calculation.


## Saved proposed Logistics drafts (v0.56)
Logistics → Saved drafts is a separate library of up to 30 explicitly saved proposals. Save draft stores a compact validated goal, module/quality settings, selected reuse identities and focused array in setup.logisticsDrafts, separate from actual setup.logistics and Construction. Reopen recalculates proposed arrays and feeder recommendations from the current recipe catalog and eligible capacity; stale reuse selections are flagged and ignored. Update saved draft or Save as new draft; deleting or closing does not change actual Inventory, routes or claims. Queueing still revalidates and freezes a separate Construction project; saved drafts remain reusable and do not reserve supply. Snapshot version 7, backup/restore, existing revision-aware sync and Fresh Start support the optional collection; no database change. Unsaved session changes are not persisted. Custom proposed route editing, stable actual group identities and existing-to-proposed connections remain subsequent milestones. Older cached clients should refresh before editing to avoid dropping the new optional field.


## Stable production identities (v0.57)
Existing recipe/destination groups retain their original route and claim keys on migration; the key is stored on each existing row. New manual production lines and newly built Construction tasks receive separate stable keys, preserved through destination, count and module changes. Legacy groups remain grouped even if allocations differ, and only groups whose active rows are all Available for new build may be reused. Recipe replacement creates a new key; deleting a row leaves references visibly unresolved rather than silently binding them to a new line. Construction reversals preserve the key on the task for rebuilding. Existing routes, saved draft selections and commitments remain compatible. Inventory and Logistics show a short array identifier for new lines. Refresh all paired devices before editing; no schema change or automatic factory reset.


## Proposed routing and existing-to-proposed connections (v0.58)
Within a Logistics build preview, generate recommended solid belt connections or add compatible custom source-to-array connections. Sources include proposed internal stages, selected existing reuse commitments and explicit external assumptions. Edit requested item rate, belt tier, count and half/full lanes; remove or regenerate. Drafts persist these connections, and queued Construction designs freeze them without touching actual routes. Route analysis conserves source and destination budgets and propagates solid shortages in upstream-to-downstream order; outdated endpoints remain flagged. Incomplete routing can be queued only after explicit acknowledgment. External supply and fluids remain conditional; no physical geometry, actual route creation, shared half-belt pairing or automatic backpressure redistribution. No schema change.


## Installed Construction profile reconciliation (v0.59)
In a project machine checklist, an already built assembler or chemical-plant task exposes its Installed machine profile. Explicitly record one uniform physical tier/module/quality/effective-beacon configuration for its linked actual array; the original goal, frozen design, reuse claims, planned and built counts stay unchanged. Subsequent Built actions use the recorded task profile, including after reversal to zero. Invalid slots or ineligible productivity, incompatible tiers and mismatched linked counts are blocked. Balance and Logistics use the actual profile and remaining machine material bills use the adjusted assembler tier. No automatic resize of the original plan, no mixed profiles within a single linked task, and no project-owned furnace upgrades yet; these remain separate future enhancements. No schema change or automatic reset.


## Integrated workflow verification (v0.60)
The release workflow now runs an isolated real Chrome browser in addition to the pure model tests. The browser exercises actual Inventory identity changes, Blueprint → Logistics → saved draft → reload → Construction queue, proposed routing, linked build/upgrade, complete backup and data-only Fresh Start, at desktop and narrow mobile viewport sizes. Cloud synchronization uses a separate mocked two-device integration test including proposed routes, draft and installed profile snapshots; no real factory or credentials are used in CI. This is desktop Chrome responsive testing, not physical iOS/Switch hardware or a live Supabase write test. Supabase schema and pairing are unchanged.


## Guided start (v0.61)
Fresh Start opens an optional setup wizard after the backup-confirmed reset. A new, empty unpaired browser also sees it once; Inventory tools always provides a manual launcher. Choose a new save or an existing playthrough, set preferred belt and supported blueprint assembler tier, optionally select a next goal, and enter only physically built smelting, advanced-oil and production arrays. Blank counts are omitted, not inferred. Review before applying one complete snapshot; changed or nonempty snapshots block seeding, with a read-only workspace tour available on populated factories. Skipping or closing never writes factory data. Pairing and existing sync protocol remain unchanged. Mixed furnace profiles, modules, oil variants, infrastructure, routes and feed records can be added in Inventory/Logistics later. No automatic reset or database mutation.

Contextual progress cards appear near the top of Inventory, Balance, Logistics, Designer and Construction. Milestones are derived live from current records, not permanently unlocked or synced as a second ledger. Rated-demand trophies require positive recorded demand, and 125% denotes a rated buffer; route-constrained deficits are shown separately. Empty demand earns no award. Hypothetical goal demand is excluded from achievement thresholds. No audio or intrusive reward notifications.


## Version 1.0 · Engineer. Build. Optimize.
The stable release adds original Web Audio synthesis (no media downloads), a header Feedback settings dialog, 17 differentiated cues, a sound test bench, device-local volume and category controls, optional vibration where the browser supports it, full/subtle/off motion, and automatic system reduced-motion handling. Sound and vibration default off; a user gesture unlocks the audio context. Slider/number feedback is rate-limited, semantic construction/save sounds are emitted after successful actions, and reward sounds are limited to newly gained live milestones after local changes. Reloads, remote snapshot applications and backup restores establish a fresh baseline, not a new award. Synchronization feedback follows real status transitions. No factory schema, credential, storage, cloud policy or snapshot changes. Sensory preferences stay device-local, not in factory backups or synced records; Fresh Start preserves them. iOS Safari requires a gesture for audio, does not support the Vibration API, and real-device audio/haptic quality is not verified by headless browser tests. Reduced motion disables motion effects; static state and readable labels remain. Current engineering boundaries remain documented above.

### Hands-on coaching
Guided setup still uses a review-first dialog for initializing an empty factory. After Apply, and when opening guided setup on a populated factory, the modal is replaced by a non-modal coaching menu. Each workspace offers a first-use invitation; users can decline, exit, or replay from Quick Guide. The blueprint example guides actual recipe selection, target input, presets, flowchart and a proposed Logistics preview, then offers an explicit optional real queue. Inventory coaching guides the actual Quick Change editor; it never seeds pretend machines. No overlay blocks the rest of the workspace. The current target is outlined and scrolled into view, with instructions inserted into Quick Change or native construction dialogs as needed. Coaching makes no factory changes itself, and progress/first-use flags remain device-local. Construction recording always requires the user to confirm that the machine actually exists.
