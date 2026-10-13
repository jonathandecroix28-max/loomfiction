import {
  getDb,
  rwTx,
  isTempId,
  httpStatus,
  isOnline,
  withTimeout,
  queueOp,
  getOps,
  clearOp,
  clearOpsFor,
  mergeServerSnapshot,
  type Entity,
  type RwTx,
} from './loomfictionDb';

/* -------------------------------------------------------------------------- */
/*  Petits utilitaires partagés par tous les services                          */
/* -------------------------------------------------------------------------- */

export const nowIso = (): string => new Date().toISOString();

/** Comparaison de textes insensible à la casse et aux espaces (titres, noms…). */
export const sameText = (a?: string, b?: string): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Dédoublonne par clé métier (ex. livre + n° de chapitre).
 * À clé égale, la version du serveur l'emporte sur la version temporaire.
 */
export function dedupeBy<T extends { id: number }>(keyOf: (item: T) => string) {
  return (items: T[]): T[] => {
    const byKey = new Map<string, T>();
    for (const item of items) {
      const key = keyOf(item);
      const kept = byKey.get(key);
      if (!kept || (isTempId(kept.id) && !isTempId(item.id))) byKey.set(key, item);
    }
    return [...byKey.values()];
  };
}

/** Pas de réponse HTTP = réseau coupé, serveur injoignable ou délai dépassé. */
const isNetworkError = (err: unknown): boolean => !(err as any)?.response;

/* -------------------------------------------------------------------------- */
/*  Configuration                                                              */
/* -------------------------------------------------------------------------- */

export type StoreName =
  | 'books'
  | 'chapters'
  | 'chapterVersions'
  | 'ideas'
  | 'ideaVersions'
  | 'categories';

export interface RepositoryConfig<T extends { id: number }, P> {
  entity: Entity;
  store: StoreName;
  /** Message d'erreur quand l'élément n'existe pas en local. */
  notFound: string;

  /** Le service HTTP existant (getAll / create / update / delete). */
  remote: {
    getAll(): Promise<T[]>;
    create(payload: P): Promise<T>;
    update(id: number, payload: P): Promise<T>;
    delete(id: number): Promise<void>;
  };

  /** Enregistrement local → corps de requête (création ET mise à jour). */
  toPayload(record: T): P;

  /** Remet les données du serveur au format local (nombres, bookId / book_id…). */
  normalize?: (record: T) => T;
  /** Ordre d'affichage des listes locales (tri, dédoublonnage…). */
  arrange?: (items: T[]) => T[];
  /** Appliqué à la liste fusionnée serveur + local (dédoublonnage). */
  finalize?: (items: T[]) => T[];
  /** Où placer les éléments créés hors-ligne dans la liste fusionnée. */
  pendingPosition?: 'start' | 'end';

  /** true si l'élément référence un parent encore temporaire : il doit attendre sa synchro. */
  dependsOnPending?: (record: T) => boolean;
  /** Synchros à lancer avant la nôtre (les parents, pour que leurs ids soient remappés). */
  syncFirst?: Array<() => Promise<void>>;

  /** Retrouve un équivalent déjà présent côté serveur (évite les doublons à la synchro). */
  matchOnServer?: (local: T, serverItems: T[]) => T | undefined;
  /** Dans la transaction du remplacement temp → serveur : remapper les enfants. */
  afterReplace?: (tx: RwTx, tempId: number, server: T) => Promise<void>;
  /** Dans la transaction de suppression : cascade locale. */
  beforeRemove?: (tx: RwTx, id: number) => Promise<void>;
  /** Si défini : un 409 à la suppression restaure l'élément et lève cette erreur. */
  deleteConflictMessage?: string;

  /** Chargement ciblé par parent (ex. les versions d'un chapitre) au lieu de tout télécharger. */
  byParent?: { index: string; fetch(parentId: number): Promise<T[]> };
}

/* -------------------------------------------------------------------------- */
/*  Fabrique                                                                   */
/* -------------------------------------------------------------------------- */

