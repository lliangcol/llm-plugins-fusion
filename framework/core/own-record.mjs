/** Return only an own property from a plain record-like value. */
export function ownRecordValue(record, key) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || typeof key !== 'string' || !Object.hasOwn(record, key)) {
    return undefined;
  }
  return record[key];
}
