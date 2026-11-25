# Uconnect (Stellantis)

Connectez à Gladys les véhicules de votre compte Uconnect : Fiat, Abarth,
Jeep, Alfa Romeo, Lancia, Maserati, Chrysler, Dodge et Ram. L'intégration
utilise le même cloud que les applications officielles (My Uconnect, Jeep,
Alfa Romeo…) : les services connectés de votre véhicule doivent être actifs.

> Intégration non officielle, sans lien avec Stellantis. Elle s'appuie sur
> l'API rétro-ingéniérée des applications officielles (merci au projet
> [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect)) :
> Stellantis peut la modifier à tout moment.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Choisissez la **marque et la région** de votre compte (par ex. _Fiat /
   Abarth (Europe)_, _Jeep (USA / Canada)_). Si la connexion est refusée,
   essayez une autre région de la même marque.
3. Renseignez l'**e-mail** et le **mot de passe** de l'application
   officielle.
4. Facultatif : renseignez le **code PIN** à 4 chiffres de l'application. Il
   n'est nécessaire que pour envoyer des commandes (verrouillage,
   déverrouillage, climatisation, recharge, phares…). Sans lui,
   l'intégration fonctionne en lecture seule.
5. Enregistrez, puis cliquez sur **Tester la connexion** : les véhicules du
   compte s'affichent sous le bouton.
6. Vos véhicules apparaissent dans l'onglet **Découverte** : ajoutez-les.

Autres réglages :

- **Intervalle de rafraîchissement** — fréquence de lecture du cloud
  Uconnect (5 minutes par défaut, 2 minutes minimum). Le véhicule envoie son
  état à son propre rythme : un intervalle plus court ne rend pas les
  données plus fraîches que ce que le véhicule envoie.
- **Seuil de batterie faible** — niveau sous lequel le déclencheur de scène
  _Batterie du véhicule faible_ se déclenche (20 % par défaut).
- **Unité** et **température de climatisation par défaut** — la consigne
  envoyée avec _Démarrer la climatisation_, pour les véhicules qui
  l'acceptent.
- **Attendre la confirmation du véhicule** — les actions de scène et les
  boutons du widget attendent (jusqu'à 75 s) le résultat renvoyé par le
  véhicule.

## Appareils et fonctionnalités

Un appareil par véhicule. Ses fonctionnalités dépendent du véhicule :

| Fonctionnalité                                                  | Véhicules                            | Contrôle                    |
| --------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| Niveau de batterie, en charge, branché, temps de charge restant | électriques / hybrides rechargeables | lecture seule               |
| Autonomie, kilométrage                                          | tous                                 | lecture seule               |
| Niveau de carburant                                             | thermiques                           | lecture seule               |
| Portes verrouillées                                             | tous (si remonté)                    | verrouiller / déverrouiller |
| Climatisation                                                   | avec climatisation à distance        | démarrer / arrêter          |
| Consigne de climatisation                                       | avec HVAC à distance                 | consigne                    |
| Moteur (démarrage à distance)                                   | avec démarrage à distance            | démarrer / arrêter          |
| Phares et klaxon                                                | avec cette commande                  | ponctuel                    |
| Fenêtre ouverte, température habitacle                          | si remonté                           | lecture seule               |
| Pression des pneus, batterie 12 V, jours avant entretien        | si remonté                           | lecture seule               |

Chaque véhicule affiche un badge **cloud** ; un point orange signifie que le
dernier rafraîchissement a échoué (les valeurs peuvent être anciennes) ou
que le mode confidentialité du véhicule bloque ses données.

Les commandes des appareils sont envoyées en arrière-plan : le véhicule met
jusqu'à une minute à les exécuter, et l'état est mis à jour une fois
confirmé.

## Déclencheurs de scène

- **Recharge du véhicule démarrée / arrêtée** — variables : état, niveau de
  batterie.
- **Véhicule branché / débranché** — variables : état, niveau de batterie.
- **Véhicule verrouillé / déverrouillé**.
- **Contact du véhicule mis / coupé**.
- **Batterie du véhicule faible** — la charge passe sous le seuil configuré.
- **Alerte de pression des pneus** — variable : la roue.
- **Véhicule déplacé** — la dernière position connue a changé de plus de
  200 m ; variables : latitude, longitude, distance.

Chaque déclencheur peut être filtré sur un véhicule (et sur le nouvel
état) ; tous exposent aussi le nom du véhicule. Les déclencheurs comparent
deux rafraîchissements : ils se déclenchent au rafraîchissement qui suit le
changement.

## Actions de scène

- **Envoyer une commande à un véhicule** — verrouiller, déverrouiller,
  climatisation (avec une température facultative), moteur, phares et
  klaxon, recharge, coffre, hayon, ventilation, actualisation de la position
  ou de la batterie. Sorties : `success` (confirmé par le véhicule) et
  `status` (`success`, `sent`, `failed`, `unsupported`).
- **Rafraîchir un véhicule** — lit son dernier état. Sorties : niveau de
  batterie, autonomie, kilométrage, niveau de carburant, verrouillé, en
  charge, branché, latitude, longitude.
- **Envoyer une destination au GPS** — latitude, longitude et un nom
  facultatif.

## Widgets du tableau de bord

- **Véhicule** — le niveau de batterie (ou de carburant) et l'autonomie, en
  direct ; la photo du véhicule ; portes, fenêtres, recharge,
  climatisation, moteur, kilométrage, pneus et position ; des boutons pour
  verrouiller, déverrouiller (avec confirmation) et démarrer ou arrêter la
  climatisation, et un lien vers la carte. Choisissez le véhicule dans les
  réglages du widget (le premier par défaut).
- **Mes véhicules** — tous les véhicules du compte, avec leur badge de
  niveau.

## Actions de l'écran de configuration

- **Tester la connexion** — se connecte et liste les véhicules.
- **Rafraîchir maintenant** — lit le cloud immédiatement.
- **Envoyer une commande** — choisissez un véhicule et une commande.

## Dépannage

- **Connexion refusée** — vérifiez l'e-mail, le mot de passe et la marque /
  région. Après un refus, l'intégration arrête de réessayer (pour protéger
  le compte) jusqu'à ce que la configuration soit de nouveau enregistrée ou
  la connexion testée.
- **Commandes refusées** — vérifiez le code PIN. Certaines commandes
  n'existent que sur certains véhicules : le statut _unsupported_ l'indique.
- **Valeurs anciennes** — le véhicule n'envoie son état que de temps en
  temps (à l'arrêt, pendant la charge…). La commande _Actualiser le niveau
  de batterie_ demande un état frais à un véhicule électrique.
- **Mode confidentialité** — quand il est actif dans le véhicule, aucune
  donnée n'est partagée.
