import DB from './cards.json' with { type: 'json' };

export function normalizeVariants(value = {}, expansion = false, advanced = true) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Choose valid table variants.');
  const max = DB.filter(d => d.t === 'EPIC' && (expansion || d.set !== 'oracle')).length;
  const epicCount = value.epicCount == null ? null : value.epicCount;
  if (epicCount !== null && (!Number.isInteger(epicCount) || epicCount < 0 || epicCount > max))
    throw Error(`Choose between 0 and ${max} Epic cards.`);
  const relic = value.relic || null;
  if (relic && relic !== 'random' && !relicOptions(expansion, advanced).some(d => d.id === relic))
    throw Error('Choose an available Item other than Soopa Soaka for the Relic.');
  return { abolishUnity: !!value.abolishUnity, epicCount,
    mainOnly: !!value.mainOnly || epicCount === 0, mirrors: !!value.mirrors, relic };
}

export function relicOptions(expansion = false, advanced = true) {
  return DB.filter(d => d.t === 'ITEM' && d.id !== 'c2512' && d.set !== 'promo'
    && (expansion || d.set !== 'oracle') && (advanced || !['axe', 'toy'].includes(d.passive)));
}
