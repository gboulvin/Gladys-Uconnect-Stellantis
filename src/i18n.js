// -----------------------------------------------------------------------------
// User-facing texts, in the four languages of the integration (English,
// French, German, Spanish). Gladys picks the user's language from a
// multi-language object, English being the fallback: every message below is
// such an object. `{name}` placeholders are filled by `t()`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const MESSAGES = {
  // Connection status / manifest actions
  not_configured: {
    en: 'Enter the e-mail and password of your Uconnect account.',
    fr: 'Renseignez l’e-mail et le mot de passe de votre compte Uconnect.',
    de: 'Geben Sie die E-Mail-Adresse und das Passwort Ihres Uconnect-Kontos ein.',
    es: 'Introduzca el correo electrónico y la contraseña de su cuenta Uconnect.',
  },
  auth_failed: {
    en: 'Login refused: check the e-mail, the password and the brand / region.',
    fr: 'Connexion refusée : vérifiez l’e-mail, le mot de passe et la marque / région.',
    de: 'Anmeldung abgelehnt: Prüfen Sie E-Mail, Passwort und Marke / Region.',
    es: 'Inicio de sesión rechazado: compruebe el correo, la contraseña y la marca / región.',
  },
  cloud_unreachable: {
    en: 'The Uconnect cloud cannot be reached, retrying at the next refresh.',
    fr: 'Le cloud Uconnect est injoignable, nouvel essai au prochain rafraîchissement.',
    de: 'Die Uconnect-Cloud ist nicht erreichbar, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'No se puede acceder a la nube Uconnect, se reintentará en la próxima actualización.',
  },
  connection_ok: {
    en: 'Connected: {count} vehicle(s) found ({names}).',
    fr: 'Connecté : {count} véhicule(s) trouvé(s) ({names}).',
    de: 'Verbunden: {count} Fahrzeug(e) gefunden ({names}).',
    es: 'Conectado: {count} vehículo(s) encontrado(s) ({names}).',
  },
  connection_no_vehicle: {
    en: 'Connected, but no vehicle is linked to this account.',
    fr: 'Connecté, mais aucun véhicule n’est associé à ce compte.',
    de: 'Verbunden, aber diesem Konto ist kein Fahrzeug zugeordnet.',
    es: 'Conectado, pero no hay ningún vehículo vinculado a esta cuenta.',
  },
  refresh_done: {
    en: 'Vehicles refreshed.',
    fr: 'Véhicules rafraîchis.',
    de: 'Fahrzeuge aktualisiert.',
    es: 'Vehículos actualizados.',
  },
  // Commands
  command_success: {
    en: '{vehicle}: "{command}" done.',
    fr: '{vehicle} : « {command} » effectué.',
    de: '{vehicle}: „{command}“ ausgeführt.',
    es: '{vehicle}: «{command}» realizado.',
  },
  command_sent: {
    en: '{vehicle}: "{command}" sent, the vehicle has not confirmed yet.',
    fr: '{vehicle} : « {command} » envoyé, le véhicule n’a pas encore confirmé.',
    de: '{vehicle}: „{command}“ gesendet, das Fahrzeug hat noch nicht bestätigt.',
    es: '{vehicle}: «{command}» enviado, el vehículo aún no lo ha confirmado.',
  },
  command_failed: {
    en: '{vehicle}: the vehicle reported that "{command}" failed.',
    fr: '{vehicle} : le véhicule signale l’échec de « {command} ».',
    de: '{vehicle}: Das Fahrzeug meldet, dass „{command}“ fehlgeschlagen ist.',
    es: '{vehicle}: el vehículo informa de que «{command}» ha fallado.',
  },
  command_unsupported: {
    en: '{vehicle} does not support "{command}".',
    fr: '{vehicle} ne prend pas en charge « {command} ».',
    de: '{vehicle} unterstützt „{command}“ nicht.',
    es: '{vehicle} no admite «{command}».',
  },
  pin_required: {
    en: 'Commands need the PIN of your Uconnect account: set it in the configuration.',
    fr: 'Les commandes nécessitent le code PIN de votre compte Uconnect : renseignez-le dans la configuration.',
    de: 'Befehle benötigen die PIN Ihres Uconnect-Kontos: Tragen Sie sie in der Konfiguration ein.',
    es: 'Los comandos requieren el PIN de su cuenta Uconnect: indíquelo en la configuración.',
  },
  pin_refused: {
    en: 'The PIN was refused by Uconnect: check it in the configuration.',
    fr: 'Le code PIN a été refusé par Uconnect : vérifiez-le dans la configuration.',
    de: 'Die PIN wurde von Uconnect abgelehnt: Prüfen Sie sie in der Konfiguration.',
    es: 'Uconnect ha rechazado el PIN: compruébelo en la configuración.',
  },
  unknown_vehicle: {
    en: 'This vehicle is not (or no longer) linked to the Uconnect account.',
    fr: 'Ce véhicule n’est pas (ou plus) associé au compte Uconnect.',
    de: 'Dieses Fahrzeug ist dem Uconnect-Konto nicht (mehr) zugeordnet.',
    es: 'Este vehículo no está (o ya no está) vinculado a la cuenta Uconnect.',
  },
  destination_sent: {
    en: '{vehicle}: destination sent to the navigation system.',
    fr: '{vehicle} : destination envoyée au système de navigation.',
    de: '{vehicle}: Ziel an das Navigationssystem gesendet.',
    es: '{vehicle}: destino enviado al sistema de navegación.',
  },
  // Transport badge
  degraded_stale: {
    en: 'Last refresh failed, the values shown may be outdated.',
    fr: 'Le dernier rafraîchissement a échoué, les valeurs affichées peuvent être anciennes.',
    de: 'Die letzte Aktualisierung ist fehlgeschlagen, die Werte sind ggf. veraltet.',
    es: 'La última actualización falló, los valores mostrados pueden estar desactualizados.',
  },
  privacy_mode: {
    en: 'Privacy mode is on in the vehicle: it shares no data.',
    fr: 'Le mode confidentialité est actif dans le véhicule : il ne partage aucune donnée.',
    de: 'Der Datenschutzmodus ist im Fahrzeug aktiv: Es werden keine Daten geteilt.',
    es: 'El modo privacidad está activo en el vehículo: no comparte datos.',
  },
};

