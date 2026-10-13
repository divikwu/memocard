// Keep decimal source text across the bridge, including values beyond safe integer precision.
export function validPropertyNumber(value:string):boolean {
  return /^[+-]?(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
}
