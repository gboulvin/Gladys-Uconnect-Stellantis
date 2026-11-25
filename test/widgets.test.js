// -----------------------------------------------------------------------------
// Dashboard widgets: contents valid for the core (validateWidgetContent: []
// means rendered exactly as sent), live tiles bound to published features,
// handled buttons, served pictures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { createWidgets, WIDGET_COMMANDS, WIDGET_KEYS } from '../src/widgets.js';
import { deviceId, setup } from './helpers/setup.js';
import { EV_VIN, ICE_VIN } from './helpers/fake-cloud.js';

test('vehicle_status is rendered exactly as sent, for both vehicles', async () => {
  const { gladys, service } = await setup();
  const widget = createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS];
  for (const vin of [EV_VIN, ICE_VIN]) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const content = await widget.get({ settings: { vehicle: deviceId(gladys, vin) }, language });
      assert.deepEqual(validateWidgetContent(content), [], `${vin} ${language}`);
    }
  }
});

test('without a chosen vehicle, vehicle_status shows the first one', async () => {
  const { service } = await setup();
  const content = await createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS].get({});
  assert.equal(content.components[0].text, '500e');
});

test('the live tiles reference features the integration publishes', async () => {
  const { gladys, service } = await setup();
  const featureIds = new Set(
    gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.external_id)),
  );
  const content = await createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS].get({
    settings: { vehicle: deviceId(gladys, EV_VIN) },
  });
  const tiles = content.components.filter((c) => c.device_feature);
  assert.equal(tiles.length, 2, 'battery and range');
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), tile.device_feature);
  }
});

test('every button action is handled and answers a short toast', async () => {
  const { gladys, cloud, service } = await setup();
  const widget = createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS];
  const content = await widget.get({ settings: { vehicle: deviceId(gladys, EV_VIN) } });
  const buttons = content.components.filter((c) => c.type === 'button' && c.action);
  assert.ok(buttons.length >= 2);
  for (const { action } of buttons) {
    assert.ok(WIDGET_COMMANDS.includes(action.key));
    const message = await widget.action({ actionKey: action.key, params: action.params });
    for (const lang of ['en', 'fr', 'de', 'es']) {
      assert.ok(message[lang] && message[lang].length <= 200, `${action.key} ${lang}`);
    }
  }
  assert.ok(cloud.commands.some((c) => c.command === 'RDU'));
  const unlock = buttons.find((b) => b.action.key === 'unlock');
  assert.equal(unlock.action.confirm, true, 'unlocking asks for a confirmation');
});

test('an unknown widget action fails', async () => {
  const { service } = await setup();
  await assert.rejects(
    createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS].action({ actionKey: 'nope', params: {} }),
    /Unknown widget action/,
  );
});

test('fleet_overview lists every vehicle', async () => {
  const { service } = await setup();
  const content = await createWidgets(service)[WIDGET_KEYS.FLEET_OVERVIEW].get({ language: 'fr' });
  assert.deepEqual(validateWidgetContent(content), []);
  const [list] = content.components;
  assert.deepEqual(
    list.items.map((i) => [i.title, i.badge.text]),
    [
      ['500e', '63 %'],
      ['Wrangler', '58 %'],
    ],
  );
  assert.match(list.items[0].description, /Autonomie : 134 km|Autonomie: 134 km/);
});

test('without vehicles the widgets show a valid empty state', async () => {
  const { service } = await setup({ config: { email: '', password: '' } });
  const widgets = createWidgets(service);
  for (const key of Object.values(WIDGET_KEYS)) {
    assert.deepEqual(validateWidgetContent(await widgets[key].get({})), [], key);
  }
});

test('the vehicle picture is served as a valid image', async () => {
  const { gladys, service } = await setup();
  const content = await createWidgets(service)[WIDGET_KEYS.VEHICLE_STATUS].get({
    settings: { vehicle: deviceId(gladys, EV_VIN) },
  });
  const image = content.components.find((c) => c.type === 'image');
  assert.match(image.key, /^vehicle-[0-9a-f]{8}$/);
  const base64 = await service.imageBase64(image.key);
  assert.deepEqual(validateWidgetImage(base64), []);
});
