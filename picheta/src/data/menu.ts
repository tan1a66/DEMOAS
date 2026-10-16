import type { Lang } from '../i18n';

/**
 * Menú de Picheta según picheta.mx/menu/ (versión en español, consultada el 16-10-2026).
 *
 * - Precios y créditos: tal como aparecen en el menú en español (el menú inglés oficial está desactualizado:
 *   otros platos y precios).
 * - Nombre y descripción se separan para leerse mejor; el contenido es el oficial. Se corrigieron solo erratas
 *   evidentes ("ensalda", "mantquilla", "Papantal", "LaTradición").
 * - Inglés: se usa la redacción del menú inglés oficial cuando el plato aparece en él; el resto es traducción
 *   de la propuesta a partir del español.
 */
export interface Dish {
  name: Record<Lang, string>;
  detail: Record<Lang, string>;
  /** Precio en pesos mexicanos. */
  price: number;
  /** Chef o autor invitado, tal como lo acredita el menú oficial. */
  author?: string;
}

export interface MenuCategory {
  id: string;
  title: Record<Lang, string>;
  dishes: Dish[];
}

export const MENU: MenuCategory[] = [
  {
    id: 'entradas',
    title: { es: 'Entradas', en: 'Starters' },
    dishes: [
      {
        name: { es: 'Sopa tradicional de lima', en: 'Traditional lime soup' },
        detail: { es: 'Con pavo y tortilla tostada.', en: 'With turkey and tortilla strips.' },
        price: 190,
        author: 'Chef David Cetina · La Tradición',
      },
      {
        name: { es: 'Tostaditas de atún', en: 'Tuna tostaditas' },
        detail: {
          es: 'Con limón, aguacate, pepino, cilantro, aceite de ajonjolí, fritura y cenizas de tortilla. 6 piezas.',
          en: 'With lime, avocado, cucumber, coriander, sesame oil, tortilla crisps and tortilla ash. 6 pieces.',
        },
        price: 240,
      },
      {
        name: { es: 'Salbutes de plátano macho', en: 'Plantain salbutes' },
        detail: {
          es: 'Con chucrut yucateco (col blanca, zanahoria, naranja agria), aguacate y brotes de cilantro.',
          en: 'Puffed tortillas with Yucatecan sauerkraut (white cabbage, carrot, bitter orange), avocado and coriander sprouts.',
        },
        price: 210,
      },
      {
        name: { es: 'Yucasotto', en: 'Yucassotto' },
        detail: {
          es: 'Con carne ahumada de Temozón y queso de bola.',
          en: 'Cassava risotto with smoked meat from Temozón and Edam cheese.',
        },
        price: 250,
        author: 'Chef Alex Méndez · Astro',
      },
      {
        name: { es: 'Carpaccio de pulpo', en: 'Octopus carpaccio' },
        detail: {
          es: 'Con holandesa de xcatic, gel de naranja agria, sal de mar y pimienta.',
          en: 'With xcatic chili hollandaise, bitter orange gel, sea salt and pepper.',
        },
        price: 310,
      },
      {
        name: { es: 'Tacos de cerdo pelón', en: 'Cerdo pelón tacos' },
        detail: {
          es: 'En tortilla de maíz azul, con cremoso de aguacate, cebolla morada, cilantro y salsa habanera. 3 piezas.',
          en: 'On blue-corn tortillas with avocado cream, red onion, coriander and habanero salsa. 3 pieces.',
        },
        price: 280,
        author: 'Chef Luis Barocio',
      },
      {
        name: { es: 'Coliflor al pastor', en: 'Al pastor–style cauliflower' },
        detail: { es: 'Con guacamole de la casa y salsa mexicana.', en: 'With the house guacamole and salsa mexicana.' },
        price: 250,
        author: 'Geraldine Abraham · Rhuban',
      },
      {
        name: { es: 'Guacamole', en: 'Guacamole' },
        detail: { es: 'Con carne ahumada de Temozón y pico de gallo.', en: 'With smoked meat from Temozón and pico de gallo.' },
        price: 250,
      },
      {
        name: { es: 'Pizzeta de langosta', en: 'Lobster pizzetta' },
        detail: {
          es: 'Con mantequilla y ajo, salsa pomodoro fresca, jitomate deshidratado y albahaca.',
          en: 'With garlic butter, fresh pomodoro sauce, dried tomato and basil.',
        },
        price: 320,
      },
      {
        name: { es: 'Carpaccio de res', en: 'Beef carpaccio' },
        detail: {
          es: 'Con chaya y ceniza de romero y cacao, flor de sal, pimienta rosa y arúgula con vinagreta de lima.',
          en: 'With chaya (tree spinach), rosemary and cocoa ash, fleur de sel, pink peppercorn and arugula in lime vinaigrette.',
        },
        price: 250,
      },
      {
        name: { es: 'Tacos de camarón', en: 'Shrimp tacos' },
        detail: {
          es: 'Con chilmole, xnipec, cremoso de aguacate y crujiente de arroz.',
          en: 'With chilmole, xnipec, avocado cream and crispy rice.',
        },
        price: 260,
      },
      {
        name: { es: 'Tacos de rib eye', en: 'Rib-eye tacos' },
        detail: {
          es: 'En tortilla de recado negro, con pimientos rostizados, salsa tatemada y esferificación de cilantro local.',
          en: 'On black-recado tortillas with roasted peppers, charred salsa and local coriander spherification.',
        },
        price: 380,
      },
    ],
  },
  {
    id: 'platos-fuertes',
    title: { es: 'Platos fuertes', en: 'Main courses' },
    dishes: [
      {
        name: { es: 'Pechuga de pollo glaseada con miel de habanero', en: 'Chicken breast glazed with habanero honey' },
        detail: {
          es: 'Rellena de calabaza local, acompañada de ensalada de arándanos y semillas.',
          en: 'Stuffed with local squash, served with a cranberry and seed salad.',
        },
        price: 310,
      },
      {
        name: { es: 'Hamburguesa de venado y res', en: 'Venison and beef burger' },
        detail: {
          es: 'Champiñones rostizados, pimientos, mostaza rústica y alioli de xcatik en pan de achiote; papas cambray con ajo y mantequilla.',
          en: 'Roasted mushrooms, peppers, old-style mustard and xcatic chili aioli on an achiote bun; baby potatoes with garlic and butter.',
        },
        price: 330,
      },
      {
        name: { es: 'Fettuccine de pasta fresca', en: 'Fresh fettuccine' },
        detail: { es: 'Con salsa de vino blanco y camarones salteados.', en: 'With white wine sauce and sautéed shrimp.' },
        price: 350,
      },
      {
        name: { es: 'Jaiba suave tempura', en: 'Soft-shell crab tempura' },
        detail: { es: 'Con chutney de manzana y ensalada de mango.', en: 'With apple chutney and mango salad.' },
        price: 470,
      },
      {
        name: { es: 'Ravioles de ricotta y longaniza de Valladolid', en: 'Ricotta and Valladolid sausage ravioli' },
        detail: {
          es: 'En salsa bechamel de chile xcatik, con queso parmesano y pan campesino.',
          en: 'In xcatic chili béchamel, with parmesan and country bread.',
        },
        price: 320,
      },
      {
        name: { es: 'Ravioles de cangrejo moro', en: 'Stone crab ravioli' },
        detail: { es: 'Pasta bicolor, cilantro local y salsa menier.', en: 'Two-tone pasta, local coriander and meunière sauce.' },
        price: 330,
      },
      {
        name: { es: 'Risotto a la lima', en: 'Lime risotto' },
        detail: {
          es: 'Con picaña marinada en cerveza Ceiba o salmón, a elegir.',
          en: 'With Ceiba-beer-marinated picanha or salmon, your choice.',
        },
        price: 450,
      },
      {
        name: { es: 'Salmón en costra de pepita', en: 'Salmon in pumpkin-seed crust' },
        detail: { es: 'Risotto a la lima y ceniza de tortilla.', en: 'Lime risotto and corn tortilla ash.' },
        price: 450,
        author: 'Universidad del Centro',
      },
      {
        name: { es: 'Roulle de pescado', en: 'Fish roulade' },
        detail: {
          es: 'Con ceniza de tortilla, mantequilla noisette, ajo, almendra, calabaza local y zanahoria baby.',
          en: 'With tortilla ash, brown butter, garlic, almond, local squash and baby carrots.',
        },
        price: 460,
      },
      {
        name: { es: 'Cordero en pesto de hierbas', en: 'Lamb in herb pesto' },
        detail: {
          es: 'Puré de camote aromatizado con hojas de plátano, salsa de calabaza frita, espuma de chile xcatic y crocante de pepita.',
          en: 'Sweet potato purée scented with banana leaf, fried squash sauce, xcatic chili foam and pumpkin-seed crisp.',
        },
        price: 590,
        author: 'Talento Picheta · Universidad Vizcaya de las Américas',
      },
      {
        name: { es: 'Filete de res madurado', en: 'Aged beef fillet' },
        detail: {
          es: 'Con mantequilla y romero, sofrito de champiñones trufados con chaya y puré de papa.',
          en: 'With butter and rosemary, truffled mushroom and chaya sauté, and mashed potatoes.',
        },
        price: 560,
      },
      {
        name: { es: 'Ensalada fresca', en: 'Fresh salad' },
        detail: {
          es: 'Guayaba, higo, pistache y jitomate cherry, con aderezo de miel de la región y mostaza antigua.',
          en: 'Guava, fig, pistachio and cherry tomato, with a local honey and old-style mustard dressing.',
        },
        price: 220,
      },
    ],
  },
  {
    id: 'postres',
    title: { es: 'Postres', en: 'Desserts' },
    dishes: [
      {
        name: { es: 'Tarta de pistache', en: 'Pistachio tart' },
        detail: { es: 'Con crema pastelera de vainilla de Papantla.', en: 'With Papantla vanilla pastry cream.' },
        price: 250,
      },
      {
        name: { es: 'Manjar de coco', en: 'Coconut blancmange' },
        detail: { es: 'Con esponja de coco y helado de coco tostado.', en: 'With coconut sponge and toasted coconut ice cream.' },
        price: 195,
        author: 'Chef Miriam Peraza · Manjar Blanco',
      },
      {
        name: { es: 'Fudge de chocolate', en: 'Chocolate fudge' },
        detail: { es: 'Con helado de flores y jamaica.', en: 'With flower and hibiscus ice cream.' },
        price: 220,
      },
      {
        name: { es: 'Pavlova', en: 'Pavlova' },
        detail: {
          es: 'Rellena de gel de mango y crema diplomat de vainilla de Papantla.',
          en: 'Filled with mango gel and Papantla vanilla crème diplomate.',
        },
        price: 210,
      },
      {
        name: { es: 'Cenote de dulce de leche', en: 'Dulce de leche cenote' },
        detail: { es: 'Con helado de vainilla de Papantla y frutos rojos.', en: 'With Papantla vanilla ice cream and berries.' },
        price: 250,
      },
    ],
  },
];
