# Manual de uso — Ayuda a Diego: Aprendiendo con IA

Plataforma educativa gamificada con inteligencia artificial para el aprendizaje
de vocabulario curricular (5.º, 6.º y 7.º grado de primaria).

**Acceso:** https://ayuda-a-diego-frontend.onrender.com
No requiere instalación ni descarga. Funciona en cualquier navegador moderno de
PC, tablet o celular.

> **Nota sobre el primer ingreso:** el servidor se suspende tras unos minutos de
> inactividad y puede tardar entre 30 y 60 segundos en responder la primera vez.
> Si la pantalla queda cargando, esperá un momento y volvé a intentar.

---

## Parte 1 — Manual del Alumno

El alumno no necesita crear una cuenta: ingresa con un alias y empieza a jugar.

### 1.1 Ingresar

1. Abrí la dirección de la plataforma.
2. Mirá (o salteá) el video de introducción que presenta la historia de Diego.
3. Escribí tu nombre o apodo en el campo **"¿Cómo te llamás?"** y tocá **¡Jugar!**

[📷 Captura: pantalla de inicio con el ingreso de nombre y el logo de la UTN]

### 1.2 Elegir el modo de juego

Vas a ver cuatro tarjetas (tocá cada una para ver su descripción) más una tarjeta
especial para conectarte con tu docente:

- **Solitario** — Jugás solo, a tu propio ritmo.
- **Versus Local** — Dos jugadores en el mismo dispositivo: uno escribe una
  palabra secreta y el otro la adivina. Al elegir este modo se abre una ventana
  para escribir la palabra (queda oculta para que el otro no la vea).
- **Online Coop** — Dos jugadores colaboran sobre la misma palabra. Se comparte
  un enlace; el segundo jugador lo abre, elige su nombre y se suma.
- **Duelo Online** — Carrera: dos jugadores compiten y gana el primero que
  adivina la palabra.
- **Con mi Profe** — Ingresás el código que te da tu docente para entrar a la
  lista de palabras de la clase.

También podés filtrar por **categoría** (Ciencias Naturales, Sociales, Lengua) o
escribir un **tema libre** para que la IA genere una palabra de ese tema.

[📷 Captura: selección de modo con las tarjetas y la tarjeta "Con mi Profe"]

### 1.3 Cómo jugar

- Adiviná la palabra letra por letra con el **teclado en pantalla** (también podés
  usar el teclado físico de tu computadora).
- Cada **acierto** completa un espacio de la palabra; cada **error** acerca a
  Diego un paso más al dragón. La imagen va cambiando según cómo te va.
- Tocá **Pedir Pista (IA)** si necesitás ayuda: la inteligencia artificial te da
  una pista relacionada con la palabra, sin revelarla.
- Al terminar cada palabra se muestra su **definición** completa.

[📷 Captura: partida en curso (Solitario) con la imagen, la palabra y el teclado]
[📷 Captura: una pista generada por la IA durante la partida]

### 1.4 Al terminar la partida

- **¡VICTORIA!** muestra la puerta del castillo abierta y festejo.
- **Jugar de nuevo** — En los modos online, los mismos jugadores continúan con una
  palabra nueva sin generar otro enlace. Respeta el tema o la categoría elegida y
  no repite palabras ya jugadas.
- **Elegir otro modo** — Vuelve a la pantalla de selección de modos.
- **Inicio** — Vuelve al comienzo.

[📷 Captura: pantalla de victoria con los botones "Jugar de nuevo" y "Elegir otro modo"]

### 1.5 Extras

- **Daily / Desafío diario** — Una palabra nueva por día, igual para todos.
- **Ranking** — Tabla de posiciones con los mejores puntajes.
- **Sonido** — Botón para silenciar o activar los efectos.

---

## Parte 2 — Manual del Docente

El docente cuenta con un portal para crear listas de palabras, generar códigos de
sala, lanzar clases y monitorear el desempeño en tiempo real.

### 2.1 Crear cuenta o ingresar

1. En la pantalla de inicio, tocá **"Soy docente — ingresar"**.
2. Ingresá con **correo y contraseña** o con tu **cuenta de Google**.

> Tus listas quedan asociadas a tu cuenta (tu correo), así que las vas a ver
> siempre que ingreses con el mismo usuario, desde cualquier dispositivo.

[📷 Captura: pantalla de ingreso del docente (email / Google)]

### 2.2 Mis listas

Una vez dentro, accedés a **Mis listas**: el listado de bancos de palabras que
creaste, con su cantidad de palabras, su código de sala y las acciones
disponibles (generar código, empezar clase, editar, ver historial).

[📷 Captura: portal docente "Mis listas" con las listas y sus códigos]

### 2.3 Crear una lista de palabras

1. Tocá **Nueva lista**.
2. Poné un **nombre** (ej.: "Sistema solar — 5.º grado").
3. Cargá las palabras de una de estas dos formas:
   - **Con IA:** escribí un tema (ej.: "Ecosistemas") y tocá **Generar**. La IA
     crea automáticamente 10 palabras con sus definiciones.
   - **Manual:** una palabra por línea, con el formato
     `palabra | definición | categoría` (la definición y la categoría son
     opcionales).
4. Elegí la **cantidad de intentos** (por defecto 6; menos intentos = más difícil).
5. Guardá la lista.

[📷 Captura: creación de lista con la generación por IA desde un tema]

### 2.4 Código de sala: Tarea vs. Clase en vivo

Cada lista genera un **código único** (3 a 6 caracteres) que se guarda y se puede
reutilizar. Hay dos formas de usarlo:

- **Tarea** — Compartís el código y los alumnos juegan **desde sus casas**,
  ingresándolo en la tarjeta "Con mi Profe".
- **Clase en vivo** — Tocás **Empezar clase** y proyectás la sesión; los alumnos
  se conectan con el código desde el aula.

[📷 Captura: código de sala generado para una lista]

### 2.5 Monitoreo en tiempo real

Durante una clase podés seguir el desempeño del grupo:

- **Tablero de posiciones** que se actualiza en vivo: nombre del alumno, palabras
  resueltas, intentos usados y tiempo.
- **Exportar a CSV** para guardar los resultados.
- **Historial** de partidas por lista, con el detalle palabra por palabra
  (cuántos errores tuvo cada una y si la adivinaron).

[📷 Captura: panel de monitoreo con el ranking de alumnos en tiempo real]
[📷 Captura: historial de partidas con el detalle por palabra]

---

## Recomendaciones para la clase

- **Calentá el servidor** antes de empezar: abrí la plataforma y creá una partida
  un par de minutos antes de la clase, para evitar la demora del primer ingreso.
- **Proyectá** la pantalla para presentar la narrativa y, durante el torneo, el
  ranking en tiempo real.
- **Auriculares** (opcional): mejoran la experiencia con los efectos de sonido.
- **Cierre reflexivo:** usá el historial y las palabras con más errores como
  insumo para repasar el vocabulario en la clase siguiente.