/** Command labels, as in the manifest `command` selects. */
export const COMMAND_LABELS = {
  lock: {
    en: 'Lock the doors',
    fr: 'Verrouiller les portes',
    de: 'Türen verriegeln',
    es: 'Bloquear las puertas',
  },
  unlock: {
    en: 'Unlock the doors',
    fr: 'Déverrouiller les portes',
    de: 'Türen entriegeln',
    es: 'Desbloquear las puertas',
  },
  climate_on: {
    en: 'Start the climate',
    fr: 'Démarrer la climatisation',
    de: 'Klimatisierung starten',
    es: 'Encender la climatización',
  },
  climate_off: {
    en: 'Stop the climate',
    fr: 'Arrêter la climatisation',
    de: 'Klimatisierung stoppen',
    es: 'Apagar la climatización',
  },
  engine_on: {
    en: 'Remote engine start',
    fr: 'Démarrer le moteur à distance',
    de: 'Motor fernstarten',
    es: 'Arrancar el motor a distancia',
  },
  engine_off: {
    en: 'Remote engine stop',
    fr: 'Arrêter le moteur à distance',
    de: 'Motor fern abstellen',
    es: 'Parar el motor a distancia',
  },
  lights_horn: {
    en: 'Flash lights and honk',
    fr: 'Phares et klaxon',
    de: 'Lichthupe und Hupe',
    es: 'Luces y claxon',
  },
  lights: {
    en: 'Flash the lights',
    fr: 'Faire clignoter les phares',
    de: 'Lichter blinken lassen',
    es: 'Encender las luces',
  },
  charge_now: {
    en: 'Start charging',
    fr: 'Lancer la recharge',
    de: 'Laden starten',
    es: 'Iniciar la carga',
  },
  cabin_ventilation: {
    en: 'Ventilate the cabin',
    fr: 'Ventiler l’habitacle',
    de: 'Innenraum lüften',
    es: 'Ventilar el habitáculo',
  },
  trunk_lock: {
    en: 'Lock the trunk',
    fr: 'Verrouiller le coffre',
    de: 'Kofferraum verriegeln',
    es: 'Bloquear el maletero',
  },
  trunk_unlock: {
    en: 'Unlock the trunk',
    fr: 'Déverrouiller le coffre',
    de: 'Kofferraum entriegeln',
    es: 'Desbloquear el maletero',
  },
  liftgate_lock: {
    en: 'Lock the liftgate',
    fr: 'Verrouiller le hayon',
    de: 'Heckklappe verriegeln',
    es: 'Bloquear el portón',
  },
  liftgate_unlock: {
    en: 'Unlock the liftgate',
    fr: 'Déverrouiller le hayon',
    de: 'Heckklappe entriegeln',
    es: 'Desbloquear el portón',
  },
  refresh_location: {
    en: 'Refresh the location',
    fr: 'Actualiser la position',
    de: 'Standort aktualisieren',
    es: 'Actualizar la ubicación',
  },
  deep_refresh: {
    en: 'Refresh the battery level',
    fr: 'Actualiser le niveau de batterie',
    de: 'Akkustand aktualisieren',
    es: 'Actualizar el nivel de batería',
  },
};

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const v = vars[name];
    if (v === undefined || v === null) {
      return match;
    }
    return typeof v === 'object' ? String(v.en) : String(v);
  });
}

/**
 * A message as a multi-language object, placeholders filled. A variable can
 * itself be a multi-language object (a command label): each language takes
 * its own translation.
 */
export function t(key, vars = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message ${key}`);
  }
  return Object.fromEntries(
    LANGUAGES.map((lang) => {
      const localVars = Object.fromEntries(
        Object.entries(vars).map(([k, v]) => [
          k,
          v && typeof v === 'object' ? (v[lang] ?? v.en) : v,
        ]),
      );
      return [lang, fill(message[lang] ?? message.en, localVars)];
    }),
  );
}

/** Same multi-language text in every language (names, numbers...). */
export function same(text) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, text]));
}

/** Pick one language of a multi-language object (English fallback). */
export function pickLanguage(text, language) {
  return text[language] ?? text.en;
}

export { MESSAGES };
