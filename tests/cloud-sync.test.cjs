// Run with: node --test tests/cloud-sync.test.cjs
// No real Supabase credentials used. Tests are isolated in-memory simulations.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'sync', 'cloud-sync.js'), 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
const secret = 'a'.repeat(64);
const factoryId = '11111111-1111-4111-8111-111111111111';
const initial = n => ({ plan: { redBlocks: n }, guide: { goal: 'advanced-circuit' },
  setup: { smelt: {} }, balancePrefs: { includeGoal: false } });

function makeDevice(name, blocks, cloud) {
  let data = initial(blocks), session = null, online = true;
  const els = {}, listeners = {}, documentEvents = {}, windowEvents = {}, queue = [], store = new Map();
  const localStorage = {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    key: i => [...store.keys()][i],
    get length() { return store.size; }
  };
  const get = id => els[id] ?? (els[id] = {
    value: '', dataset: {}, hidden: false, disabled: false, open: false,
    addEventListener: (event, handler) => { (listeners[id] ??= {})[event] = handler; },
    setAttribute(k, v) { this[k] = v; },
    showModal() { this.open = true; },
    close() { this.open = false; }
  });
  const document = {
    readyState: 'loading', hidden: false, getElementById: get,
    addEventListener: (event, handler) => { documentEvents[event] = handler; }
  };
  const navigator = { get onLine() { return online; }, userAgent: name };
  const supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInAnonymously: async () => { session = { user: { id: name } }; return { error: null }; },
      signOut: async () => { session = null; return { error: null }; }
    },
    rpc: async (fn, args) => {
      if (!session) return { error: { message: 'AUTH_REQUIRED' } };
      if (fn === 'nauvis_pair')
        return args.p_recovery_key === secret
          ? { data: [{ factory_id: factoryId, revision: cloud.revision, snapshot: clone(cloud.snapshot) }] }
          : { error: { message: 'INVALID_RECOVERY_KEY' } };
      if (fn === 'nauvis_pull')
        return { data: [{ factory_id: factoryId, revision: cloud.revision, snapshot: clone(cloud.snapshot) }] };
      if (fn === 'nauvis_push') {
        if (Number(args.p_expected_revision) !== cloud.revision)
          return { error: { message: 'REVISION_CONFLICT' } };
        cloud.revision++;
        cloud.snapshot = clone(args.p_snapshot);
        return { data: [{ revision: cloud.revision }] };
      }
      return { data: true };
    }
  }) };
  const window = {
    supabase,
    NauvisLocal: {
      snapshot: () => clone(data),
      apply: snapshot => { data = clone(snapshot); }
    },
    addEventListener: (event, handler) => { windowEvents[event] = handler; },
    confirm: () => true
  };
  const setTimeout = fn => { const item = { fn, active: true }; queue.push(item); return item; };
  const clearTimeout = item => { item.active = false; };
  vm.runInNewContext(source, {
    window, document, navigator, localStorage, setTimeout, clearTimeout, setInterval: () => {}
  }, { filename: 'cloud-sync.js' });
  const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
  return {
    async start() { await documentEvents.DOMContentLoaded(); },
    async pair() {
      listeners.cloudStatus.click();
      get('cloudUrl').value = 'https://mock.supabase.co';
      get('cloudKey').value = 'sb_publishable_testapikey_abcdefghijklmnopqrstuvwxyz';
      get('cloudRecovery').value = secret;
      get('cloudDeviceName').value = name;
      await listeners.cloudConnectForm.submit({ preventDefault() {} });
    },
    async pump() {
      for (let i = 0; i < 8; i++) {
        const work = queue.splice(0);
        if (!work.length) break;
        for (const item of work) if (item.active) item.fn();
        await flush();
      }
    },
    change(n) { data.plan.redBlocks = n; window.NauvisCloud.changed(); },
    offline() { online = false; windowEvents.offline?.(); },
    async online() { online = true; windowEvents.online?.(); await flush(); },
    async refresh() { listeners.cloudRetry.click(); await flush(); },
    async cloudWins() { listeners.cloudKeepCloud.click(); await flush(); },
    async localWins() { listeners.cloudKeepLocal.click(); await flush(); },
    get state() { return clone(data); },
    get status() { return get('cloudStatus').dataset.state; },
    get pending() { return store.get('nauvis-cloud-outbox-v1'); }
  };
}

test('first pairing, cross-device updates, offline queue and both conflict choices', async () => {
  const cloud = { revision: 0, snapshot: initial(0) };
  const mac = makeDevice('MacBook', 4, cloud);
  const phone = makeDevice('iPhone', 0, cloud);
  await mac.start();
  assert.equal(mac.status, 'local');

  await mac.pair(); await mac.pump();
  assert.equal(cloud.snapshot.plan.redBlocks, 4);
  assert.equal(mac.status, 'saved');

  await phone.start(); await phone.pair();
  assert.equal(phone.state.plan.redBlocks, 4);
  assert.equal(phone.status, 'saved');

  mac.offline(); mac.change(8);
  assert.equal(mac.status, 'offline');
  assert.ok(mac.pending);

  await mac.online(); await mac.pump();
  assert.equal(cloud.snapshot.plan.redBlocks, 8);
  assert.equal(mac.status, 'saved');

  await phone.refresh();
  assert.equal(phone.state.plan.redBlocks, 8);

  mac.change(9); phone.change(10);
  await mac.pump(); await phone.pump();
  assert.equal(phone.status, 'conflict');

  await phone.cloudWins();
  assert.equal(phone.state.plan.redBlocks, 9);
  assert.equal(phone.status, 'saved');
  assert.equal(phone.pending, undefined);

  mac.change(11); phone.change(12);
  await mac.pump(); await phone.pump();
  assert.equal(phone.status, 'conflict');

  await phone.localWins(); await phone.pump();
  assert.equal(cloud.snapshot.plan.redBlocks, 12);
  assert.equal(phone.status, 'saved');
});
