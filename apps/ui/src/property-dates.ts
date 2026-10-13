export const propertyDateString = (date:Date) => `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function validPropertyDate(value:string):boolean {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match || Number(value.slice(0,4)) === 0) return false;
  const day = new Date(`${match[1]}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== match[1]) return false;
  if (!match[2]) return true;
  return Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4] ?? 0) < 60 && Number.isFinite(Date.parse(value));
}

export function parsePropertyDate(value:string) {
  if (!validPropertyDate(value)) return undefined;
  return new Date(`${value.slice(0,10)}T12:00:00`);
}

export function formatPropertyDate(value:string) {
  return parsePropertyDate(value) ? `${value.slice(5,7)}/${value.slice(8,10)}/${value.slice(0,4)}${value.includes('T') ? ` ${value.slice(11)}` : ''}` : value;
}

export function propertyDateTime(day:string, time:string, original:string):string {
  const existingZone = original.match(/(Z|[+-]\d{2}:\d{2})$/)?.[1];
  const offset = -new Date(`${day}T${time}`).getTimezoneOffset();
  const zone = existingZone ?? `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')}`;
  return `${day}T${time.length === 5 ? `${time}:00` : time}${zone}`;
}
