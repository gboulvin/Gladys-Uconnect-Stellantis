# Uconnect (Stellantis)

Verbinden Sie die Fahrzeuge Ihres Uconnect-Kontos mit Gladys: Fiat, Abarth,
Jeep, Alfa Romeo, Lancia, Maserati, Chrysler, Dodge und Ram. Die Integration
nutzt dieselbe Cloud wie die offiziellen Apps (My Uconnect, Jeep, Alfa
Romeo …): Die vernetzten Dienste Ihres Fahrzeugs müssen aktiv sein.

> Inoffizielle Integration, nicht mit Stellantis verbunden. Sie basiert auf
> der per Reverse Engineering ermittelten API der offiziellen Apps (Dank an
> das Projekt [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect)):
> Stellantis kann sie jederzeit ändern.

## Konfiguration

1. Öffnen Sie den Reiter **Konfiguration** der Integration.
2. Wählen Sie **Marke und Region** Ihres Kontos (z. B. _Fiat / Abarth
   (Europe)_, _Jeep (USA / Canada)_). Wird die Anmeldung abgelehnt,
   versuchen Sie eine andere Region derselben Marke.
3. Geben Sie **E-Mail** und **Passwort** der offiziellen App ein.
4. Optional: Geben Sie die 4-stellige **PIN** der App ein. Sie wird nur für
   Befehle benötigt (Verriegeln, Entriegeln, Klimatisierung, Laden,
   Licht …). Ohne PIN arbeitet die Integration nur lesend.
5. Speichern Sie und klicken Sie auf **Verbindung testen**: Die Fahrzeuge
   des Kontos werden unter der Schaltfläche angezeigt.
6. Ihre Fahrzeuge erscheinen im Reiter **Erkennung**: Fügen Sie sie hinzu.

Weitere Einstellungen:

- **Aktualisierungsintervall** — wie oft die Uconnect-Cloud gelesen wird
  (standardmäßig 5 Minuten, mindestens 2). Das Fahrzeug lädt seinen Zustand
  in seinem eigenen Rhythmus hoch: Ein kürzeres Intervall macht die Daten
  nicht aktueller, als das Fahrzeug sie sendet.
- **Schwelle niedriger Akkustand** — Wert, unter dem der Szenen-Auslöser
  _Fahrzeugakku niedrig_ ausgelöst wird (standardmäßig 20 %).
- **Temperatureinheit** und **Standard-Klimatemperatur** — der Zielwert,
  der mit _Klimatisierung starten_ gesendet wird, sofern das Fahrzeug ihn
  unterstützt.
- **Auf Bestätigung des Fahrzeugs warten** — Szenenaktionen und
  Widget-Schaltflächen warten (bis zu 75 s) auf das Ergebnis des Fahrzeugs.

## Geräte und Funktionen

Ein Gerät pro Fahrzeug. Seine Funktionen hängen vom Fahrzeug ab:

| Funktion                                         | Fahrzeuge                | Steuerung               |
| ------------------------------------------------ | ------------------------ | ----------------------- |
| Akkustand, lädt, angesteckt, Restladezeit        | Elektro / Plug-in-Hybrid | nur lesend              |
| Reichweite, Kilometerstand                       | alle                     | nur lesend              |
| Kraftstoffstand                                  | Verbrenner               | nur lesend              |
| Türen verriegelt                                 | alle (falls gemeldet)    | verriegeln / entriegeln |
| Klimatisierung                                   | mit Fern-Klimatisierung  | starten / stoppen       |
| Klima-Zieltemperatur                             | mit Fern-HVAC            | Sollwert                |
| Motor (Fernstart)                                | mit Fernstart            | starten / stoppen       |
| Licht und Hupe                                   | mit diesem Befehl        | einmalig                |
| Fenster offen, Innenraumtemperatur               | falls gemeldet           | nur lesend              |
| Reifendruck, 12-V-Batterie, Tage bis zur Wartung | falls gemeldet           | nur lesend              |

