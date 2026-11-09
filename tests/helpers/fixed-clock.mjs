// Horloge de test : fixe le JOUR de référence sans figer le temps (il continue de s'écouler normalement, les durées
// et les temporisateurs restent réels). Utile aux tests dont le scénario dépend du jour de la semaine (profil Démo :
// la séance en cours suit le programme du jour). Seuls `new Date()` sans argument et `Date.now()` sont décalés.

/** Source d'une fonction autonome (aussi injectée dans le navigateur par Playwright : `addInitScript(fixedClock, iso)`). */
export function fixedClock(iso) {
  const Real = globalThis.__realDate || Date;
  globalThis.__realDate = Real;
  let offset = new Real(iso).getTime() - Real.now();
  class TestDate extends Real {
    constructor(...args) { if (args.length === 0) super(Real.now() + offset); else super(...args); }
    static now() { return Real.now() + offset; }
  }
  globalThis.Date = TestDate;
  /** Change le jour de référence (même processus / même page). */
  globalThis.__setTestNow = next => { offset = new Real(next).getTime() - Real.now(); };
  return globalThis.__setTestNow;
}

/** Node : installe l'horloge et renvoie `set(iso)` pour changer de jour en cours de test. */
export function installClock(iso) { return fixedClock(iso); }
