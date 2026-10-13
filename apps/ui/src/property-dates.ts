export const propertyDateString = (date:Date) => `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function parsePropertyDate(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && propertyDateString(date) === value ? date : undefined;
}

export function formatPropertyDate(value:string) {
  return parsePropertyDate(value) ? `${value.slice(5,7)}/${value.slice(8,10)}/${value.slice(0,4)}` : value;
}