export function createOfflineRepository<T extends { id: number }, P>(cfg: RepositoryConfig<T, P>) {
  const normalize = cfg.normalize ?? ((x: T) => x);
  const arrange = cfg.arrange ?? ((x: T[]) => x);
  const blocked = (record: T): boolean => cfg.dependsOnPending?.(record) ?? false;
  const storeOf = (tx: RwTx) => (tx as any).objectStore(cfg.store);
  const db = (): Promise<any> => getDb();

  let syncPromise: Promise<void> | null = null;

  /** Appel serveur : jamais hors-ligne, jamais plus de 8 s d'attente. */
  async function net<R>(call: () => Promise<R>): Promise<R> {
    if (!isOnline()) throw new Error('Hors-ligne');
    return withTimeout(call());
  }

  /* ----------------------------- Lecture ----------------------------- */

  async function getLocal(): Promise<T[]> {
    return arrange(await (await db()).getAll(cfg.store));
  }

  async function byIndex(index: string, key: number): Promise<T[]> {
    return arrange(await (await db()).getAllFromIndex(cfg.store, index, Number(key)));
  }

  async function getById(id: number): Promise<T> {
    const record: T | undefined = await (await db()).get(cfg.store, id);
    if (!record) throw new Error(cfg.notFound);
    return record;
  }

  /** Local d'abord ; le réseau n'est tenté que s'il est disponible. */
  async function getAll(): Promise<T[]> {
    if (isOnline()) {
      try {
        await withTimeout(syncToServer());
        const server = await net(() => cfg.remote.getAll());
        if (Array.isArray(server)) {
          return await mergeServerSnapshot<T>(cfg.entity, server, {
            normalize,
            pendingPosition: cfg.pendingPosition,
            finalize: cfg.finalize,
          });
        }
      } catch (error) {
        console.warn(`Mode hors-ligne actif : ${cfg.entity} lus depuis le stockage local.`);
      }
    }
    return getLocal();
  }

  /** Comme getAll, mais ne télécharge que les éléments d'un parent (nécessite `byParent`). */
  async function getByParent(parentId: number): Promise<T[]> {
    const parent = cfg.byParent;
    if (!parent) throw new Error(`byParent n'est pas configuré pour ${cfg.entity}.`);

    if (isOnline() && !isTempId(parentId)) {
      try {
        await withTimeout(syncToServer());
        const server = await net(() => parent.fetch(parentId));
        if (Array.isArray(server)) {
          await mergeServerSnapshot<T>(cfg.entity, server, {
            normalize,
            finalize: cfg.finalize,
            scope: { index: parent.index, key: Number(parentId) },
          });
        }
      } catch (error) {
        console.warn(`Mode hors-ligne actif : ${cfg.entity} lus depuis le stockage local.`);
      }
    }
    return byIndex(parent.index, parentId);
  }

  /* ----------------------------- Écriture ---------------------------- */

  /** Remplace un élément temporaire par sa version serveur (et remappe les enfants). */
  async function replace(tempId: number, server: T): Promise<void> {
    const record = normalize(server);
    const tx = await rwTx();
    await storeOf(tx).delete(tempId);
    await storeOf(tx).put(record);
    await cfg.afterReplace?.(tx, tempId, record);
    await tx.done;
  }

  /**
   * Création : écriture locale immédiate, puis envoi au serveur si possible.
   * Renvoie l'élément final (serveur) ou l'élément temporaire (en attente).
   */
  async function insert(temp: T, opts: { persistLocal?: boolean } = {}): Promise<T> {
    if (opts.persistLocal !== false) await (await db()).put(cfg.store, temp);

    if (!blocked(temp)) {
      try {
        const created = await net(() => cfg.remote.create(cfg.toPayload(temp)));
        await replace(temp.id, created);
        return normalize(created);
      } catch (err) {
        console.log(`${cfg.entity} enregistré localement en attente de synchronisation.`);
      }
    }
    return temp;
  }

  /** Mise à jour : `change` reçoit l'élément courant et renvoie le nouvel élément. */
  async function patch(id: number, change: (current: T) => T): Promise<T> {
    const d = await db();
    const current: T | undefined = await d.get(cfg.store, id);
    if (!current) throw new Error(cfg.notFound);

    const updated = change(current);

    const tx = await rwTx();
    await storeOf(tx).put(updated);
    await queueOp(tx, cfg.entity, 'update', id); // ignoré pour les ids temporaires
    await tx.done;

    if (!isTempId(id) && !blocked(updated)) {
      try {
        const serverUpdated = normalize(await net(() => cfg.remote.update(id, cfg.toPayload(updated))));
        await d.put(cfg.store, serverUpdated);
        await clearOpsFor(cfg.entity, 'update', id);
        return serverUpdated;
      } catch (err: any) {
        console.log('Mise à jour enregistrée en local.', err?.response?.data ?? '');
      }
    }
    return updated;
  }

  /** true = supprimé aussi côté serveur (ou jamais connu du serveur), false = en attente. */
  async function remove(id: number): Promise<boolean> {
    const d = await db();
    const existing: T | undefined = await d.get(cfg.store, id);

    const tx = await rwTx();
    await cfg.beforeRemove?.(tx, id);
    await storeOf(tx).delete(id);
    await queueOp(tx, cfg.entity, 'delete', id); // ignoré pour les ids temporaires
    await tx.done;

    if (isTempId(id)) return true;

    try {
      await net(() => cfg.remote.delete(id));
      await clearOpsFor(cfg.entity, 'delete', id);
      return true;
    } catch (err) {
      const status = httpStatus(err);
      if (status === 409 && cfg.deleteConflictMessage) {
        await clearOpsFor(cfg.entity, 'delete', id);
        if (existing) await d.put(cfg.store, existing);
        throw new Error(cfg.deleteConflictMessage);
      }
      if (status === 404) {
        await clearOpsFor(cfg.entity, 'delete', id);
        return true;
      }
      console.log('Suppression enregistrée en local (serveur injoignable).');
      return false;
    }
  }

  /* --------------------------- Synchronisation ------------------------ */

  function syncToServer(): Promise<void> {
    if (syncPromise) return syncPromise;
    syncPromise = doSync().finally(() => {
      syncPromise = null;
    });
    return syncPromise;
  }

  async function doSync(): Promise<void> {
    if (!isOnline()) return;

    for (const syncParent of cfg.syncFirst ?? []) {
      try {
        await syncParent();
      } catch (e) {
        console.warn('Synchro d\'un parent ignorée temporairement.');
      }
    }

    const d = await db();

    // 1. suppressions en attente
    for (const op of await getOps(cfg.entity, 'delete')) {
      try {
        await net(() => cfg.remote.delete(op.entityId));
        await clearOp(op.key!);
      } catch (err) {
        const status = httpStatus(err);
        if (status === 404 || status === 409) await clearOp(op.key!);
        else if (isNetworkError(err)) return; // serveur injoignable : inutile d'insister
      }
    }

    // 2. mises à jour en attente
    for (const op of await getOps(cfg.entity, 'update')) {
      const local: T | undefined = await d.get(cfg.store, op.entityId);
      if (!local) {
        await clearOp(op.key!);
        continue;
      }
      if (blocked(local)) continue;

      try {
        const updated = normalize(await net(() => cfg.remote.update(local.id, cfg.toPayload(local))));
        await d.put(cfg.store, updated);
        await clearOp(op.key!);
      } catch (err) {
        if (httpStatus(err) === 404) await clearOp(op.key!);
        else if (isNetworkError(err)) return;
      }
    }

    // 3. créations en attente (ids temporaires)
    const pendingIds: number[] = (await d.getAll(cfg.store))
      .filter((r: T) => isTempId(r.id))
      .map((r: T) => r.id);
    if (pendingIds.length === 0) return;

    // la liste serveur n'est téléchargée que si l'on doit chercher des équivalents
    let serverItems: T[] = [];
    if (cfg.matchOnServer) {
      try {
        const res = await net(() => cfg.remote.getAll());
        if (!Array.isArray(res)) return;
        serverItems = res;
      } catch (err) {
        return;
      }
    }

    for (const tempId of pendingIds) {
      const local: T | undefined = await d.get(cfg.store, tempId); // relu : un remap a pu la modifier
      if (!local) continue;

      if (blocked(local)) {
        console.log(`${cfg.entity} ${tempId} en attente de la synchro de son parent.`);
        continue;
      }

      const existing = cfg.matchOnServer?.(local, serverItems);
      if (existing) {
        await replace(tempId, existing);
        continue;
      }

      try {
        const created = await net(() => cfg.remote.create(cfg.toPayload(local)));
        serverItems.push(created);
        await replace(tempId, created);
      } catch (err) {
        console.warn(`Échec de la synchro de ${cfg.entity} ${tempId}.`);
        if (isNetworkError(err)) return;
      }
    }
  }

  return {
    getLocal,
    byIndex,
    getById,
    getAll,
    getByParent,
    insert,
    patch,
    remove,
    syncToServer,
  };
}