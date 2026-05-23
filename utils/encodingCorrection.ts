/**
 * Heuristics and programmatic restoration of encoding errors (Mojibake & Lossy Decodings)
 * for Portuguese names/emails imported into BELARE.
 */

export const fixCorruptedText = (text: string): string => {
  if (!text) return text;

  let fixed = text;

  // 1. ADVANCED: Lossless Restoration of Double UTF-8 Decoding (Mojibake)
  // E.g., "JoÃ£o" -> [J, o, Ã, £, o] -> bytes: [74, 111, 195, 163, 111] -> decoded as UTF-8 -> "João"
  try {
    // Only attempt if the string contains telltale Latin1-interpreted UTF-8 sequence markers
    if (
      text.includes('Ã') || 
      text.includes('Â') || 
      text.includes('â€') || 
      text.includes('Ã©') || 
      text.includes('Ã¢') || 
      text.includes('Ã£')
    ) {
      // Build a byte array where every character is mapped to its raw byte code (ISO-8859-1 / Latin1 representation)
      const bytes = new Uint8Array(text.split('').map(c => c.charCodeAt(0)));
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      
      if (decoded && decoded !== text && decoded.length > 0) {
        return decoded;
      }
    }
  } catch (e) {
    // Safe fallback if it contains non-decodable raw bytes or is not a proper double encoding
  }

  // 2. DETERMINISTIC REPLACEMENTS (For mixed or partially corrupted strings)
  const replaceMap: [RegExp, string][] = [
    [/Ã¢/g, 'â'],
    [/Ã£/g, 'ã'],
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã\u00ad/g, 'í'],
    [/Ã\u00AD/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    [/Ã§/g, 'ç'],
    [/Ãª/g, 'ê'],
    [/Ã´/g, 'ô'],
    [/Ãµ/g, 'õ'],
    [/Ã /g, 'à'],
    [/Ã¨/g, 'è'],
    [/Ã¬/g, 'ì'],
    [/Ã²/g, 'ò'],
    [/Ã¹/g, 'ù'],
    [/Ã‰/g, 'É'],
    [/Ã/g, 'Á'],
    [/Ã“/g, 'Ó'],
    [/Ãš/g, 'Ú'],
    [/Ã‚/g, 'Â'],
    [/Ã‡/g, 'Ç'],
    [/Ã”/g, 'Ô'],
    [/Ã•/g, 'Õ'],
    [/Ãƒ/g, 'Ã'],
    [/â€“/g, '–'],
    [/â€”/g, '—']
  ];

  for (const [pattern, repl] of replaceMap) {
    fixed = fixed.replace(pattern, repl);
  }

  // 3. LOSSY SYLLABLE AND REPLACEMENT CHARACTER (\uFFFD / ) HEURISTICS
  fixed = fixed.replace(/j\uFFFDs/gi, 'José');
  fixed = fixed.replace(/j\uFFFD[o|]\b/gi, (m) => m[0] === 'J' ? 'João' : 'joão');
  fixed = fixed.replace(/j\uFFFD[o|]/gi, (m) => m[0] === 'J' ? 'João' : 'joão');
  fixed = fixed.replace(/j\uFFFD\b/gi, (m) => m[0] === 'J' ? 'João' : 'joão');
  fixed = fixed.replace(/jo\uFFFD\uFFFD/gi, (m) => m[0] === 'J' ? 'João' : 'joão');
  fixed = fixed.replace(/jo\uFFFDo/gi, (m) => m[0] === 'J' ? 'João' : 'joão');

  // Common endings and patterns with replacement character
  fixed = fixed.replace(/eia\uFFFDo/gi, 'eição');
  fixed = fixed.replace(/ei\uFFFDo/gi, 'eição');
  fixed = fixed.replace(/(\w)\uFFFDo\b/gi, '$1ão');

  // Common names dictionary matches
  const commonNames: Record<string, string> = {
    'silvnia': 'Silvânia',
    'silv\uFFFDnia': 'Silvânia',
    'joo': 'João',
    'jo\uFFFD\uFFFD': 'João',
    'jo\uFFFDo': 'João',
    'mrcia': 'Márcia',
    'm\uFFFDrcia': 'Márcia',
    'mrcio': 'Márcio',
    'm\uFFFDrcio': 'Márcio',
    'valria': 'Valéria',
    'val\uFFFDria': 'Valéria',
    'andr': 'André',
    'andr\uFFFD': 'André',
    'vitria': 'Vitória',
    'vit\uFFFDria': 'Vitória',
    'flvia': 'Flávia',
    'fl\uFFFDvia': 'Flávia',
    'snia': 'Sônia',
    's\uFFFDnia': 'Sônia',
    'tnia': 'Tânia',
    't\uFFFDnia': 'Tânia',
    'ctia': 'Cátia',
    'c\uFFFDtia': 'Cátia',
    'dbora': 'Débora',
    'd\uFFFDbora': 'Débora',
    'jlio': 'Júlio',
    'j\uFFFDlio': 'Júlio',
    'cludio': 'Cláudio',
    'cl\uFFFDudio': 'Cláudio',
    'rogrio': 'Rogério',
    'rog\uFFFDrio': 'Rogério',
    'srgio': 'Sérgio',
    's\uFFFDrgio': 'Sérgio',
    'lcia': 'Lúcia',
    'l\uFFFDcia': 'Lúcia',
    'amlia': 'Amélia',
    'am\uFFFDlia': 'Amélia',
    'patrcia': 'Patrícia',
    'patr\uFFFDcia': 'Patrícia',
    'letcia': 'Letícia',
    'let\uFFFDcia': 'Letícia',
    'thas': 'Thaís',
    'tha\uFFFDs': 'Thaís',
    'tas': 'Taís',
    'ta\uFFFDs': 'Taís',
    'las': 'Laís',
    'la\uFFFDs': 'Laís',
    'slvia': 'Sílvia',
    's\uFFFDlvia': 'Sílvia',
    'fbio': 'Fábio',
    'f\uFFFDbio': 'Fábio',
    'estevo': 'Estevão',
    'estev\uFFFDao': 'Estevão',
    'estev\uFFFDo': 'Estevão',
    'romrio': 'Romário',
    'rom\uFFFDrio': 'Romário',
    'rosngela': 'Rosângela',
    'ros\uFFFDngela': 'Rosângela',
    'mnica': 'Mônica',
    'm\uFFFDnica': 'Mônica',
    'vernica': 'Verônica',
    'ver\uFFFDnica': 'Verônica',
    'lusa': 'Luísa',
    'lu\uFFFDsa': 'Luísa',
    'luz': 'Luiz',
    'lu\uFFFDz': 'Luiz',
    'csar': 'César',
    'c\uFFFDsar': 'César',
    'ins': 'Inês',
    'in\uFFFDs': 'Inês',
    'jos': 'José',
    'jos\uFFFD': 'José',
    'antnio': 'Antônio',
    'ant\uFFFDnio': 'Antônio',
    'marllia': 'Marília',
    'marl\uFFFDlia': 'Marília',
    'ceclia': 'Cecília',
    'cec\uFFFDlia': 'Cecília',
    'emlia': 'Emília',
    'em\uFFFDlia': 'Emília',
    'otvio': 'Otávio',
    'ot\uFFFDvio': 'Otávio',
    'g\uFFFDnter': 'Gúnter',
    'cl\uFFFDia': 'Cléia',
    'adlia': 'Adélia',
    'oflia': 'Ofélia',
    'cidlia': 'Cidália',
    'nlia': 'Nélia',
    'reginlia': 'Reginália'
  };

  // Split and fix word by word
  let words = fixed.split(' ');
  words = words.map(w => {
    const cleanW = w.toLowerCase().replace(/[^a-z\uFFFD]/g, '');
    if (commonNames[cleanW]) {
      const fixedWord = commonNames[cleanW];
      if (w === w.toUpperCase()) {
        return fixedWord.toUpperCase();
      } else if (w[0] === w[0].toUpperCase()) {
        return fixedWord[0].toUpperCase() + fixedWord.slice(1);
      }
      return fixedWord;
    }
    return w;
  });
  fixed = words.join(' ');

  // Suffix/infix fallback replacements for leftover individual replacement characters
  fixed = fixed.replace(/(\w)\uFFFDnia/gi, '$1ânia');
  fixed = fixed.replace(/(\w)\uFFFDria/gi, '$1ária');
  fixed = fixed.replace(/(\w)\uFFFDcia/gi, '$1ícia');
  fixed = fixed.replace(/(\w)\uFFFDo/gi, '$1ão');
  fixed = fixed.replace(/(\w)\uFFFDlia/gi, '$1élia');
  fixed = fixed.replace(/(\w)\uFFFDncio/gi, '$1êncio');
  fixed = fixed.replace(/(\w)\uFFFDncia/gi, '$1ência');
  fixed = fixed.replace(/(\w)\uFFFDs\b/gi, '$1és');
  fixed = fixed.replace(/(\w)\uFFFDio/gi, '$1io');

  return fixed;
};
