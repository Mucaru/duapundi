type Listener = (isSyncing: boolean) => void;

let syncing = false;
const listeners = new Set<Listener>();

export function setSyncing(value: boolean) {
  syncing = value;
  listeners.forEach((l) => l(value));
}

export function getSyncing() {
  return syncing;
}

export function subscribeSyncing(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
