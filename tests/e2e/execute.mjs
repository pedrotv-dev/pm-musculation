// Fermer et tracer aussi les pannes survenues hors des blocs step().
import { diagnostics } from './diagnostics.mjs';

let stopping = false;
async function fatal(error) {
  if (stopping) return;
  stopping = true;
  console.error(error?.stack || error);
  try { await diagnostics.failure('erreur fatale du parcours', error); await diagnostics.shutdown(); }
  finally { process.exit(1); }
}
process.on('unhandledRejection', fatal);
process.on('uncaughtException', fatal);
try {
  const name = process.argv[2];
  if (!/^(?:[a-z0-9-]+-flow|audit-(?:a11y|ui|faults))$/.test(name || '')) throw new Error('Nom de parcours invalide.');
  await import(new URL(name + '.mjs', import.meta.url));
} catch (error) { await fatal(error); }
