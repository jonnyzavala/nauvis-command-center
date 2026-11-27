# NAUVIS Command Center: Cloud Sync Setup

NAUVIS Command Center remains fully usable without a cloud connection. This optional feature synchronizes a single factory between your iPhone and MacBook using Supabase (a hosted PostgreSQL database and authentication service).

## Fix for earlier pairing installs: ambiguous `factory_id`

If pairing says `column reference "factory_id" is ambiguous`, the original `nauvis_pair` function needs a one-time correction. In your existing Supabase project, open **SQL Editor**, paste and run **[hotfix-pair-ambiguous.sql](hotfix-pair-ambiguous.sql)**. The patch uses `ON CONFLICT ON CONSTRAINT nauvis_devices_pkey` instead of an ambiguous column list. It **replaces one function only**; it does not create, delete, or reset the factory, recovery key, or saved plan. Then retry **Pair this device** in NAUVIS without changing your project credentials. **Do not re-run `nauvis_provision()`.**

## One-time Supabase setup

1. At [supabase.com/dashboard](https://supabase.com/dashboard), create a personal project. Its database is separate from the public GitHub Pages site.
2. In **Authentication → Sign In / Providers**, enable **Anonymous sign-ins**. This lets each browser maintain a private authenticated session without repeated sign-in prompts. The anonymous user session belongs to that browser; if you clear its storage, you will have to pair it again.
3. Open **SQL Editor**, copy the entire contents of [supabase-setup.sql](supabase-setup.sql), and run it **once** as the project's database owner. It creates the factory/device tables, RPC endpoints, and permissions. The SQL uses row-level security and limits reads and writes to paired devices.
4. In SQL Editor, run **as a separate command**:

   ```sql
   select * from public.nauvis_provision();
   ```

   Save the returned **64-character recovery key** to a private password manager. Treat it like a password. It is shown only once and cannot be retrieved from the database later. Running it again will not make another factory: this project is intentionally single-factory.
5. Go to **Project Settings → API Keys** and copy the **publishable** `sb_publishable_...` key (or the legacy `anon` public key). Get the **Project URL** from the API or Data API project settings. **Never paste a secret / service_role key into this website or a GitHub repository.**
6. Open the NAUVIS dashboard. Click the small **Local only** status in the masthead. Enter the Project URL, public key, 64-character private recovery key, and a device label such as **MacBook**. Click **Pair this device**.
7. On the iPhone, open the same URL and repeat the pairing once, with **iPhone** as the label. Use exactly the same project URL, public key, and recovery key.

**Important:** First export a JSON backup from the device with the plan you want to preserve. An empty newly provisioned cloud factory accepts the first device's current data. Once cloud data exists, pairing another device imports the shared cloud copy and replaces that device's local dashboard records (after saving a local timestamped backup).

## How daily syncing works

- Every edit saves immediately in browser localStorage. Local changes are queued for upload if the network is down.
- Connected browsers check for updates when the page is activated, after reconnecting, and periodically while open.
- The header's status indicator shows **Local only** (red), **Checking** (blue spinning ring), **Syncing** (slowly pulsing amber LED, spinning circular ring, and an indeterminate mini progress strip), **Synced** (solid green after server confirmation), or **Offline / Sync error / Sync conflict** (red; different text explains whether local data is safely queued or attention is required). On reduced-motion devices animations are disabled but state colors and text remain visible.
- The activity ring and moving line are **indeterminate**. Supabase sends each snapshot as a single database request, so there is no truthful percentage complete. The interface never invents upload progress.
- Routine background polling keeps the green Synced indicator steady unless a change, actual reconnection, or error requires attention.
- Both devices can work offline. When both edit the same factory from different revisions, one device will encounter a conflict. Open the sync panel and choose the **cloud** or **local** copy. Keep a JSON backup before overwriting either version.
- Local and remote snapshots are backed up locally before replacements where possible. Use **Download backup** from the sync dialog (or **Export backup** in Future Plan) for a portable recovery file; browser storage can be cleared by browser settings or system cleanup.
- **Unpair** requires an internet connection so the device authorization can be revoked on the server; offline edits must be uploaded or resolved first.
- Supabase is optional: do not pair if you only want local browser saves.
- This site does **not** read the actual factory running on Nintendo Switch 2; it synchronizes the plans you enter.

## Security and limits

- The public GitHub repository holds application code and database schema, **not** your Supabase private keys or factory contents.
- The project URL and publishable key are designed for public client apps. Browser device authorization uses Supabase Auth, and a secret recovery key must be entered once to register each browser with the shared factory.
- Supabase anonymous identities can be lost when browser storage is erased. You can pair again with the recovery key; keep it safe.
- This configuration is for one trusted user and their devices. Anyone who obtains the private recovery key and project details can pair a device, so don't send that key in public messages or screenshots.
- Supabase may apply project limits, inactivity policies, or hosting charges depending on your plan. Check your project's dashboard.
- If the external Supabase script is blocked by a content filter, local planning still works, but cloud syncing requires network access to Supabase and the JavaScript CDN.
- A single snapshot is limited to **1 MiB** by the database function. Both the cloud and local web storage use a snapshot model, not an unlimited audit log.

## Technical files

- [cloud-sync.js](cloud-sync.js): client sync queue, pairing, cloud status, revision check, conflict handling.
- [supabase-setup.sql](supabase-setup.sql): PostgreSQL schema and protected RPC functions.
- [../index.html](../index.html): the dashboard, in-browser state adapter, and sync UI.

**Testing before release:** confirm a new Supabase project can run the SQL; pair a Mac browser, edit a machine count, pair the iPhone, and verify the data appears; try offline edits on both devices and confirm the conflict choices preserve data. Do not merge until these checks pass.

## Device-management upgrade (v1.1.7)
Apply `device-management.sql` to an existing Nauvis database once. It adds one-time codes, key rotation/disable, and device listing/revocation without modifying the saved snapshot or existing paired devices. Every paired device is trusted to administer its own shared factory. Revocation invalidates outstanding codes and the reusable key. A key is stored on a browser only if explicitly approved; use a password manager. The old recovery key remains valid until rotated, disabled or a device is revoked.
