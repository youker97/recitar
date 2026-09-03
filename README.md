# Recitar

App de estudio para pruebas escritas y orales de Derecho. Funciona en el
teléfono y en el computador, se instala como aplicación y **anda sin internet**.
No tiene cuentas, no tiene servidor y no manda tus datos a ninguna parte: todo
vive en tu dispositivo.

La idea de fondo: leer la materia no sirve. Hay que producirla de memoria, y en
el oral el profesor siempre sigue raspando debajo de la primera respuesta.

## Qué hace

- **Nunca muestra la respuesta antes de que produzcas algo.** El botón de
  revelar está bloqueado hasta que escribas, elijas o hables.
- **Antes de revelar pregunta cuán seguro estás.** Si dices "seguro" y fallas,
  el ítem queda marcado como **error grave** y vuelve en minutos.
- **Modo cadena:** después de un ítem vienen sus repreguntas, una tras otra, sin
  decir cuántas son. Si caes en una, el ítem de arriba tampoco cuenta como
  sabido.
- **Registro de errores** que se llena solo y es la primera pantalla al abrir.
  Un ítem sale recién con tres aciertos seguidos.
- **Repetición espaciada** (FSRS, o Leitner 0-1-3-7-16-35 si lo prefieres), con
  sesiones que intercalan bloques y tipos: nunca dos seguidos de lo mismo si se
  puede evitar.
- **Fechas de prueba:** días que faltan y cuánto toca hoy para llegar, repartido
  en vez de acumulado al final.
- **Consejos** a partir de lo que de verdad te pasa: en qué bloque se te cae
  todo, si tu seguridad está mal calibrada, si estás acertando adivinando.

### Los siete modos

| Modo | Qué entrena |
|---|---|
| Triaje | Identificar de qué es la pregunta y qué te pide, sin responderla |
| Verdadero o falso | Justificar en **tres líneas duras**, con contador que se pone rojo |
| Lista contada | "El art. X tiene N elementos": los escribes y te dice cuántos antes de cuáles |
| Artículos | Número → materia y materia → número, alternados |
| Texto legal | Huecos sobre el texto literal, que cambian entre repasos |
| Desarrollo | En papel (cronómetro y pauta al terminar) o tecleado |
| Oral | Respondes en voz alta con cronómetro; grabación opcional |

## Cómo meter material

1. **Paquete `.json`** con el formato de [docs/ESQUEMA-IMPORTACION.md](docs/ESQUEMA-IMPORTACION.md).
   Si viene malo, la app dice exactamente qué ítem y qué campo, y no guarda nada.
2. **Apuntes `.md` o `.txt`** con marcas simples (`V:`, `J:`, `LISTA:`, `ART`,
   `TEXTO`, `DES:`, `TRIAJE(...)`, `?` y `=`). Se convierten sin internet.
3. **PDF**: la app extrae el texto con pdf.js y tú eliges qué páginas usar.
4. **El puente con Claude**, que es lo que mejor funciona con un apunte normal:
   la app arma sola el pedido (instrucciones + formato + tu texto, partido en
   trozos si es largo), lo copias, lo pegas en Claude, y pegas su respuesta de
   vuelta. La app la valida antes de guardar. Nada sale de tu dispositivo salvo
   lo que tú pegues en otra parte.
5. **Editor** para escribir o corregir ítems a mano, incluidas las repreguntas.

En Ajustes hay **exportar todo** (material + avance en un archivo) y
**restaurar**. Conviene hacerlo cada cierto tiempo: si borras los datos del
navegador, se pierde.

## Instalarla en el teléfono

Abre la app en el navegador y usa "Agregar a la pantalla de inicio"
(Safari: compartir › Agregar a inicio; Chrome: menú › Instalar aplicación).
Queda como una app más y abre sin señal.

Para publicarla desde este repositorio hay un flujo listo en
`.github/workflows/publicar.yml`: en **Settings › Pages › Source** elige
*GitHub Actions* y cada push a `main` la deja publicada.

## Desarrollo

```bash
npm install
npm run dev       # servidor local
npm run prueba    # las pruebas de la lógica
npm run build     # compila a dist/
npm run preview   # sirve dist/ como quedaría publicada
```

React + TypeScript + Vite, datos en IndexedDB con Dexie, service worker con
vite-plugin-pwa. Sin backend y sin llamadas a ninguna API.

```
src/datos      modelo, base de datos, validación de importación
src/logica     programador (FSRS/Leitner), cola, cadena, comparación, huecos, plan, consejos
src/modos      los siete modos de estudio y la sesión que los orquesta
src/pantallas  inicio, errores, material, editor, pruebas, importar, avance, ajustes
src/importar   json, md/txt, pdf, puente con Claude, respaldo
pruebas        vitest sobre toda la lógica pura
```
