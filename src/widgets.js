// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
//   - `vehicle_status`: one vehicle (chosen per widget instance, the first
//     one by default): live tiles bound to its features, its picture, a
//     status list (doors, windows, charge, climate, location) and buttons
//     (lock, unlock, climate, map);
//   - `fleet_overview`: every vehicle of the account as a list of cards.
//
// The content is declarative: the core renders it with its own theme, dark
// mode and translations. index.js nudges the widgets after every refresh.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { DEVICE_TYPE, FEATURE } from './devices/vehicle.js';
import { pickLanguage } from './i18n.js';
import {
  allDoorsLocked,
  anyWindowOpen,
  displayName,
  isElectrified,
  timeToFullCharge,
} from './uconnect/models.js';
import { resolveCommand } from './uconnect/commands.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  VEHICLE_STATUS: 'vehicle_status',
  FLEET_OVERVIEW: 'fleet_overview',
};

// Commands a vehicle_status button can send.
export const WIDGET_COMMANDS = ['lock', 'unlock', 'climate_on', 'climate_off'];

const L = {
  battery: { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' },
  fuel: { en: 'Fuel', fr: 'Carburant', de: 'Kraftstoff', es: 'Combustible' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  odometer: { en: 'Odometer', fr: 'Kilométrage', de: 'Kilometerstand', es: 'Kilometraje' },
  doors: { en: 'Doors', fr: 'Portes', de: 'Türen', es: 'Puertas' },
  windows: { en: 'Windows', fr: 'Fenêtres', de: 'Fenster', es: 'Ventanillas' },
  charge: { en: 'Charge', fr: 'Recharge', de: 'Laden', es: 'Carga' },
  climate: { en: 'Climate', fr: 'Climatisation', de: 'Klimatisierung', es: 'Climatización' },
  engine: { en: 'Engine', fr: 'Moteur', de: 'Motor', es: 'Motor' },
  location: { en: 'Location', fr: 'Position', de: 'Standort', es: 'Ubicación' },
  tyres: { en: 'Tyres', fr: 'Pneus', de: 'Reifen', es: 'Neumáticos' },
  locked: { en: 'Locked', fr: 'Verrouillées', de: 'Verriegelt', es: 'Bloqueadas' },
  unlocked: { en: 'Unlocked', fr: 'Déverrouillées', de: 'Entriegelt', es: 'Desbloqueadas' },
  closed: { en: 'Closed', fr: 'Fermées', de: 'Geschlossen', es: 'Cerradas' },
  open: { en: 'Open', fr: 'Ouverte(s)', de: 'Offen', es: 'Abierta(s)' },
  charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  plugged: { en: 'Plugged in', fr: 'Branchée', de: 'Angesteckt', es: 'Enchufado' },
  unplugged: { en: 'Unplugged', fr: 'Débranchée', de: 'Nicht angesteckt', es: 'Desenchufado' },
  on: { en: 'On', fr: 'Allumé(e)', de: 'Ein', es: 'Encendido' },
  off: { en: 'Off', fr: 'Éteint(e)', de: 'Aus', es: 'Apagado' },
  ok: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  warning: {
    en: 'Pressure warning',
    fr: 'Alerte pression',
    de: 'Druckwarnung',
    es: 'Alerta de presión',
  },
  lock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Bloquear' },
  unlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Desbloquear' },
  climateOn: { en: 'Climate on', fr: 'Clim. on', de: 'Klima an', es: 'Clima on' },
  climateOff: { en: 'Climate off', fr: 'Clim. off', de: 'Klima aus', es: 'Clima off' },
  map: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  noVehicle: {
    en: 'No vehicle yet: configure your Uconnect account in the integration settings.',
    fr: 'Aucun véhicule pour l’instant : configurez votre compte Uconnect dans les réglages de l’intégration.',
    de: 'Noch kein Fahrzeug: Konfigurieren Sie Ihr Uconnect-Konto in den Einstellungen der Integration.',
    es: 'Aún no hay vehículos: configure su cuenta Uconnect en los ajustes de la integración.',
  },
  unknownVehicle: {
    en: 'This vehicle is no longer linked to the Uconnect account.',
    fr: 'Ce véhicule n’est plus associé au compte Uconnect.',
    de: 'Dieses Fahrzeug ist dem Uconnect-Konto nicht mehr zugeordnet.',
    es: 'Este vehículo ya no está vinculado a la cuenta Uconnect.',
  },
};

const UNIT_LABELS = { km: 'km', mi: 'mi', mile: 'mi', miles: 'mi' };

// Content budget of a widget (core rule).
const MAX_COMPONENTS = 8;

function mapUrl(location) {
  const { latitude, longitude } = location;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

// Join a multi-language label with a suffix in every language.
function withSuffix(label, suffix) {
  return Object.fromEntries(
    Object.entries(label).map(([lang, text]) => [lang, `${text} ${suffix}`]),
  );
}

function statusItems(vehicle) {
  const items = [];
  const locked = allDoorsLocked(vehicle);
  if (locked !== null) {
    items.push({
      label: L.doors,
      icon: locked ? 'lock' : 'unlock',
      value: locked ? L.locked : L.unlocked,
      color: locked ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    });
  }
  const windowOpen = anyWindowOpen(vehicle);
  if (windowOpen !== null) {
    items.push({
      label: L.windows,
      icon: 'wind',
      value: windowOpen ? L.open : L.closed,
      color: windowOpen ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (isElectrified(vehicle) && (vehicle.charging !== null || vehicle.pluggedIn !== null)) {
    let value = vehicle.pluggedIn ? L.plugged : L.unplugged;
    let color = vehicle.pluggedIn ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL;
    if (vehicle.charging) {
      const remaining = timeToFullCharge(vehicle);
      value = remaining ? withSuffix(L.charging, `· ${formatMinutes(remaining)}`) : L.charging;
      color = WIDGET_COLORS.SUCCESS;
    }
    items.push({ label: L.charge, icon: 'battery-charging', value, color });
  }
  if (vehicle.hvacOn !== null) {
    let value = vehicle.hvacOn ? L.on : L.off;
    if (vehicle.hvacOn && vehicle.hvacTemperature !== null) {
      const unit = (vehicle.hvacTemperatureUnit ?? 'C').slice(0, 1).toUpperCase();
      value = withSuffix(L.on, `· ${vehicle.hvacTemperature}°${unit}`);
    }
    items.push({
      label: L.climate,
      icon: 'thermometer',
      value,
      color: vehicle.hvacOn ? WIDGET_COLORS.PRIMARY : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (vehicle.ignitionOn !== null) {
    items.push({
      label: L.engine,
      icon: 'power',
      value: vehicle.ignitionOn ? L.on : L.off,
      color: vehicle.ignitionOn ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (vehicle.odometer !== null) {
    const unit = UNIT_LABELS[(vehicle.odometerUnit ?? 'km').toLowerCase()] ?? 'km';
    items.push({
      label: L.odometer,
      icon: 'activity',
      value: `${Math.round(vehicle.odometer)} ${unit}`,
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  const tyres = Object.values(vehicle.tyres);
  if (tyres.length > 0) {
    const warning = tyres.some((tyre) => tyre.warning === true);
    items.push({
      label: L.tyres,
      icon: 'disc',
      value: warning ? L.warning : L.ok,
      color: warning ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
    });
  }
  if (vehicle.location) {
    items.push({
      label: L.location,
      icon: 'map-pin',
      value: `${vehicle.location.latitude.toFixed(4)}, ${vehicle.location.longitude.toFixed(4)}`,
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  return items.slice(0, 10);
}

function liveTiles(service, vehicle) {
  const keys = service.featuresOf(vehicle);
  const ids = service.gladys.externalIds(DEVICE_TYPE, vehicle.vin);
  const tiles = [
    [FEATURE.BATTERY_LEVEL, L.battery, 'battery'],
    [FEATURE.FUEL_LEVEL, L.fuel, 'droplet'],
    [FEATURE.RANGE, L.range, 'navigation'],
  ];
  return tiles
    .filter(([key]) => keys.includes(key))
    .map(([key, label, icon]) => ({
      type: 'value',
      label,
      icon,
      device_feature: ids.feature(key),
    }));
}

function buttons(service, vehicle) {
  const device = service.deviceExternalId(vehicle.vin);
  const supported = (key) => resolveCommand(key, vehicle.enabledServices) !== null;
  const result = [];
  if (supported('lock')) {
    result.push({
      type: 'button',
      label: L.lock,
      icon: 'lock',
      style: 'primary',
      action: { key: 'lock', params: { device } },
    });
  }
  if (supported('unlock')) {
    result.push({
      type: 'button',
      label: L.unlock,
      icon: 'unlock',
      style: 'danger',
      // Unlocking a car from a wall-mounted dashboard deserves a second tap.
      action: { key: 'unlock', params: { device }, confirm: true },
    });
  }
  const climate = vehicle.hvacOn ? 'climate_off' : 'climate_on';
  if (supported(climate)) {
    result.push({
      type: 'button',
      label: vehicle.hvacOn ? L.climateOff : L.climateOn,
      icon: 'thermometer',
      style: 'secondary',
      action: { key: climate, params: { device } },
    });
  }
  if (vehicle.location) {
    result.push({
      type: 'button',
      label: L.map,
      icon: 'map',
      style: 'secondary',
      link: { url: mapUrl(vehicle.location) },
    });
  }
  return result.slice(0, 4);
}

function subtitle(vehicle) {
  return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || vehicle.vin;
}

const empty = (text) => ({
  ttl_seconds: 60,
  components: [{ type: 'text', variant: 'body', text }],
});

export function createWidgets(service) {
  return {
    [WIDGET_KEYS.VEHICLE_STATUS]: {
      async get({ settings = {} }) {
        logger.debug(`onWidgetGet <- ${WIDGET_KEYS.VEHICLE_STATUS}`);
        if (service.vehicles.length === 0) {
          return empty(L.noVehicle);
        }
        const vehicle = service.resolveVehicle(settings.vehicle);
        if (!vehicle) {
          return empty(L.unknownVehicle);
        }
        // The core keeps at most 8 components: name, 2 tiles, picture and
        // status leave room for 3 buttons (4 without a picture).
        const components = [
          { type: 'text', variant: 'heading', text: displayName(vehicle).slice(0, 40) },
          ...liveTiles(service, vehicle),
        ];
        const imageKey = await service.imageKey(vehicle);
        if (imageKey) {
          components.push({
            type: 'image',
            key: imageKey,
            alt: displayName(vehicle).slice(0, 60),
            fit: 'contain',
          });
        }
        const items = statusItems(vehicle);
        if (items.length > 0) {
          components.push({ type: 'status', items });
        }
        components.push(...buttons(service, vehicle).slice(0, MAX_COMPONENTS - components.length));
        return {
          // index.js nudges the widget after every refresh: the TTL is a net.
          ttl_seconds: Math.min(3600, service.config.refresh_interval * 60),
          components,
        };
      },

      async action({ actionKey, params }) {
        logger.info(`onWidgetAction <- ${WIDGET_KEYS.VEHICLE_STATUS}.${actionKey}`);
        if (!WIDGET_COMMANDS.includes(actionKey)) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        const vehicle = service.resolveVehicle(params.device);
        const { message } = await service.runCommand(vehicle, actionKey);
        return message;
      },
    },

    [WIDGET_KEYS.FLEET_OVERVIEW]: {
      async get({ language = 'en' }) {
        logger.debug(`onWidgetGet <- ${WIDGET_KEYS.FLEET_OVERVIEW}`);
        if (service.vehicles.length === 0) {
          return empty(L.noVehicle);
        }
        const items = [];
        for (const vehicle of service.vehicles.slice(0, 8)) {
          const item = {
            title: displayName(vehicle).slice(0, 60),
            subtitle: subtitle(vehicle).slice(0, 80),
          };
          const image = await service.imageKey(vehicle);
          if (image) {
            item.image = image;
          }
          const level = vehicle.stateOfCharge ?? vehicle.fuelAmount;
          if (level !== null) {
            let color = WIDGET_COLORS.SUCCESS;
            if (level < service.config.low_battery_threshold) {
              color = WIDGET_COLORS.DANGER;
            } else if (level < 50) {
              color = WIDGET_COLORS.WARNING;
            }
            item.badge = { text: `${Math.round(level)} %`, color };
          }
          const lines = statusItems(vehicle).map(
            (row) =>
              `${pickLanguage(row.label, language)}: ${
                typeof row.value === 'object' ? pickLanguage(row.value, language) : row.value
              }`,
          );
          if (vehicle.distanceToEmpty !== null) {
            const unit = UNIT_LABELS[(vehicle.distanceToEmptyUnit ?? 'km').toLowerCase()] ?? 'km';
            lines.unshift(
              `${pickLanguage(L.range, language)}: ${Math.round(vehicle.distanceToEmpty)} ${unit}`,
            );
          }
          if (lines.length > 0) {
            item.description = lines.join('\n').slice(0, 2000);
          }
          if (vehicle.location) {
            item.links = [{ url: mapUrl(vehicle.location), label: L.map }];
          }
          items.push(item);
        }
        return {
          ttl_seconds: Math.min(3600, service.config.refresh_interval * 60),
          components: [{ type: 'card-list', display: 'list', items }],
        };
      },
    },
  };
}

/** Ask the core to re-pull every widget (after a refresh, a config change). */
export function refreshWidgets(gladys, widgets) {
  for (const key of Object.keys(widgets)) {
    gladys.requestWidgetRefresh(key);
  }
}
