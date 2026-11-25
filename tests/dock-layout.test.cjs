// Run with: node --test tests/*.test.cjs
// Structural regression tests for the responsive persistent footer controls.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'quick-add.css'),'utf8');
const js=fs.readFileSync(path.join(root,'quick-add.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

test('both persistent controls live in one dock with no duplicate IDs',()=>{
 const start=html.indexOf('id="commandDock"');
 const end=html.indexOf('id="quickAddBackdrop"');
 assert.ok(start>0&&end>start);
 const dock=html.slice(start,end);
 assert.match(dock,/id="quickAddToggle"/);
 assert.match(dock,/id="contextHelp"/);
 assert.match(dock,/id="contextHelpDetail"/);
 assert.equal((html.match(/id="quickAddToggle"/g)||[]).length,1);
 assert.equal((html.match(/id="contextHelp"/g)||[]).length,1);
 assert.equal((html.match(/id="commandDock"/g)||[]).length,1);
});
test('mobile uses an accessible compact quick-change icon',()=>{
 assert.match(html,/id="quickAddToggle"[^>]*aria-label="Quick change factory inventory"/);
 assert.match(html,/class="quick-add-label">Quick change/);
 assert.match(css,/\.command-dock \.quick-add-label\{display:none\}/);
});
test('footer stays transparent with no hard cutoff; only controls catch taps',()=>{
 assert.doesNotMatch(css,/\.command-dock::before\{/);
 const dock=css.match(/\.command-dock\{([\s\S]*?)\}/)?.[1]||'';
 assert.doesNotMatch(dock,/border-top\s*:/);
 assert.doesNotMatch(dock,/background\s*:/);
 assert.match(dock,/pointer-events:none/);
 assert.match(css,/\.command-dock \.quick-add-toggle\{[\s\S]*?pointer-events:auto/);
 assert.match(css,/\.command-dock \.context-help,[\s\S]*?pointer-events:auto/);
 assert.match(css,/\.command-dock \.context-help-detail\{[\s\S]*?bottom:calc\(100% \+ 12px\)/);
});
test('quick change and the context guide close the other panel before opening',()=>{
 assert.match(html,/if\(open\)window\.NauvisQuick\?\.close\(false\)/);
 assert.match(html,/window\.NauvisGuide=\{close:\(\)=>toggleGuide\(false\)/);
 assert.match(js,/root\.NauvisGuide\?\.close\?\.\(\)/);
 assert.match(js,/function close\(restoreFocus=true\)/);
});
test('existing tab navigation, sync, and offline cached code remain intact',()=>{
 assert.equal((html.match(/<button data-view=/g)||[]).length,3);
 assert.match(html,/sync\/cloud-sync\.js/);
 const uiVersion=html.match(/Nauvis Command Center v(\d+(?:\.\d+)+)/)?.[1];
 const cacheVersion=worker.match(/const VERSION='nauvis-shell-v(\d+)';/)?.[1];
 assert.ok(uiVersion,'The UI needs a visible version');
 const [major,minor,...patch]=uiVersion.split('.');
 assert.equal(cacheVersion,major+minor.padStart(2,'0')+patch.join(''),'Offline cache version must follow the UI version');
 assert.match(worker,/quick-add\.js/);
 assert.match(worker,/quick-add\.css/);
});

test('context guide is the left corner icon, quick change is the right, and panels open on demand',()=>{
 const dock=html.slice(html.indexOf('id="commandDock"'),html.indexOf('id="quickAddBackdrop"'));
 assert.ok(dock.indexOf('id="contextHelp"')<dock.indexOf('id="quickAddToggle"'));
 assert.match(dock,/id="contextHelpToggle" aria-label="Contextual quick guide"/);
 assert.match(dock,/id="contextHelpDetail" hidden/);
 assert.match(css,/\.command-dock \.context-help-peek\{display:none\}/);
 assert.match(css,/\.command-dock \.context-help-detail\{left:0;right:auto/);
 assert.match(css,/\.quick-add-panel\{\s*position:fixed;right:/);
});

test('corner buttons have no decorative LED, while the cloud sync indicator remains',()=>{
 assert.doesNotMatch(html,/class="(?:context-help|quick-add)-led"/);
 assert.doesNotMatch(css,/\.(?:context-help|quick-add)-led/);
 assert.match(html,/class="cloud-led"/);
});
