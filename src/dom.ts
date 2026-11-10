/** Returns the element with the given id; throws if the page does not contain it or it has another type. */
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing element #${id}`);
  return el;
}
