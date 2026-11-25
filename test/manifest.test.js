// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest, but nothing there knows which
// handlers the code registers — these tests keep both sides in sync, and pin
// the store rules that are easiest to miss.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { createActions } from '../src/actions.js';
import { createSceneActions } from '../src/scenes.js';
import { createWidgets } from '../src/widgets.js';
import { SCENE_TRIGGER_KEYS } from '../src/triggers.js';
import { BRANDS } from '../src/uconnect/brands.js';
import { VEHICLE_COMMANDS } from '../src/uconnect/commands.js';
import { COMMAND_LABELS, LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// The handlers only need the service to exist to be listed.
const fakeService = {};
const ACTIONS = createActions(fakeService);
const SCENE_ACTIONS = createSceneActions(fakeService);
const WIDGETS = createWidgets(fakeService);

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('the manifest identifies a cloud device integration', () => {
  assert.equal(manifest.type, 'device');
  assert.deepEqual(manifest.transports, ['cloud'], 'Uconnect is a cloud-only service');
  assert.ok(manifest.categories.includes('vehicles'));
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
});

test('capability fields and categories require Gladys >= 5.1.0', () => {
  for (const field of ['scene_triggers', 'scene_actions', 'widgets']) {
    assert.ok(manifest[field]?.length > 0, `${field} is declared`);
  }
  assert.ok(isAtLeast(minGladysVersion(), [5, 1, 0]), manifest.gladys_version);
  // keywords / countries would require 5.3.0: kept out on purpose.
  assert.equal(manifest.keywords, undefined);
  assert.equal(manifest.countries, undefined);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene_actions key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every widgets key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
  assert.ok(manifest.widgets.length <= 5);
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...SCENE_TRIGGER_KEYS].sort());
});

test('the command selects offer exactly the supported commands', () => {
  const selects = allFields.filter((f) => f.key === 'command');
  assert.equal(selects.length, 2, 'the manifest action and the scene action');
  for (const select of selects) {
    assert.deepEqual(
      select.options.map((o) => o.value),
      Object.keys(VEHICLE_COMMANDS),
    );
    for (const option of select.options) {
      assert.deepEqual(option.label, COMMAND_LABELS[option.value]);
    }
  }
});

test('the brand select offers exactly the supported brands', () => {
  const brand = manifest.config_schema.find((f) => f.key === 'brand');
  assert.deepEqual(
    brand.options.map((o) => o.value),
    Object.keys(BRANDS),
  );
  for (const option of brand.options) {
    assert.equal(option.label.en, BRANDS[option.value].label);
  }
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('credentials are secret fields', () => {
  const byKey = Object.fromEntries(manifest.config_schema.map((f) => [f.key, f]));
  assert.equal(byKey.password.type, 'secret');
  assert.equal(byKey.pin.type, 'secret');
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare a source and no static options', () => {
  const dynamic = allFields.filter((f) => f.source !== undefined);
  assert.ok(dynamic.length > 0);
  for (const field of dynamic) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, field.key);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`), manifest.docker_image);
  assert.match(manifest.docker_image, /^ghcr\.io\/gboulvin\/gladys-uconnect-stellantis:/);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `${lang}: ${text.length}`);
  }
});

test('widget labels hold 3 to 30 characters, descriptions at most 100', () => {
  for (const widget of manifest.widgets) {
    for (const text of Object.values(widget.label)) {
      assert.ok(text.length >= 3 && text.length <= 30, text);
    }
    for (const text of Object.values(widget.description ?? {})) {
      assert.ok(text.length <= 100, text);
    }
  }
});

// Every multi-language text of the manifest, with its JSON path.
function multiLanguageTexts(node, path = '$') {
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => multiLanguageTexts(item, `${path}[${i}]`));
  }
  if (!node || typeof node !== 'object') {
    return [];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    ['label', 'description', 'placeholder'].includes(key) && value && typeof value === 'object'
      ? [[`${path}.${key}`, value]]
      : multiLanguageTexts(value, `${path}.${key}`),
  );
}

test('every manifest text is translated in English, French, German and Spanish', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 100);
  for (const [path, text] of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), path);
    for (const lang of LANGUAGES) {
      assert.ok(typeof text[lang] === 'string' && text[lang].length > 0, `${path}.${lang}`);
    }
  }
});

test('the user documentation exists in the four languages', async () => {
  for (const lang of LANGUAGES) {
    await access(new URL(`../docs/${lang}.md`, import.meta.url));
  }
});
