# Alessia Studio · brief per i post Instagram

Questo file accompagna il kit del marchio (logo, colori, font, immagini del sito, i primi post).
Serve a chi prepara i post: tutto quello che c'è da sapere sta qui.

## Chi siamo
- **Nome:** ALESSIA STUDIO (sempre in maiuscolo nel logo)
- **Cosa fa:** branding, direzione creativa e siti web 3D immersivi
- **Posizionamento:** *Italia · México · Colombia · Worldwide* (lo studio è italiano: l'Italia sempre
  per prima; "Worldwide" resta in inglese in tutte le lingue)
  (IT: Italia · Messico · Colombia · Worldwide · EN: Italy · Mexico · Colombia · Worldwide ·
  PT: Itália · México · Colômbia · Worldwide)
- **Manifesto:** *Un sitio web puede ser un lugar, no una página.*
- **In una frase:** Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y
  movimiento que cuentan una marca como una visita.
- **Lingue:** i post in **spagnolo**; se serve, una riga in inglese. Lo studio lavora in spagnolo,
  italiano, inglese e portoghese.
- **Contatto:** solo WhatsApp +39 346 175 8562 (niente email nei post) · Instagram: @aless1astudio ·
  sito: alessia.studio

## Colori: solo due
| | Nome | HEX | RGB | Uso |
|---|---|---|---|---|
| ■ | **Verde Alessia** | `#B8F03A` | 184, 240, 58 | logo, titoli, accenti |
| ■ | **Rosa Alessia** | `#D4A39C` | 212, 163, 156 | fondo |

**Regole**
- Nessun altro colore nella grafica: niente nero, grigi, blu, altri verdi o altri rosa.
  Le immagini (screenshot del sito) restano come sono.
- Le due combinazioni: **verde su rosa** (la principale) e **rosa su verde**.
- Il verde e il rosa hanno chiarezza simile (contrasto 1,6:1): i testi sulla grafica vanno **grandi e
  corti** (titoli, 3–8 parole, almeno 60 px su un post largo 1080 px). Il testo lungo va nella
  didascalia, non nell'immagine.

## Font
- **Syne ExtraBold** (800): logo e titoli, preferibilmente in maiuscolo, spaziatura −3,5%.
  Attenzione: in Syne i numeri sono "all'antica" (lo 0 sembra una o): per prezzi, date e codici usare Inter.
- **Inter** (400 / 500 / 600): testi, etichette (etichette in maiuscolo con spaziatura +22%).
- Entrambi gratuiti (Google Fonts, licenza SIL Open Font License); i file sono nella cartella `font/`.

## Logo
- File in `logo/`: `logo-verde` (una riga), `logo-verde-2-righe`, `monogramma-verde` (AS) e le stesse
  versioni in rosa (per i fondi verdi). SVG (vettoriale) e PNG trasparente.
- Logo verde su fondo rosa, logo rosa su fondo verde. Mai su altri colori, mai deformato, ruotato,
  con contorni o ombre.
- Spazio libero attorno: almeno l'altezza di una lettera del logo. Larghezza minima: 120 px.
- Immagine del profilo: `instagram/profilo-monogramma.png` (AS verde su rosa; Instagram la ritaglia in un
  cerchio: il monogramma resta al centro). In alternativa `profilo-logo.png`.

## Tono di voce
Calmo, preciso, sensoriale. Frasi brevi. Parole di architettura e di luce: *lugar, luz, materia,
recorrido, paso, detalle*. Niente gergo tecnico nei post (WebGL, Three.js solo se si parla ad altri
designer). Il sito non si "guarda": si visita, si attraversa.

## Servizi
- **Marca:** estrategia y posicionamiento · branding e identidad visual · naming y tono de voz ·
  dirección creativa y de arte
- **Digital:** sitios web 3D inmersivos · diseño UX/UI · showrooms y configuradores 3D · desarrollo,
  publicación y mantenimiento
- **Contenido:** renders y animaciones 3D · motion design y video · contenido para redes sociales ·
  campañas y lanzamientos

## Il sito
Un percorso in 3D guidato dallo scroll, in un edificio di cemento rosa sul mare: si entra dalla finestra
circolare, ci si ferma accanto ai divani verdi (ALESSIA STUDIO), sotto il lucernario (Visión), fuori
sulla terrazza davanti al mare (Qué hacemos), poi ci si tuffa: sul fondale c'è una statua di bronzo che
si gira col dito, con due squali attorno e le bolle che salgono; infine lo sguardo sale verso la luce
(Contáctanos). Niente progetti di clienti: non c'è l'autorizzazione a mostrarli.

## Formati
- Post: **1080 × 1350** (4:5) · quadrato 1080 × 1080 · storie e reel 1080 × 1920
  (nelle storie lasciare liberi 250 px in alto e 340 in basso)
- Margini interni: 72 px

## I primi 9 post (in `instagram/post/`, 1080 × 1350)
Si pubblicano in quest'ordine; nella griglia del profilo l'ultimo sta in alto a sinistra, così immagini e
grafiche si alternano a scacchiera (anteprima: `instagram/post/griglia.jpg`).
| | File | Didascalia |
|---|---|---|
| 1 | `01-logo.jpg` | ALESSIA STUDIO. Branding, dirección creativa y sitios web 3D. Italia · México · Colombia · Worldwide. |
| 2 | `02-manifiesto.jpg` | Un sitio web puede ser un lugar, no una página. Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. |
| 3 | `03-el-sitio.jpg` | Nuestro sitio es un recorrido en 3D: un edificio de hormigón rosa sobre el mar. Cada scroll es un paso. |
| 4 | `04-worldwide.jpg` | Nacimos en Italia, trabajamos entre México y Colombia, con marcas de todo el mundo. |
| 5 | `05-el-fondo.jpg` | Al final del recorrido, un salto al mar: en el fondo, una escultura en 3D que se gira con el dedo, en tiempo real. |
| 6 | `06-contacto.jpg` | ¿Tienes un lugar que construir? Escríbenos por WhatsApp: +39 346 175 8562. Trabajamos en remoto en español, italiano, inglés y portugués. |
| 7 | `07-verde.jpg` | El verde de la casa: los sofás donde empieza el recorrido de nuestro sitio. |
| 8 | `08-que-hacemos.jpg` | Marca, digital y contenido, del concepto a la publicación, con un solo equipo: cada proyecto cuidado como una obra de arquitectura. |
| 9 | `09-la-casa.jpg` | Se entra por la ventana circular: abajo, los sofás verdes y la luz del lucernario. |

Si rifanno con `node tools/ig-posts.mjs <cartella>` (vedi in cima al file).

Hashtag possibili: #diseñoweb #webdesign #sitiosweb3d #branding #direccióncreativa #diseño3d
#mérida #yucatán #méxico #italia
