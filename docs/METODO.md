# Por qué la app hace lo que hace

Recitar no es una app de tarjetas con encima un diseño bonito. Cada cosa que
hace responde a un hallazgo concreto sobre cómo se aprende. Esto es lo que hay
detrás, con las fuentes.

## 1. Producir, no reconocer

El hallazgo más sólido de cien años de psicología cognitiva es el **efecto de
prueba**: recuperar algo de memoria enseña más que volver a leerlo. En un
estudio clásico, el material sobre el que se había hecho preguntas se recordó al
94% contra 81% del material solo leído.

**En la app:** nunca se ve la respuesta antes de haber producido algo. El botón
de revelar está bloqueado hasta que escribas, elijas o hables. No hay ningún
modo donde solo se lea.

## 2. Espaciar, y no dos veces lo mismo seguido

Repartir el estudio en el tiempo (repetición espaciada) y **mezclar** temas en
vez de bloquearlos. El intercalado es especialmente potente cuando hay
categorías parecidas que hay que distinguir —exactamente el problema del
Derecho: nulidad absoluta contra relativa, resolución contra resciliación,
dolo contra culpa grave—. La razón es el *contraste discriminativo*: solo
comparando lo parecido se aprende a separarlo.

**En la app:** FSRS (o Leitner) para los intervalos, y la cola de cada sesión
evita dos ítems seguidos del mismo bloque y del mismo tipo si puede.

## 3. Equivocarse antes de leer

**Pretesting**: intentar responder algo que todavía no sabes, equivocarte, y
recién ahí leer el texto. Suena absurdo y funciona: en cinco experimentos con
1.573 personas, hacer la prueba *antes* del texto superó a hacerla después.
Al intentarlo, tu cabeza activa lo que sí sabe y decide qué es importante en el
texto que viene.

**En la app:** el modo **Primera pasada**. Por cada trozo del apunte: primero
predices o contestas sin saber, después lees, después cierras el texto y
escribes lo que quedó.

## 4. La hoja en blanco

El **volcado** (free recall) es la forma más pura de recuperación: sin pregunta
que te dé la mitad de la respuesta. Además de fijar el contenido, mejora cómo lo
tienes organizado en la cabeza, que es justo lo que se nota en un oral.

**En la app:** el modo **Volcado**. Eliges una materia, escribes todo lo que
queda, y la app compara contra los conceptos que ese bloque debería haberte
dejado: te dice cuántos produjiste y cuáles no aparecieron nunca.

## 5. Saber si sabes

Los estudiantes se sobreestiman, y los que peor rinden son los que más. Lo que
corrige eso no es estudiar más: es **recibir retroalimentación sobre tus propios
juicios**. Solo quienes recibieron información sobre qué tan acertados eran sus
juicios mejoraron el rendimiento y bajaron el exceso de confianza.

**En la app:** antes de revelar, cada ítem pregunta cuán seguro estás. Decir
"seguro" y fallar marca el ítem como **error grave**, que vuelve en minutos. Y
en Avance hay una tabla de calibración: cuando dices "seguro", cuántas veces
aciertas de verdad.

## 6. Aplicar, no solo recitar

En Derecho la prueba no pregunta qué dice el artículo: da hechos y hay que ver
qué se activa. Identificar el problema (*issue spotting*) es una habilidad
entrenable, y lo que la entrena es hacer muchos casos con retroalimentación, no
releer.

**En la app:** el modo **Triaje** (ver de qué es la pregunta y qué te pide, sin
responderla) y los **desarrollos** con pauta. Es la parte más débil todavía: ver
"Lo que falta".

## 7. Un número honesto

**En la app:** la pantalla de inicio calcula, con la curva de olvido de FSRS,
qué probabilidad tienes de acordarte de cada ítem el día de tu prueba, y
promedia. Un ítem que nunca estudiaste cuenta como cero. No es "cuántas fichas
viste": es una estimación de cuánto vas a recordar ese día.

La fórmula es la de FSRS: `R(t,S) = (1 + F·t/(9S))^C`, con `F = 19/81` y
`C = -0.5`, donde `S` es la estabilidad del recuerdo en días y `t` los días
transcurridos desde el último repaso.

## Lo que falta

Dos cosas que la evidencia respalda y que todavía no están:

- **Pares confundibles.** Ejercicios donde se presentan juntas dos
  instituciones parecidas y hay que decidir a cuál corresponde cada enunciado.
  Es la aplicación directa del contraste discriminativo del punto 2.
- **Casos.** Un tipo de ítem con hechos, donde primero se marcan los problemas
  que se activan, después las normas y después la solución, con pauta por etapa.
  Es lo que entrena el punto 6.

## Fuentes

- [Retrieval Practice: Power Tool for Lasting Learning (ASCD)](https://www.ascd.org/el/articles/retrieval-practice-power-tool-for-lasting-learning)
- [Brain Dump / free recall (RetrievalPractice.org)](https://www.retrievalpractice.org/strategies/2017/free-recall)
- [Why does interleaving improve learning? Discriminative contrast (Memory & Cognition)](https://link.springer.com/article/10.3758/s13421-019-00918-4)
- [Interleaved training and category learning (Kang)](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-interleaved-training-and-category-learning-kang.pdf)
- [Pretesting vs. posttesting: errorful generation y prequestions (Pan & Sana)](https://osf.io/preprints/psyarxiv/un87v_v1)
- [Prequestioning and Pretesting Effects: revisión (Educational Psychology Review)](https://link.springer.com/article/10.1007/s10648-023-09814-5)
- [Improving metacognition through instruction, training and feedback (Metacognition and Learning)](https://link.springer.com/article/10.1007/s11409-015-9142-6)
- [Improving metacognitive accuracy: cómo fallar reduce el exceso de confianza](https://www.sciencedirect.com/science/article/abs/pii/S1053810014001469)
- [The Deconstructed Issue-Spotting Exam (Journal of Legal Education)](https://jle.aals.org/cgi/viewcontent.cgi?article=1616&context=home)
- [Issue spotting como habilidad entrenable (Aspen Publishing)](https://aspenpublishing.com/blogs/aspen-legal-education-insider/issue-spotting-skills-every-1l-needs-to-build-early)
- [A technical explanation of FSRS (Expertium)](https://expertium.github.io/Algorithm.html)
- [ABC of FSRS](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS)
