/**
 * Generates all search variants for Turkish and English case-insensitivity,
 * handling Turkish characters like ı/I/İ/i, ş/s/Ş/S, ç/c/Ç/C, ğ/g/Ğ/G, ö/o/Ö/O, ü/u/Ü/U.
 */
export function getSearchVariants(search?: string): string[] {
    if (!search || !search.trim()) return [];
    const trimmed = search.trim();
    const set = new Set<string>();

    set.add(trimmed);
    set.add(trimmed.toLowerCase());
    set.add(trimmed.toUpperCase());
    set.add(trimmed.toLocaleLowerCase('tr-TR'));
    set.add(trimmed.toLocaleUpperCase('tr-TR'));

    // English ascii normalized (replace Turkish specific letters with ASCII)
    const ascii = trimmed
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'I')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'C')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'G')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'O')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 'S')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'U');

    set.add(ascii);
    set.add(ascii.toLowerCase());
    set.add(ascii.toUpperCase());
    set.add(ascii.toLocaleLowerCase('tr-TR'));
    set.add(ascii.toLocaleUpperCase('tr-TR'));

    // Turkish dotless I and dotted I variations
    const withDotlessI = trimmed.replace(/i/g, 'ı').replace(/İ/g, 'I');
    set.add(withDotlessI);
    set.add(withDotlessI.toLowerCase());
    set.add(withDotlessI.toUpperCase());
    set.add(withDotlessI.toLocaleLowerCase('tr-TR'));
    set.add(withDotlessI.toLocaleUpperCase('tr-TR'));

    const withDottedI = trimmed.replace(/ı/g, 'i').replace(/I/g, 'İ');
    set.add(withDottedI);
    set.add(withDottedI.toLowerCase());
    set.add(withDottedI.toUpperCase());
    set.add(withDottedI.toLocaleLowerCase('tr-TR'));
    set.add(withDottedI.toLocaleUpperCase('tr-TR'));

    return Array.from(set).filter(v => v.length > 0);
}
