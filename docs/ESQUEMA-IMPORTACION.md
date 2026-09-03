# Formato de importación de Recitar

Un paquete es un archivo `.json` con esta forma:

```json
{
  "recitar": 1,
  "curso": "Derecho Civil II",
  "items": [ ... ]
}
```

También se acepta una lista pelada de ítems (`[ {...}, {...} ]`).
Si el archivo tiene algún error, **no se guarda nada**: la app muestra qué ítem
y qué campo está mal.

## Campos comunes a todos los ítems

| Campo | Obligatorio | Qué es |
|---|---|---|
| `tipo` | sí | uno de los tipos de abajo |
| `bloque` | sí (lo heredan las repreguntas de su padre) | el tema grande: "Antijuridicidad", "Obligaciones" |
| `seccion` | no, pero conviene | el subtema del apunte: "Causales de justificación". Con esto la app sabe qué materia ya pasaste |
| `ref` | no, pero conviene | de dónde sale: "art. 1489 CC", "apunte cl. 7" |
| `hijos` | no | lista de repreguntas encadenadas (pueden tener sus propios `hijos`) |

## Los siete tipos

```json
{"tipo":"vf","bloque":"Obligaciones","ref":"art. 1489 CC",
 "pregunta":"La condición resolutoria tácita opera de pleno derecho.",
 "esVerdadera":false,
 "justificacion":"Requiere sentencia judicial; el 1489 da la opción entre cumplimiento y resolución.",
 "claves":["sentencia judicial","1489","resolución"]}
```
`esVerdadera` es booleano: `true` o `false`, **sin comillas**.
`claves` es opcional: son los términos que tiene que traer una justificación bien dada. Con eso la
app revisa sola lo que escribiste, sin internet. Si no vienen, los deduce de la justificación.

```json
{"tipo":"alternativas","bloque":"Obligaciones","ref":"art. 1567 CC",
 "pregunta":"¿Cuál de estos NO es un modo de extinguir las obligaciones?",
 "opciones":["La tradición","La novación","La compensación","La confusión"],
 "correcta":0,
 "explicacion":"La tradición es un modo de adquirir el dominio."}
```
Mínimo tres opciones. `correcta` es el índice, **partiendo de 0**. Las opciones se barajan solas y
cambian de posición entre repasos.

```json
{"tipo":"lista","bloque":"Acto jurídico","ref":"art. 1445 CC",
 "titulo":"Requisitos para obligarse","articulo":"Art. 1445",
 "elementos":["Ser legalmente capaz","Consentir sin vicios","Objeto lícito","Causa lícita"],
 "ordenImporta":false}
```
Mínimo dos elementos. Con `ordenImporta: true` además se revisa el orden.

```json
{"tipo":"articulo","bloque":"Obligaciones","ref":"art. 1698 CC",
 "numero":"1698","materia":"Carga de la prueba","cuerpo":"Código Civil"}
```
Se estudia en las dos direcciones, alternadas: número → materia y materia → número.

```json
{"tipo":"textoLegal","bloque":"Contratos","ref":"art. 1545 CC",
 "numero":"1545",
 "textoLiteral":"Todo contrato legalmente celebrado es una ley para los contratantes..."}
```
Mínimo ocho palabras. Los huecos se eligen solos y **cambian entre repasos**.
Para forzar un hueco, escribe la palabra entre llaves dobles: `{{invalidado}}`.

```json
{"tipo":"triaje","bloque":"Responsabilidad","ref":"clase 4",
 "enunciado":"Refiérase a la culpa en abstracto o en concreto.",
 "verbo":"posturas"}
```
`verbo` es uno de: `definir`, `posturas`, `importancia`, `distinciones`.

```json
{"tipo":"desarrollo","bloque":"Responsabilidad","ref":"arts. 2314 y ss.",
 "enunciado":"Explique los elementos de la responsabilidad extracontractual.",
 "minutosSugeridos":12,
 "checklist":[
   {"texto":"Capacidad delictual del autor","claves":["capacidad","delictual"]},
   {"texto":"Dolo o culpa","claves":["dolo","culpa"]},
   {"texto":"Cita el art. 2314","claves":["2314"]}
 ]}
```
Mínimo dos puntos de pauta. Cada punto debe ser algo que se pueda tildar como
dicho o no dicho.

Las `claves` de cada punto son **cómo la app corrige sola tu desarrollo**: si escribes tecleando,
busca esos términos en tu texto (aguantando tildes y tipeos) y deja la pauta pre-marcada. Sirven
términos técnicos y números de artículo; no sirven palabras genéricas como "explica" o "derecho".
Se acepta también la forma antigua (`"checklist": ["punto uno", "punto dos"]`): ahí las claves se
deducen del propio texto del punto.

```json
{"tipo":"repregunta","bloque":"Obligaciones","ref":"art. 1479 CC",
 "pregunta":"¿Y la condición resolutoria ordinaria?",
 "respuesta":"Esa sí opera de pleno derecho."}
```

## Cadenas

Las repreguntas van dentro de `hijos` del ítem del que cuelgan:

```json
{
  "tipo": "vf", "bloque": "Obligaciones", "ref": "art. 1489 CC",
  "pregunta": "...", "esVerdadera": false, "justificacion": "...",
  "hijos": [
    { "tipo": "repregunta", "pregunta": "¿Y la ordinaria?", "respuesta": "..." ,
      "hijos": [
        { "tipo": "repregunta", "pregunta": "¿Y si nadie la alega?", "respuesta": "..." }
      ]
    }
  ]
}
```

En la sesión salen una tras otra, sin decir cuántas son. Si se falla una, el
ítem padre tampoco cuenta como dominado.

## Apuntes en `.md` y `.txt`

Se convierten aquí mismo, sin internet, si usan estas marcas:

```
## Obligaciones            ← cambia el bloque
[art. 1489 CC]            ← referencia para lo que viene

F: La condición resolutoria tácita opera de pleno derecho.
J: Requiere sentencia; el 1489 da la opción de cumplimiento o resolución.
? ¿Y la ordinaria?        ← repregunta del ítem de arriba
= Esa sí opera de pleno derecho. [art. 1479]

LISTA: Requisitos del acto jurídico [art. 1445]
- capaz
- consentimiento sin vicios
- objeto lícito
- causa lícita

ALT: ¿Qué exige la resolución por incumplimiento?
- Opera de pleno derecho
+ Sentencia judicial que la declare
- Basta una carta del acreedor

ART 1698: carga de la prueba
TEXTO 1545: Todo contrato legalmente celebrado es una ley para los contratantes...
TRIAJE(posturas): Refiérase a la culpa en abstracto o en concreto.
DES: Explique los elementos de la responsabilidad extracontractual
- capacidad
- hecho voluntario
- dolo o culpa
- daño
- causalidad
```

Las líneas que no calzan con ninguna marca no se pierden: quedan listadas
aparte para revisarlas.

## Apuntes normales: el puente con Claude

Para un apunte corrido o un PDF, la app arma sola el pedido completo
(instrucciones + este formato + el texto, partido en trozos si es largo).
Se copia, se pega en Claude, y la respuesta de Claude se pega de vuelta en la
app, que la valida antes de guardar nada.

La app nunca manda nada por su cuenta: el texto sale de aquí solo cuando tú lo
pegas en otra parte.
