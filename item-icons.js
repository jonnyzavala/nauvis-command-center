/* NAUVIS v0.24 — original industrial item icon illustrations.
   Copyright © NAUVIS contributors. These are newly drawn geometric symbols,
   not Wube/Factorio game sprites and require no external image requests. */
(function(root){
'use strict';
const S={
 "iron-ore": [
  "ore",
  "#a8c0d1",
  "#5e7687",
  ""
 ],
 "copper-ore": [
  "ore",
  "#e8a56d",
  "#9c5a38",
  ""
 ],
 "stone": [
  "ore",
  "#c0b6a7",
  "#6d716f",
  ""
 ],
 "coal": [
  "ore",
  "#8396a6",
  "#35444e",
  ""
 ],
 "iron-plate": [
  "plate",
  "#bac9d7",
  "#6e8291",
  ""
 ],
 "copper-plate": [
  "plate",
  "#efb978",
  "#ab643c",
  ""
 ],
 "steel-plate": [
  "plate",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "stone-brick": [
  "brick",
  "#b7b2a6",
  "#807b77",
  ""
 ],
 "copper-cable": [
  "cable",
  "#eec277",
  "#b6723b",
  ""
 ],
 "iron-gear-wheel": [
  "gear",
  "#cbd9e3",
  "#748c9e",
  ""
 ],
 "iron-stick": [
  "rod",
  "#b8c9d8",
  "#647f91",
  ""
 ],
 "pipe": [
  "pipe",
  "#bfccd7",
  "#6d8497",
  ""
 ],
 "electronic-circuit": [
  "circuit",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "advanced-circuit": [
  "circuit",
  "#f18b86",
  "#a53448",
  ""
 ],
 "processing-unit": [
  "circuit",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "low-density-structure": [
  "lds",
  "#eec277",
  "#b6723b",
  ""
 ],
 "engine-unit": [
  "engine",
  "#b3cad7",
  "#546e82",
  ""
 ],
 "electric-engine-unit": [
  "engine",
  "#85d9ed",
  "#277b9e",
  ""
 ],
 "battery": [
  "battery",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "flying-robot-frame": [
  "robot",
  "#b9addf",
  "#7065a7",
  ""
 ],
 "plastic-bar": [
  "plastic",
  "#e6e9eb",
  "#8795a5",
  ""
 ],
 "sulfur": [
  "crystal",
  "#f6d76e",
  "#ad8126",
  ""
 ],
 "sulfuric-acid": [
  "flask",
  "#ecdc65",
  "#a29c35",
  ""
 ],
 "explosives": [
  "explosives",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "solid-fuel": [
  "fuel",
  "#a0a7b3",
  "#596272",
  ""
 ],
 "rocket-fuel": [
  "rocketfuel",
  "#f3c16f",
  "#af6735",
  ""
 ],
 "rail": [
  "rail",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "productivity-module": [
  "module",
  "#ce9df0",
  "#8549b9",
  "1"
 ],
 "electric-furnace": [
  "furnace",
  "#9ebbd2",
  "#566b91",
  ""
 ],
 "transport-belt": [
  "belt",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "fast-transport-belt": [
  "belt",
  "#ed777e",
  "#a53448",
  ""
 ],
 "inserter": [
  "inserter",
  "#e6c877",
  "#9f7b46",
  ""
 ],
 "automation-science-pack": [
  "science",
  "#f28f8f",
  "#a1454a",
  ""
 ],
 "logistic-science-pack": [
  "science",
  "#85e1b2",
  "#43836b",
  ""
 ],
 "chemical-science-pack": [
  "science",
  "#89c4f9",
  "#4a709e",
  ""
 ],
 "production-science-pack": [
  "science",
  "#ca9aee",
  "#72539e",
  ""
 ],
 "utility-science-pack": [
  "science",
  "#f2dd79",
  "#ad893f",
  ""
 ],
 "water": [
  "fluid",
  "#83d7f5",
  "#3e82af",
  ""
 ],
 "petroleum-gas": [
  "fluid",
  "#becbd9",
  "#566c84",
  ""
 ],
 "heavy-oil": [
  "fluid",
  "#b19c76",
  "#675741",
  ""
 ],
 "light-oil": [
  "fluid",
  "#edc774",
  "#a97e3e",
  ""
 ],
 "lubricant": [
  "fluid",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "active-provider-chest": [
  "chest",
  "#ce9df0",
  "#8549b9",
  "↑"
 ],
 "buffer-chest": [
  "chest",
  "#79d0ad",
  "#236b54",
  "↔"
 ],
 "passive-provider-chest": [
  "chest",
  "#f18b86",
  "#a53448",
  "↑"
 ],
 "requester-chest": [
  "chest",
  "#82bdf0",
  "#3357a4",
  "↓"
 ],
 "storage-chest": [
  "chest",
  "#f1c369",
  "#ac7b33",
  "□"
 ],
 "iron-chest": [
  "chest",
  "#bac9d7",
  "#6e8291",
  ""
 ],
 "steel-chest": [
  "chest",
  "#c3d5df",
  "#657e98",
  "S"
 ],
 "wooden-chest": [
  "chest",
  "#d3a16c",
  "#765d47",
  ""
 ],
 "accumulator": [
  "accumulator",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "arithmetic-combinator": [
  "combinator",
  "#f4a380",
  "#a84b3f",
  "+"
 ],
 "decider-combinator": [
  "combinator",
  "#f18b86",
  "#a53448",
  "≥"
 ],
 "constant-combinator": [
  "combinator",
  "#79d0ad",
  "#236b54",
  "1"
 ],
 "selector-combinator": [
  "combinator",
  "#ce9df0",
  "#8549b9",
  "↕"
 ],
 "artillery-shell": [
  "shell",
  "#f4a380",
  "#a84b3f",
  "A"
 ],
 "artillery-turret": [
  "turretHeavy",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "artillery-wagon": [
  "artilleryWagon",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "assembling-machine-1": [
  "assembler",
  "#b4c1ce",
  "#596a7e",
  "1"
 ],
 "assembling-machine-2": [
  "assembler",
  "#82bdf0",
  "#3357a4",
  "2"
 ],
 "assembling-machine-3": [
  "assembler",
  "#f1c369",
  "#ac7b33",
  "3"
 ],
 "atomic-bomb": [
  "bomb",
  "#a8ed70",
  "#477c39",
  ""
 ],
 "barrel": [
  "barrel",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "beacon": [
  "beacon",
  "#ce9df0",
  "#8549b9",
  ""
 ],
 "belt-immunity-equipment": [
  "equipment",
  "#f1c369",
  "#ac7b33",
  "≫"
 ],
 "big-electric-pole": [
  "pole",
  "#c3d5df",
  "#657e98",
  "L"
 ],
 "small-electric-pole": [
  "pole",
  "#d3a16c",
  "#765d47",
  "S"
 ],
 "medium-electric-pole": [
  "pole",
  "#bac9d7",
  "#6e8291",
  "M"
 ],
 "boiler": [
  "boiler",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "bulk-inserter": [
  "inserter",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "burner-inserter": [
  "inserter",
  "#96a3b2",
  "#35444e",
  ""
 ],
 "fast-inserter": [
  "inserter",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "long-handed-inserter": [
  "inserter",
  "#f18b86",
  "#a53448",
  ""
 ],
 "burner-mining-drill": [
  "drill",
  "#96a3b2",
  "#35444e",
  ""
 ],
 "electric-mining-drill": [
  "drill",
  "#bac9d7",
  "#6e8291",
  "E"
 ],
 "cannon-shell": [
  "shell",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "explosive-cannon-shell": [
  "shell",
  "#f18b86",
  "#a53448",
  "!"
 ],
 "explosive-uranium-cannon-shell": [
  "shell",
  "#a8ed70",
  "#477c39",
  "!"
 ],
 "uranium-cannon-shell": [
  "shell",
  "#a8ed70",
  "#477c39",
  "U"
 ],
 "car": [
  "car",
  "#d3a16c",
  "#765d47",
  ""
 ],
 "cargo-landing-pad": [
  "landing",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "cargo-wagon": [
  "cargoWagon",
  "#b4c1ce",
  "#596a7e",
  ""
 ],
 "fluid-wagon": [
  "fluidWagon",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "locomotive": [
  "locomotive",
  "#f18b86",
  "#a53448",
  ""
 ],
 "tank": [
  "tankVehicle",
  "#b19c76",
  "#675741",
  ""
 ],
 "spidertron": [
  "spider",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "train-stop": [
  "trainStop",
  "#f18b86",
  "#a53448",
  ""
 ],
 "rail-signal": [
  "signal",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "rail-chain-signal": [
  "chainSignal",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "centrifuge": [
  "centrifuge",
  "#a8ed70",
  "#477c39",
  ""
 ],
 "chemical-plant": [
  "chemical",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "cliff-explosives": [
  "explosives",
  "#f4a380",
  "#a84b3f",
  "C"
 ],
 "cluster-grenade": [
  "grenade",
  "#f18b86",
  "#a53448",
  "3"
 ],
 "grenade": [
  "grenade",
  "#b19c76",
  "#675741",
  ""
 ],
 "shotgun": [
  "shotgun",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "combat-shotgun": [
  "shotgun",
  "#f18b86",
  "#a53448",
  "C"
 ],
 "submachine-gun": [
  "gun",
  "#b4c1ce",
  "#596a7e",
  ""
 ],
 "concrete": [
  "slab",
  "#b7b2a6",
  "#807b77",
  ""
 ],
 "hazard-concrete": [
  "slab",
  "#f1c369",
  "#ac7b33",
  "!"
 ],
 "refined-concrete": [
  "slab",
  "#c3d5df",
  "#657e98",
  "R"
 ],
 "refined-hazard-concrete": [
  "slab",
  "#f4a380",
  "#a84b3f",
  "!"
 ],
 "construction-robot": [
  "robot",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "logistic-robot": [
  "robot",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "defender-capsule": [
  "capsule",
  "#b4c1ce",
  "#596a7e",
  "D"
 ],
 "distractor-capsule": [
  "capsule",
  "#82bdf0",
  "#3357a4",
  "D"
 ],
 "destroyer-capsule": [
  "capsule",
  "#f18b86",
  "#a53448",
  "X"
 ],
 "slowdown-capsule": [
  "capsule",
  "#ce9df0",
  "#8549b9",
  "S"
 ],
 "poison-capsule": [
  "capsule",
  "#79d0ad",
  "#236b54",
  "P"
 ],
 "discharge-defense-equipment": [
  "equipment",
  "#7cc7d4",
  "#277b9e",
  "⚡"
 ],
 "display-panel": [
  "display",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "efficiency-module": [
  "module",
  "#79d0ad",
  "#236b54",
  "1"
 ],
 "efficiency-module-2": [
  "module",
  "#79d0ad",
  "#236b54",
  "2"
 ],
 "efficiency-module-3": [
  "module",
  "#79d0ad",
  "#236b54",
  "3"
 ],
 "speed-module": [
  "module",
  "#82bdf0",
  "#3357a4",
  "1"
 ],
 "speed-module-2": [
  "module",
  "#82bdf0",
  "#3357a4",
  "2"
 ],
 "speed-module-3": [
  "module",
  "#82bdf0",
  "#3357a4",
  "3"
 ],
 "productivity-module-2": [
  "module",
  "#ce9df0",
  "#8549b9",
  "2"
 ],
 "productivity-module-3": [
  "module",
  "#ce9df0",
  "#8549b9",
  "3"
 ],
 "energy-shield-equipment": [
  "shield",
  "#82bdf0",
  "#3357a4",
  "1"
 ],
 "energy-shield-mk2-equipment": [
  "shield",
  "#ce9df0",
  "#8549b9",
  "2"
 ],
 "exoskeleton-equipment": [
  "legs",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "explosive-rocket": [
  "missile",
  "#f18b86",
  "#a53448",
  "!"
 ],
 "rocket": [
  "missile",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "express-splitter": [
  "splitter",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "fast-splitter": [
  "splitter",
  "#f18b86",
  "#a53448",
  ""
 ],
 "splitter": [
  "splitter",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "express-transport-belt": [
  "belt",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "express-underground-belt": [
  "underground",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "fast-underground-belt": [
  "underground",
  "#f18b86",
  "#a53448",
  ""
 ],
 "underground-belt": [
  "underground",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "crude-oil-barrel": [
  "barrel",
  "#96a3b2",
  "#35444e",
  ""
 ],
 "heavy-oil-barrel": [
  "barrel",
  "#b19c76",
  "#675741",
  ""
 ],
 "light-oil-barrel": [
  "barrel",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "lubricant-barrel": [
  "barrel",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "petroleum-gas-barrel": [
  "barrel",
  "#b4c1ce",
  "#596a7e",
  ""
 ],
 "sulfuric-acid-barrel": [
  "barrel",
  "#ecdc65",
  "#a29c35",
  ""
 ],
 "water-barrel": [
  "barrel",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "firearm-magazine": [
  "magazine",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "piercing-rounds-magazine": [
  "magazine",
  "#f18b86",
  "#a53448",
  ""
 ],
 "uranium-rounds-magazine": [
  "magazine",
  "#a8ed70",
  "#477c39",
  ""
 ],
 "shotgun-shell": [
  "shotShells",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "piercing-shotgun-shell": [
  "shotShells",
  "#f18b86",
  "#a53448",
  ""
 ],
 "flamethrower": [
  "flamer",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "flamethrower-ammo": [
  "fuelCan",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "flamethrower-turret": [
  "flameTurret",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "gun-turret": [
  "gunTurret",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "laser-turret": [
  "laserTurret",
  "#f18b86",
  "#a53448",
  ""
 ],
 "gate": [
  "gate",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "stone-wall": [
  "wall",
  "#b7b2a6",
  "#807b77",
  ""
 ],
 "heat-exchanger": [
  "heatExchanger",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "heat-pipe": [
  "heatPipe",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "light-armor": [
  "armor",
  "#b4c1ce",
  "#596a7e",
  "L"
 ],
 "heavy-armor": [
  "armor",
  "#c3d5df",
  "#657e98",
  "H"
 ],
 "modular-armor": [
  "armor",
  "#82bdf0",
  "#3357a4",
  "M"
 ],
 "power-armor": [
  "armor",
  "#f1c369",
  "#ac7b33",
  "1"
 ],
 "power-armor-mk2": [
  "armor",
  "#ce9df0",
  "#8549b9",
  "2"
 ],
 "lab": [
  "lab",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "small-lamp": [
  "lamp",
  "#e6e9eb",
  "#8795a5",
  ""
 ],
 "land-mine": [
  "mine",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "landfill": [
  "landfill",
  "#d3a16c",
  "#765d47",
  ""
 ],
 "night-vision-equipment": [
  "nightVision",
  "#79d0ad",
  "#236b54",
  ""
 ],
 "nuclear-reactor": [
  "reactor",
  "#a8ed70",
  "#477c39",
  ""
 ],
 "offshore-pump": [
  "pump",
  "#82bdf0",
  "#3357a4",
  "W"
 ],
 "pump": [
  "pump",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "oil-refinery": [
  "refinery",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "battery-equipment": [
  "battery",
  "#7cc7d4",
  "#277b9e",
  "1"
 ],
 "battery-mk2-equipment": [
  "battery",
  "#82bdf0",
  "#3357a4",
  "2"
 ],
 "personal-laser-defense-equipment": [
  "equipment",
  "#f18b86",
  "#a53448",
  "L"
 ],
 "personal-roboport-equipment": [
  "roboport",
  "#82bdf0",
  "#3357a4",
  "1"
 ],
 "personal-roboport-mk2-equipment": [
  "roboport",
  "#ce9df0",
  "#8549b9",
  "2"
 ],
 "pipe-to-ground": [
  "pipeUnder",
  "#bac9d7",
  "#6e8291",
  ""
 ],
 "fission-reactor-equipment": [
  "reactor",
  "#f1c369",
  "#ac7b33",
  "F"
 ],
 "solar-panel-equipment": [
  "solar",
  "#82bdf0",
  "#3357a4",
  "E"
 ],
 "solar-panel": [
  "solar",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "power-switch": [
  "switch",
  "#f1c369",
  "#ac7b33",
  ""
 ],
 "programmable-speaker": [
  "speaker",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "pumpjack": [
  "pumpjack",
  "#b19c76",
  "#675741",
  ""
 ],
 "radar": [
  "radar",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "repair-pack": [
  "repair",
  "#f18b86",
  "#a53448",
  ""
 ],
 "roboport": [
  "roboport",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "rocket-launcher": [
  "launcher",
  "#f4a380",
  "#a84b3f",
  ""
 ],
 "rocket-silo": [
  "silo",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "steam-engine": [
  "steamEngine",
  "#bac9d7",
  "#6e8291",
  ""
 ],
 "steam-turbine": [
  "turbine",
  "#7cc7d4",
  "#277b9e",
  ""
 ],
 "steel-furnace": [
  "furnace",
  "#c3d5df",
  "#657e98",
  "S"
 ],
 "stone-furnace": [
  "furnace",
  "#b7b2a6",
  "#807b77",
  ""
 ],
 "storage-tank": [
  "storageTank",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "substation": [
  "substation",
  "#82bdf0",
  "#3357a4",
  ""
 ],
 "uranium-fuel-cell": [
  "fuelCell",
  "#a8ed70",
  "#477c39",
  ""
 ],
 "military-science-pack": [
  "science",
  "#b4c1ce",
  "#596a7e",
  ""
 ],
 "calcite": [
  "ore",
  "#e6e9eb",
  "#8795a5",
  ""
 ],
 "tungsten-plate": [
  "plate",
  "#96a3b2",
  "#35444e",
  ""
 ],
 "uranium-235": [
  "crystal",
  "#a8ed70",
  "#477c39",
  "235"
 ],
 "uranium-238": [
  "crystal",
  "#79d0ad",
  "#236b54",
  "238"
 ],
 "wood": [
  "ore",
  "#d3a16c",
  "#765d47",
  ""
 ],
 "spoilage": [
  "ore",
  "#b19c76",
  "#675741",
  ""
 ],
 "crude-oil": [
  "fluid",
  "#96a3b2",
  "#35444e",
  ""
 ],
 "superconductor": [
  "circuit",
  "#ce9df0",
  "#8549b9",
  ""
 ],
 "biter-egg": [
  "egg",
  "#ed91aa",
  "#9d557b",
  ""
 ],
 "tungsten-carbide": [
  "crystal",
  "#c3d5df",
  "#657e98",
  ""
 ],
 "rocket-turret": [
  "turretHeavy",
  "#f18b86",
  "#a53448",
  ""
 ],
 "raw-fish": [
  "fish",
  "#7cc7d4",
  "#277b9e",
  ""
 ]
};
const silhouettes={
 accumulator:'M12 20h40v34H12z M23 12h18v8H23z M32 25l-8 12h9l-4 10 13-17h-10z',
 combinator:'M10 17h44v30H10z M15 10v7 M25 10v7 M39 47v7 M49 47v7 M18 25h28v14H18z',
 shell:'M24 49V23l8-15 8 15v26z M21 49h22v7H21z M24 29h16',
 turretHeavy:'M10 48h44v8H10z M18 36h28v12H18z M20 35l7-13h15l10 7v8z M33 23l17-15 7 6-16 14',
 artilleryWagon:'M7 32h50v16H7z M14 48v5h8v-5 M42 48v5h8v-5 M26 31l17-21 8 5-14 16z',
 assembler:'M11 12h42v42H11z M17 18h30v30H17z M32 23v18 M23 32h18 M25 25l14 14 M39 25L25 39',
 bomb:'M32 8l11 15v17l-11 12-11-12V23z M21 40l-7 12 11-3 M43 40l7 12-11-3 M27 26h10v8H27z',
 barrel:'M18 12h28l4 8v24l-4 8H18l-4-8V20z M14 22h36 M14 42h36 M20 32h24',
 beacon:'M14 47h36v8H14z M24 47V31h16v16 M32 31V12 M22 18q10-12 20 0 M16 12q16-16 32 0',
 equipment:'M13 13h38v38H13z M19 19h26v26H19z M12 27H7 M12 37H7 M52 27h5 M52 37h5',
 pole:'M29 12h6v44h-6z M12 16h40 M15 16v7 M49 16v7 M22 56h20 M22 29l10-7 10 7',
 boiler:'M10 23h44v25H10z M16 18h12v5 M40 14h9v9 M18 48v7 M46 48v7 M25 29l-5 8 8-1-3 8 14-13-8 1',
 car:'M9 29h8l7-12h18l9 12h6v17H9z M24 20h17l6 9H20z M14 46v6h10v-6 M42 46v6h10v-6',
 landing:'M8 10h48v44H8z M15 17h34v30H15z M23 23v18 M41 23v18 M23 32h18',
 cargoWagon:'M7 24h50v23H7z M12 18h40v6 M16 28v14 M27 28v14 M38 28v14 M49 28v14 M14 47v6h8v-6 M42 47v6h8v-6',
 fluidWagon:'M7 42h50v7H7z M14 24q0-7 9-7h18q9 0 9 7v13q0 5-9 5H23q-9 0-9-5z M30 17v-5h8v5 M15 49v5h8v-5 M41 49v5h8v-5',
 locomotive:'M7 34h8V20h28v7h8l7 10v12H7z M19 24h14v10H19z M38 30h10 M13 49v5h9v-5 M41 49v5h9v-5 M7 38H2',
 tankVehicle:'M8 35h48v17H8z M15 40h34v7H15z M18 34l7-12h17l8 12 M33 24V13h22v7H39',
 spider:'M24 23h16v18H24z M24 25L13 15 5 28 M40 25l11-10 8 13 M24 32L10 33 4 44 M40 32l14 1 6 11 M24 39L14 48 7 56 M40 39l10 9 7 8',
 trainStop:'M13 54h38 M18 54V12h28v22H18z M25 20h14 M25 27h14 M28 34v20',
 signal:'M29 51h6v7h-6z M21 10h22v41H21z M32 17v1 M32 30v1 M32 43v1',
 chainSignal:'M29 51h6v7h-6z M21 9h22v42H21z M26 18h12v8H26z M26 34h12v8H26z',
 centrifuge:'M13 15h38v38H13z M32 21a11 11 0 1 1-.1 0 M32 23v18 M24 27l16 10 M40 27L24 37',
 chemical:'M8 42h48v12H8z M12 18h15v24H12z M37 13h15v29H37z M27 26h10 M27 35h10 M16 13h7 M41 8h7',
 grenade:'M22 18h20v7H22z M24 25h16l8 13-6 15H22l-6-15z M31 11h13v7 M23 35h18 M23 44h18',
 shotgun:'M7 42l14-10h34v-7H21L8 31z M20 32v12 M32 25v7 M43 25v7',
 gun:'M9 20h46v9H37l-3 9H21l-3 13H8l6-23H9z M29 29v17h8l4-17',
 slab:'M8 32l31-16 17 13-31 18z M8 32v12l17 10 31-16v-9 M25 47v7 M22 26l17 13 M33 20l17 13',
 capsule:'M20 14h24v8H20z M17 22h30v27l-5 6H22l-5-6z M23 28h18v13H23z M32 42v8',
 display:'M8 13h48v34H8z M14 19h36v22H14z M26 47v7 M38 47v7 M20 54h24 M19 26h26 M19 34h16',
 shield:'M32 9l20 8v18l-7 13-13 8-13-8-7-13V17z M32 17l12 5v12l-5 9-7 5-7-5-5-9V22z',
 legs:'M24 10h16v12H24z M27 22L18 38l3 16H10l-2-20 12-12 M37 22l9 16-3 16h11l2-20-12-12',
 missile:'M32 7l10 15v23H22V22z M22 36l-9 13 9-3 M42 36l9 13-9-3 M27 45v10 M37 45v10',
 splitter:'M9 13h19v38H9z M36 13h19v38H36z M15 23l4 4 4-4 M42 23l4 4 4-4 M19 38h27 M32 31v14',
 underground:'M10 15h44v17H10z M15 32v19h34V32 M24 21l8 8 8-8 M20 42h24',
 magazine:'M19 9h26v38l-7 9H19z M25 15v30 M33 15v30 M41 15v24 M20 10h24',
 shotShells:'M12 16h11v36H12z M27 10h11v42H27z M42 16h11v36H42z M12 42h11 M27 42h11 M42 42h11',
 flamer:'M7 35h30v-9h18v8H40l-8 12H20l-3 9H9l4-20 M48 26l7-7 M49 34l8 5',
 fuelCan:'M18 15h27v40H18z M24 8h15v7 M24 23h15v23H24z M28 23l7 23 M35 23l-7 23',
 flameTurret:'M10 46h44v9H10z M17 31h30v15H17z M25 30l12-16h17v8H42l-7 8 M54 14l6-4',
 gunTurret:'M10 46h44v9H10z M18 30h28v16H18z M27 30V15h8v15 M38 30V10h7v20',
 laserTurret:'M10 46h44v9H10z M19 30h26v16H19z M26 30l8-17h10l-8 17 M44 13l12-7 M46 18h12',
 gate:'M8 13h8v42H8z M48 13h8v42H48z M16 23h32v24H16z M24 23v24 M32 23v24 M40 23v24',
 wall:'M8 20h48v33H8z M8 31h48 M8 42h48 M20 20v11 M44 20v11 M32 31v11 M20 42v11 M44 42v11',
 heatExchanger:'M9 15h46v34H9z M17 22v20h7V22h8v20h8V22h7v20 M4 28h5 M55 36h5',
 heatPipe:'M12 12h14v24h26v14H12z M12 20h14 M12 29h14 M22 36v14 M34 36v14 M46 36v14',
 armor:'M19 12l9 5h8l9-5 10 12-11 9v21H20V33L9 24z M25 25h14v20H25z',
 lab:'M12 49h40v7H12z M16 49V29a16 16 0 0 1 32 0v20 M24 33h16v10H24z M24 19l8-7 8 7',
 lamp:'M23 46h18v8H23z M28 46V35 M36 46V35 M19 25a13 13 0 1 1 26 0l-7 10H26z M12 12l-4-4 M52 12l4-4',
 mine:'M12 44h40v10H12z M18 44l7-17h14l7 17 M29 27V17h6v10 M13 39h6 M45 39h6',
 landfill:'M7 41l9-10 10 5 7-19 10 9 14 15v12H7z M15 44l12 5 M33 36l16 11',
 nightVision:'M9 19h20v22H9z M35 19h20v22H35z M29 28h6 M15 24h8v12h-8z M41 24h8v12h-8z',
 reactor:'M16 12h32v41H16z M22 19h20v27H22z M32 24v17 M24 32h16 M7 19h9 M48 19h9 M7 43h9 M48 43h9',
 pump:'M10 25h44v20H10z M20 18h24v7 M22 30h20v10H22z M32 30v10 M4 29h6 M54 29h6',
 refinery:'M8 49h48v7H8z M12 16h12v33H12z M28 9h12v40H28z M44 23h10v26H44z M24 30h4 M40 36h4',
 roboport:'M11 11h42v42H11z M18 18h28v28H18z M23 23v18 M41 23v18 M23 32h18 M7 32h4 M53 32h4',
 pipeUnder:'M8 10h18v22H8z M38 32h18v22H38z M17 32v8h30v-8 M10 18h14 M40 46h14',
 switch:'M10 23h15v20H10z M39 23h15v20H39z M25 33l14-15 M25 33h-3 M39 33h3',
 speaker:'M10 24h13l21-14v44L23 40H10z M49 23q12 9 0 18 M53 16q18 16 0 32',
 pumpjack:'M8 52h48 M19 52l9-31 9 31 M12 20l40-10 4 9-37 10 M48 21v27 M13 20v13h7',
 radar:'M12 53h40 M32 53V36 M15 16q3 20 22 20l12-15z M32 28l14-14 M49 11l6-5',
 repair:'M14 14h36v36H14z M32 21v22 M21 32h22 M10 10l6 6 M48 48l6 6',
 launcher:'M9 37l13-19h32v11H31L20 45H9z M30 29l-8 17h9l8-17 M50 18V9h7v9',
 silo:'M10 48h44v8H10z M15 18h34v30H15z M22 24h20v18H22z M32 9l7 12H25z',
 steamEngine:'M8 25h48v22H8z M13 18h38v7 M16 47v7 M48 47v7 M20 31h24v10H20z M32 31v10',
 turbine:'M12 18h40v34H12z M32 24a11 11 0 1 1-.1 0 M32 24l4 12-4 11-4-11z M8 25h4 M52 25h4',
 storageTank:'M12 19q20-13 40 0v28q-20 13-40 0z M12 19q20 11 40 0 M12 45q20 11 40 0 M28 11v-5h8v5',
 substation:'M9 16h46v38H9z M15 22h34v26H15z M22 22v26 M42 22v26 M12 10h40 M19 10v6 M45 10v6',
 fuelCell:'M20 11h24v42H20z M25 17h14v30H25z M32 21v22 M25 32h14 M20 11h24',
 egg:'M32 9q-15 10-17 29a17 17 0 0 0 34 0Q47 19 32 9z M24 28l8 6 7-9',
 fish:'M10 32q15-20 32-9l14-10v38L42 41q-17 11-32-9z M22 28h1 M29 23v18'
};
function customShape(type,id,light,dark){
 const d=silhouettes[type];if(!d)return null;
 const ink='#142636';
 return '<path d="'+d+'" fill="'+dark+'" stroke="'+ink+'" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="'+d+'" fill="none" stroke="'+light+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
}
function badgeGlyph(value){
 if(!value)return '';
 return '<rect x="39" y="39" width="22" height="22" rx="5" fill="#142636" stroke="#d6e7ef" stroke-width="1.5"/><text x="50" y="54" font-family="system-ui,sans-serif" text-anchor="middle" font-size="'+(value.length>2?9:13)+'" font-weight="800" fill="#f4faff">'+value+'</text>';
}

const line=(d,color,w=2.5)=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const rect=(x,y,w,h,r,fill,stroke='',sw=2)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';
const circle=(x,y,r,fill,stroke='',sw=2)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';
const poly=(points,fill,stroke='',width=2)=>'<polygon points="'+points+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'"':'')+'/>';
const teeth=(cx,cy,outer,inner,count)=>{
 const coords=[];for(let i=0;i<count*4;i++){
  const a=(i/(count*4))*Math.PI*2-Math.PI/2;
  const r=(i%4===0||i%4===3)?outer:inner;
  coords.push((cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2));
 }
 return coords.join(' ');
};
function symbol(type,id,light,dark){
 const custom=customShape(type,id,light,dark);if(custom!==null)return custom;
 const ink='#142636',silver='#d6e7ef';
 const shine='#ffffff70';
 if(type==='ore')return [
  poly('13,44 12,31 21,21 34,24 41,37 36,50 21,52',dark,ink),
  poly('27,43 31,26 43,18 54,30 51,46 39,51',light,ink),
  line('33 28 L43 21 L49 30 M20 29 L27 34',shine,2),
  poly('21,42 18,36 25,29 29,39',light)
 ].join('');
 if(type==='plate')return [
  poly('12,39 42,32 53,39 24,48',dark,ink),
  poly('12,33 42,26 53,33 24,42',light,ink),
  poly('12,25 42,18 53,25 24,34',light,ink),
  line('17 25 L42 19',shine,2)
 ].join('');
 if(type==='brick')return [
  rect(10,28,44,22,3,dark,ink),
  rect(12,15,40,20,3,light,ink),
  line('12 26 H52 M33 26 V35 M22 35 V50 M45 35 V50',ink,2.5)
 ].join('');
 if(type==='cable')return [
  circle(30,33,17,dark,ink,2.5),circle(30,33,11,'#243747',light,4),
  circle(30,33,5,ink,light,2),
  line('13 35 C7 30 7 24 13 23 M47 31 L56 26 M48 39 L56 43',light,4)
 ].join('');
 if(type==='gear')return [
  poly(teeth(32,32,25,20,10),dark,ink,2.6),circle(32,32,17,light,ink),
  circle(32,32,8,'#233b4a',ink),circle(32,32,3,light)
 ].join('');
 if(type==='rod')return [
  line('16 16 L45 45',ink,9),line('16 16 L45 45',light,6),
  line('14 29 L35 50',dark,7),line('14 29 L35 50',silver,3),
  line('29 12 L50 33',light,6)
 ].join('');
 if(type==='pipe')return [
  line('16 15 V43 H47',ink,16),line('16 15 V43 H47',light,11),
  rect(8,10,16,8,2,dark,ink),rect(43,34,9,18,2,dark,ink),
  line('11 43 H43',shine,2)
 ].join('');
 if(type==='circuit'){
  const pc=id==='advanced-circuit'?3:id==='processing-unit'?4:2;
  const darkBody= id==='advanced-circuit'?'#743039':id==='processing-unit'?'#284d81':'#24694d';
  const pins=Array.from({length:4},(_,i)=>line((15+i*9)+' 9 V16 M'+(15+i*9)+' 48 V55',light,2.7)).join('');
  return [
    rect(11,13,42,38,5,darkBody,ink,3),rect(16,18,32,28,3,light,dark,1.7),
    rect(22,24,20,16,3,darkBody,ink,2),
    pins,
    line('16 26 H22 M42 32 H50 M16 39 H22 M42 26 H48',shine,2),
    circle(32,32,pc+1,'#183241',light,1.8),
    circle(39,21,2,light),circle(17,44,2,dark)
  ].join('');
 }
 if(type==='lds')return [
  poly('12,42 23,17 50,25 53,45 36,51',dark,ink),
  poly('23,17 47,13 54,27 36,42 12,42',light,ink),
  line('23 17 L35 42 M47 13 L36 42',shine,3)
 ].join('');
 if(type==='engine')return [
  rect(13,22,41,26,5,dark,ink,3),
  rect(17,17,28,12,4,light,ink),
  circle(33,36,10,'#243a4e',light,2.5),
  circle(33,36,4,light,ink),
  line('27 29 L39 43 M39 29 L27 43',silver,2),
  rect(8,26,8,18,2,light,ink)
 ].join('');
 if(type==='battery')return [
  rect(19,13,25,40,5,dark,ink,2.5),
  rect(25,8,13,7,2,light,ink),
  rect(23,19,17,28,3,light,ink,1.5),
  line('32 26 V39 M26 33 H38',ink,3)
 ].join('');
 if(type==='robot')return [
  rect(24,24,17,18,5,light,ink,2.7),
  line('24 26 L14 16 M41 26 L51 16 M24 41 L14 51 M41 41 L51 51',dark,4),
  circle(14,16,7,light,ink),circle(51,16,7,light,ink),
  circle(14,51,7,light,ink),circle(51,51,7,light,ink),
  circle(32,32,4,dark)
 ].join('');
 if(type==='plastic')return [
  rect(10,33,38,13,3,dark,ink),rect(17,20,37,14,3,light,ink),
  line('22 24 H47 M15 37 H40',shine,2),
  line('12 46 L16 49 H47 L50 46',dark,3)
 ].join('');
 if(type==='crystal')return [
  poly('10,43 17,24 30,18 38,35 33,49 18,52',light,ink),
  poly('27,47 35,24 49,20 56,40 48,53',dark,ink),
  poly('22,23 30,18 32,35 26,46 17,43',shine),
  line('35 24 L49 20 L45 34',shine,2)
 ].join('');
 if(type==='flask')return [
  rect(25,9,15,7,2,light,ink),line('28 16 V27 L18 44 Q14 54 29 54 H44 Q52 54 46 44 L37 27 V16',ink,3.5),
  poly('21,43 44,42 48,50 42,53 24,53 18,48',light),
  line('23 42 H44',dark,3),circle(30,47,2,silver),circle(40,49,2,dark)
 ].join('');
 if(type==='explosives')return [
  rect(17,24,12,28,2,dark,ink),rect(31,20,12,32,2,light,ink),
  line('35 20 L41 11 L48 13',dark,2.7),
  line('17 36 H29 M31 34 H43',shine,2),
  circle(48,12,4,'#f9d480')
 ].join('');
 if(type==='fuel')return [
  poly('13,24 41,20 53,33 45,51 15,46',dark,ink,3),
  poly('13,24 41,20 37,40 15,46',light,ink),
  line('19 30 L35 27 M20 39 L30 35',shine,2)
 ].join('');
 if(type==='rocketfuel')return [
  rect(20,16,25,38,4,dark,ink,3),rect(24,12,17,6,2,light,ink),
  poly('33,21 24,36 34,35 28,49 43,30 33,32 40,21',light,ink,1),
  line('22 53 H44',shine,2)
 ].join('');
 if(type==='rail')return [
  line('12 18 H52 M11 29 H53 M10 41 H54 M9 51 H55',dark,7),
  line('15 10 L9 55 M49 10 L55 55',light,6),
  line('15 10 L9 55 M49 10 L55 55',ink,1)
 ].join('');
 if(type==='turret')return [
  rect(10,39,44,14,5,dark,ink,2.8),rect(18,29,28,17,5,light,ink,2.7),
  circle(32,31,10,dark,ink,2.5),circle(32,31,4,light,ink),
  rect(29,11,7,16,3,light,ink),line('33 13 L40 8',silver,3)
 ].join('');
 if(type==='solar')return [
  poly('7,23 47,16 56,37 15,44',dark,ink,2.6),poly('11,25 45,19 51,35 17,40',light,ink,1.6),
  line('24 23 L29 39 M36 21 L41 37 M13 31 L49 26',ink,2),line('33 42 V52 M20 54 H45',silver,3)
 ].join('');
 if(type==='chest')return [
  rect(14,23,37,32,5,dark,ink,3),poly('14,23 26,14 56,20 51,29',light,ink,2),
  rect(27,32,14,9,2,light,ink,2),line('19 27 L19 50 M45 31 L45 51',shine,2)
 ].join('');
 if(type==='drill')return [
  rect(12,29,41,25,5,dark,ink,3),poly('27,8 41,21 32,39 22,21',light,ink,2.5),
  rect(17,44,31,9,2,light,ink),line('8 54 H57',ink,3)
 ].join('');
 if(type==='module')return [
  rect(14,11,36,42,5,dark,ink,3),
  rect(19,17,26,27,3,light,ink,2),
  poly('32,21 23,33 32,40 41,33',dark,ink),
  Array.from({length:4},(_,i)=>rect(18+i*8,49,4,7,1,light,ink,1)).join('')
 ].join('');
 if(type==='furnace')return [
  rect(12,12,42,41,5,dark,ink,3),
  rect(17,19,32,23,3,'#2c394a',light,2),
  poly('32,22 26,33 30,30 28,40 41,31 36,32 38,26',light,ink),
  rect(19,45,29,5,2,light,ink)
 ].join('');
 if(type==='belt')return [
  rect(10,17,44,32,7,dark,ink,3),
  rect(14,23,36,19,4,'#243a47',light,2),
  circle(20,32,4,light),circle(32,32,4,light),circle(44,32,4,light),
  line('13 18 H50 M13 48 H50',light,3)
 ].join('');
 if(type==='inserter')return [
  rect(22,45,24,10,3,dark,ink),
  circle(33,44,7,light,ink),line('31 39 L23 25 L42 13',light,6),
  circle(23,25,5,dark,ink),
  line('42 13 L50 18 M42 13 L37 7',ink,3.6)
 ].join('');
 if(type==='science')return [
  rect(17,41,31,11,5,dark,ink,2.5),
  rect(24,12,17,7,2,light,ink),
  line('27 19 V29 L20 42 Q20 50 32 50 Q44 50 44 42 L37 29 V19',ink,3.3),
  poly('23,36 40,34 45,43 42,49 23,49 20,43',light,ink,1),
  circle(30,41,3,'#ffffff90'),circle(38,44,2,dark)
 ].join('');
 if(type==='fluid')return [
  '<path d="M32 8 C27 21 15 31 15 42 A17 17 0 0 0 49 42 C49 31 37 18 32 8Z" fill="'+dark+'" stroke="'+ink+'" stroke-width="3"/>',
  '<path d="M31 17 C23 30 22 34 22 41" stroke="'+light+'" stroke-width="5" fill="none" stroke-linecap="round"/>',
  circle(37,45,4,light)
 ].join('');
 return [rect(14,14,36,36,7,dark,ink),circle(32,32,10,light,ink)].join('');
}
function derivedSpec(id){
 if(/turret|cannon|artillery|gun-/.test(id))return ['turret','#e7aa7e','#996243'];
 if(/solar-panel/.test(id))return ['solar','#89c7ee','#356d9e'];
 if(/mining-drill|pumpjack/.test(id))return ['drill','#cbd4dd','#687c95'];
 if(/chest|storage|container/.test(id))return ['chest','#c69d77','#765d47'];
 if(/module|beacon/.test(id))return ['module','#ba9ae1','#6c55a5'];
 if(/accumulator|battery/.test(id))return ['battery','#86d9c2','#368a86'];
 if(/science-pack/.test(id))return ['science','#bda6ee','#634fa8'];
 if(/robot|roboport/.test(id))return ['robot','#acc4dd','#537da5'];
 if(/belt|splitter/.test(id))return ['belt','#eac576','#a47536'];
 if(/inserter/.test(id))return ['inserter','#eac576','#a47536'];
 if(/circuit|combinator|processor/.test(id))return ['circuit','#82c6db','#396c91'];
 if(/engine|locomotive|wagon|car|tank/.test(id))return ['engine','#becbd5','#6b8196'];
 if(/furnace|machine|refinery|plant|centrifuge|silo|boiler|generator/.test(id))return ['furnace','#b6c4d3','#627b9b'];
 if(/plate|steel|concrete|brick|wall|stone/.test(id))return ['plate','#b9c5d4','#637a94'];
 if(/pipe/.test(id))return ['pipe','#b9c7d8','#657e94'];
 if(/rail|signal/.test(id))return ['rail','#b8c3d0','#63788e'];
 if(/ammo|magazine|round|explosive|grenade|rocket|shell|bomb/.test(id))return ['rocketfuel','#e9ad83','#9f5e42'];
 if(/gear|stick|cable/.test(id))return ['gear','#dfc89e','#9b7e56'];
 return ['ore','#a7c4d5','#5c7891'];
}
function color(id){return (S[String(id||'').toLowerCase()]||derivedSpec(String(id||'').toLowerCase()))[1]}
function glyph(id){const spec=S[id]||derivedSpec(id);return symbol(spec[0],id,spec[1],spec[2])+badgeGlyph(spec[3])}
function item(id,size=32){
 const safeId=String(id||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
 const spec=S[safeId]||derivedSpec(safeId);
 const px=Number.isFinite(Number(size))?Math.min(96,Math.max(16,Number(size))):32;
 const label=safeId.replace(/-/g,' ');
 return '<span class="item-icon" data-item-icon="'+safeId+'" style="--item-tone:'+spec[1]+';--item-back:'+spec[2]+';--icon-size:'+px+'px" aria-hidden="true">'+
 '<svg class="item-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false" aria-hidden="true">'+
 glyph(safeId)+'</svg></span>';
}
root.NauvisIcons={item,color,ids:Object.freeze(Object.keys(S)),version:'original-2'};
if(typeof module==='object'&&module.exports)module.exports={item,color,glyph,specs:S,symbol,derivedSpec};
})(typeof window==='undefined'?globalThis:window);
