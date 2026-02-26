// Sistema simple de logs categorizados para el proyecto
// Cada mensaje se imprimirá en la consola con prefijo [CATEGORIA] para facilitar filtrado.

type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';

function formatTag(category: string, level: LogLevel) {
  return `[${category}] [${level}]`;
}

// Buffer simple en memoria para mostrar logs en la UI del navegador.
// Guardamos los últimos N mensajes y permitimos un callback de suscripción.
const BUFFER_SIZE = 200;
const buffer: string[] = [];
const subscribers: Array<() => void> = [];

function pushToBuffer(msg: string) {
  buffer.push(msg);
  while (buffer.length > BUFFER_SIZE) buffer.shift();
  for (const s of subscribers) s();
}

export function getLogs() {
  return buffer.slice();
}

export function subscribeLogs(cb: () => void) {
  subscribers.push(cb);
  return () => {
    const idx = subscribers.indexOf(cb);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

export const Log = {
  info: (category: string, ...args: any[]) => {
    const msg = `${formatTag(category, 'INFO')} ${args.map(a => String(a)).join(' ')}`;
    console.log(msg, ...args.slice(1));
    pushToBuffer(msg);
  },
  debug: (category: string, ...args: any[]) => {
    const msg = `${formatTag(category, 'DEBUG')} ${args.map(a => String(a)).join(' ')}`;
    console.debug(msg);
    pushToBuffer(msg);
  },
  warn: (category: string, ...args: any[]) => {
    const msg = `${formatTag(category, 'WARN')} ${args.map(a => String(a)).join(' ')}`;
    console.warn(msg);
    pushToBuffer(msg);
  },
  error: (category: string, ...args: any[]) => {
    const msg = `${formatTag(category, 'ERROR')} ${args.map(a => String(a)).join(' ')}`;
    console.error(msg);
    pushToBuffer(msg);
  },
};
