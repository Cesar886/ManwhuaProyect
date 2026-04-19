// Diccionario de expansión semántica para queries. Se extrajo de embeddings.js
// para que módulos sin dependencia de DB/OpenAI (query-rewriter, tests)
// puedan requerirlo sin arrastrar el pool de Postgres.
//
// Enriquece la query del usuario con términos relacionados que mejoran la
// similitud con los embeddings de las series. Bilingüe: text-embedding-3-small
// es cross-lingual, pero los sinónimos bilingües mejoran recall en queries EN.

const QUERY_EXPANSIONS = {
    // Arquetipos de protagonista
    'debil': 'debil a fuerte zero to hero underdog protagonista debil crecimiento',
    'fuerte': 'protagonista fuerte overpowered op poderoso invencible',
    'op': 'overpowered protagonista fuerte poderoso invencible desde el inicio',
    'chetado': 'overpowered protagonista fuerte poderoso op invencible',
    'inteligente': 'protagonista inteligente estratega calculador genio mente brillante',
    'frio': 'protagonista frio calculador sin emociones despiadado',
    'despiadado': 'protagonista despiadado cruel villano antihero sin piedad',
    'badass': 'protagonista fuerte cool badass poderoso',
    'inutil': 'protagonista debil inutil basura zero to hero crecimiento',
    'basura': 'protagonista despreciado debil basura trash zero to hero',

    // Tropos narrativos
    'venganza': 'venganza revancha traicion retribucion ajuste de cuentas',
    'traicion': 'traicion venganza abandono apunalado por la espalda',
    'regresion': 'regresion volver al pasado segunda oportunidad viaje en el tiempo',
    'reencarnacion': 'reencarnacion isekai otro mundo segunda vida transmigrar',
    'isekai': 'isekai otro mundo reencarnacion transmigrar invocado',
    'sistema': 'sistema de niveles pantalla de estado RPG nivel stats ventana',
    'leveling': 'subir de nivel sistema leveling crecimiento poder',
    'dungeon': 'dungeon mazmorra torre portal monstruos exploracion',
    'torre': 'torre tower escalada pisos desafios subir',
    'murim': 'murim artes marciales cultivacion wuxia qi chi kung fu',
    'cultivacion': 'cultivacion murim artes marciales qi chi poder interno sectas',
    'apocalipsis': 'apocalipsis fin del mundo supervivencia zombies monstruos caos',
    'supervivencia': 'supervivencia apocalipsis sobrevivir lucha por vivir death game',

    // Géneros / vibes
    'romance': 'romance amor pareja relacion sentimental',
    'comedia': 'comedia humor gracioso divertido risa',
    'terror': 'terror horror miedo suspenso sobrenatural oscuro',
    'escolar': 'escolar escuela colegio estudiantes instituto campus vida escolar',
    'drama': 'drama emocional tragedia sentimientos lagrimas',

    // Clases / razas
    'nigromante': 'nigromante necromancer muertos vivientes no-muertos esqueletos invocador oscuro',
    'cazador': 'cazador hunter monstruos dungeon rango caza',
    'asesino': 'asesino sombras sigilo daga veneno stealth',
    'mago': 'mago magia hechicero brujo mana hechizos arcano',
    'espadachin': 'espadachin espada guerrero blade sword master',
    'sanador': 'sanador healer curador soporte apoyo',

    // Tipos de historia
    'harem': 'harem multiples intereses amorosos rodeado de chicas',
    'otome': 'otome isekai villainess duquesa princesa noble reencarnacion novela',
    'militar': 'militar guerra ejercito batalla estrategia',
    'deportes': 'deportes competicion torneo entrenamiento rival',
    'slice of life': 'slice of life vida cotidiana tranquilo relajado dia a dia',
    'politica': 'politica reino imperio poder trono conspiracion intriga',

    // Inglés — los embeddings de las series están en español, pero
    // text-embedding-3-small es cross-lingual. Aun así conviene inyectar
    // sinónimos bilingües para queries EN: mejora recall y empata con
    // el vocabulario usado en sinopsis/temas.
    'weak': 'weak to strong debil zero to hero underdog growth protagonist',
    'strong': 'strong protagonist overpowered op powerful invincible fuerte',
    'overpowered': 'overpowered op strong powerful invincible from the start fuerte',
    'smart': 'smart protagonist strategist calculating genius brilliant mind inteligente',
    'cold': 'cold protagonist calculating emotionless ruthless frio',
    'ruthless': 'ruthless cruel antihero despiadado villain no mercy',
    'revenge': 'revenge betrayal retribution payback vengeance venganza',
    'betrayal': 'betrayal revenge abandoned stabbed in the back traicion',
    'regression': 'regression go back to past second chance time travel regresion',
    'reincarnation': 'reincarnation isekai another world second life transmigration reencarnacion',
    'tower': 'tower climbing floors challenges torre',
    'dungeon': 'dungeon monsters portal exploration mazmorra',
    'hunter': 'hunter monsters dungeon rank cazador',
    'necromancer': 'necromancer undead skeletons dark summoner nigromante',
    'assassin': 'assassin shadows stealth dagger poison asesino',
    'mage': 'mage magic wizard sorcerer mana spells arcane mago',
    'swordsman': 'swordsman sword warrior blade master espadachin',
    'martial arts': 'martial arts murim cultivation wuxia qi kung fu artes marciales',
    'cultivation': 'cultivation murim martial arts qi inner power sects cultivacion',
    'apocalypse': 'apocalypse end of the world survival zombies monsters chaos apocalipsis',
    'survival': 'survival apocalypse survive death game supervivencia',
    'system': 'system levels status window RPG level stats sistema',
    'leveling': 'leveling up system growth power level up',
    'school': 'school high school students campus classroom escolar',
    'romance': 'romance love couple relationship feelings',
    'villainess': 'villainess otome isekai duchess noble reincarnation novel otome',
    'harem': 'harem multiple love interests surrounded by girls'
};

module.exports = { QUERY_EXPANSIONS };
