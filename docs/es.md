# Uconnect (Stellantis)

Conecte a Gladys los vehículos de su cuenta Uconnect: Fiat, Abarth, Jeep,
Alfa Romeo, Lancia, Maserati, Chrysler, Dodge y Ram. La integración usa la
misma nube que las aplicaciones oficiales (My Uconnect, Jeep, Alfa
Romeo…): los servicios conectados de su vehículo deben estar activos.

> Integración no oficial, sin relación con Stellantis. Se basa en la API
> obtenida por ingeniería inversa de las aplicaciones oficiales (gracias al
> proyecto [hass-uconnect](https://github.com/hass-uconnect/hass-uconnect)):
> Stellantis puede cambiarla en cualquier momento.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Elija la **marca y región** de su cuenta (p. ej. _Fiat / Abarth
   (Europe)_, _Jeep (USA / Canada)_). Si se rechaza el inicio de sesión,
   pruebe otra región de la misma marca.
3. Introduzca el **correo electrónico** y la **contraseña** de la
   aplicación oficial.
4. Opcional: introduzca el **PIN** de 4 dígitos de la aplicación. Solo es
   necesario para enviar comandos (bloquear, desbloquear, climatización,
   carga, luces…). Sin él, la integración es de solo lectura.
5. Guarde y pulse **Probar la conexión**: los vehículos de la cuenta se
   muestran bajo el botón.
6. Sus vehículos aparecen en la pestaña **Descubrimiento**: añádalos.

Otros ajustes:

- **Intervalo de actualización** — frecuencia de lectura de la nube Uconnect
  (5 minutos por defecto, 2 como mínimo). El vehículo envía su estado a su
  propio ritmo: un intervalo más corto no hace los datos más recientes de lo
  que el vehículo los envía.
- **Umbral de batería baja** — nivel por debajo del cual se activa el
  disparador de escena _Batería del vehículo baja_ (20 % por defecto).
- **Unidad** y **temperatura de climatización por defecto** — la
  temperatura enviada con _Encender la climatización_, en los vehículos que
  la admiten.
- **Esperar la confirmación del vehículo** — las acciones de escena y los
  botones del widget esperan (hasta 75 s) el resultado del vehículo.

## Dispositivos y funciones

Un dispositivo por vehículo. Sus funciones dependen del vehículo:

| Función                                                             | Vehículos                         | Control                |
| ------------------------------------------------------------------- | --------------------------------- | ---------------------- |
| Nivel de batería, cargando, enchufado, tiempo de carga restante     | eléctricos / híbridos enchufables | solo lectura           |
| Autonomía, kilometraje                                              | todos                             | solo lectura           |
| Nivel de combustible                                                | de combustión                     | solo lectura           |
| Puertas bloqueadas                                                  | todos (si se informa)             | bloquear / desbloquear |
| Climatización                                                       | con climatización remota          | encender / apagar      |
| Temperatura objetivo                                                | con HVAC remoto                   | consigna               |
| Motor (arranque remoto)                                             | con arranque remoto               | arrancar / parar       |
| Luces y claxon                                                      | con ese comando                   | puntual                |
| Ventanilla abierta, temperatura del habitáculo                      | si se informa                     | solo lectura           |
| Presión de neumáticos, batería de 12 V, días hasta el mantenimiento | si se informa                     | solo lectura           |

Cada vehículo muestra una insignia **cloud**; un punto naranja indica que la
última actualización falló (los valores pueden estar desactualizados) o que
el modo privacidad del vehículo bloquea sus datos.

Los comandos de los dispositivos se envían en segundo plano: el vehículo
tarda hasta un minuto en ejecutarlos y el estado se actualiza al
confirmarse.

## Disparadores de escena

- **Carga del vehículo iniciada / detenida** — variables: estado, nivel de
  batería.
- **Vehículo enchufado / desenchufado** — variables: estado, nivel de
  batería.
- **Vehículo bloqueado / desbloqueado**.
- **Encendido del vehículo activado / apagado**.
- **Batería del vehículo baja** — la carga baja del umbral configurado.
- **Alerta de presión de neumáticos** — variable: la rueda.
- **Vehículo desplazado** — la última ubicación conocida ha cambiado más de
  200 m; variables: latitud, longitud, distancia.

Cada disparador puede filtrarse por vehículo (y por el nuevo estado); todos
exponen también el nombre del vehículo. Los disparadores comparan dos
actualizaciones: se activan en la actualización siguiente al cambio.

## Acciones de escena

- **Enviar un comando a un vehículo** — bloquear, desbloquear,
  climatización (con temperatura opcional), motor, luces y claxon, carga,
  maletero, portón, ventilación, actualización de ubicación o de batería.
  Salidas: `success` (confirmado por el vehículo) y `status` (`success`,
  `sent`, `failed`, `unsupported`).
- **Actualizar un vehículo** — lee su último estado. Salidas: nivel de
  batería, autonomía, kilometraje, nivel de combustible, bloqueado,
  cargando, enchufado, latitud, longitud.
- **Enviar un destino al GPS** — latitud, longitud y un nombre opcional.

## Widgets del panel

- **Vehículo** — nivel de batería (o combustible) y autonomía, en directo;
  la imagen del vehículo; puertas, ventanillas, carga, climatización, motor,
  kilometraje, neumáticos y ubicación; botones para bloquear, desbloquear
  (con confirmación) y encender o apagar la climatización, y un enlace al
  mapa. Elija el vehículo en los ajustes del widget (el primero por
  defecto).
- **Mis vehículos** — todos los vehículos de la cuenta, con su insignia de
  nivel.

## Acciones de la pantalla de configuración

- **Probar la conexión** — inicia sesión y muestra los vehículos.
- **Actualizar ahora** — lee la nube inmediatamente.
- **Enviar un comando** — elija un vehículo y un comando.

## Solución de problemas

- **Inicio de sesión rechazado** — compruebe el correo, la contraseña y la
  marca / región. Tras un rechazo, la integración deja de reintentar (para
  proteger la cuenta) hasta que se vuelva a guardar la configuración o se
  pruebe la conexión.
- **Comandos rechazados** — compruebe el PIN. Algunos comandos solo existen
  en algunos vehículos: el estado _unsupported_ lo indica.
- **Valores antiguos** — el vehículo solo envía su estado de vez en cuando
  (al apagarse, durante la carga…). El comando _Actualizar el nivel de
  batería_ pide un estado reciente a un vehículo eléctrico.
- **Modo privacidad** — cuando está activo en el vehículo, no se comparte
  ningún dato.