Jedes Fahrzeug zeigt ein **Cloud**-Abzeichen; ein orangefarbener Punkt
bedeutet, dass die letzte Aktualisierung fehlgeschlagen ist (die Werte
können veraltet sein) oder dass der Datenschutzmodus des Fahrzeugs seine
Daten sperrt.

Gerätebefehle werden im Hintergrund gesendet: Das Fahrzeug braucht bis zu
einer Minute für die Ausführung, der Zustand wird nach der Bestätigung
aktualisiert.

## Szenen-Auslöser

- **Laden des Fahrzeugs gestartet / beendet** — Variablen: Zustand,
  Akkustand.
- **Fahrzeug angesteckt / abgesteckt** — Variablen: Zustand, Akkustand.
- **Fahrzeug verriegelt / entriegelt**.
- **Zündung des Fahrzeugs an / aus**.
- **Fahrzeugakku niedrig** — die Ladung fällt unter die konfigurierte
  Schwelle.
- **Reifendruckwarnung** — Variable: das Rad.
- **Fahrzeug bewegt** — der letzte bekannte Standort hat sich um mehr als
  200 m geändert; Variablen: Breitengrad, Längengrad, Strecke.

Jeder Auslöser kann auf ein Fahrzeug (und den neuen Zustand) gefiltert
werden; alle stellen auch den Fahrzeugnamen bereit. Die Auslöser vergleichen
zwei Aktualisierungen: Sie werden bei der Aktualisierung nach der Änderung
ausgelöst.

## Szenenaktionen

- **Befehl an ein Fahrzeug senden** — verriegeln, entriegeln,
  Klimatisierung (mit optionaler Temperatur), Motor, Licht und Hupe, Laden,
  Kofferraum, Heckklappe, Lüftung, Standort- oder Akku-Aktualisierung.
  Ausgaben: `success` (vom Fahrzeug bestätigt) und `status` (`success`,
  `sent`, `failed`, `unsupported`).
- **Fahrzeug aktualisieren** — liest seinen neuesten Zustand. Ausgaben:
  Akkustand, Reichweite, Kilometerstand, Kraftstoffstand, verriegelt, lädt,
  angesteckt, Breitengrad, Längengrad.
- **Ziel an das Navi senden** — Breitengrad, Längengrad und optionaler
  Name.

## Dashboard-Widgets

- **Fahrzeug** — Akku- (oder Kraftstoff-)Stand und Reichweite live; das Bild
  des Fahrzeugs; Türen, Fenster, Laden, Klima, Motor, Kilometerstand, Reifen
  und Standort; Schaltflächen zum Verriegeln, Entriegeln (mit Bestätigung)
  und zum Starten oder Stoppen der Klimatisierung sowie ein Kartenlink.
  Wählen Sie das Fahrzeug in den Widget-Einstellungen (standardmäßig das
  erste).
- **Meine Fahrzeuge** — alle Fahrzeuge des Kontos mit ihrem Füllstand.

## Aktionen der Konfigurationsseite

- **Verbindung testen** — meldet sich an und listet die Fahrzeuge auf.
- **Jetzt aktualisieren** — liest die Cloud sofort.
- **Befehl senden** — Fahrzeug und Befehl auswählen.

## Fehlerbehebung

- **Anmeldung abgelehnt** — prüfen Sie E-Mail, Passwort und Marke / Region.
  Nach einer Ablehnung versucht die Integration es nicht erneut (zum Schutz
  des Kontos), bis die Konfiguration erneut gespeichert oder die Verbindung
  getestet wird.
- **Befehle abgelehnt** — prüfen Sie die PIN. Manche Befehle gibt es nur bei
  bestimmten Fahrzeugen: Der Status _unsupported_ zeigt das an.
- **Veraltete Werte** — das Fahrzeug lädt seinen Zustand nur gelegentlich
  hoch (beim Abstellen, beim Laden …). Der Befehl _Akkustand aktualisieren_
  fordert von einem Elektrofahrzeug einen frischen Zustand an.
- **Datenschutzmodus** — ist er im Fahrzeug aktiv, werden keine Daten
  geteilt.
