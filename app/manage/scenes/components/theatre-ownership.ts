/**
 * Theatre projects and sheets are process-wide singletons keyed by id, so two
 * editor sessions of the same scene (React Strict Mode, a refetch, reopening
 * the editor) would share objects. Setup is serialized per project id and the
 * most recently started session owns the sheet: only the owner may detach
 * objects, so a stale session can never tear down the live one.
 */
const chains = new Map<string, Promise<void>>();
const owners = new Map<string, symbol>();

/** Run `setup` after every earlier setup for `projectId` settled; the run claims ownership first. */
export function runExclusive<T>(projectId: string, setup: (owner: symbol) => Promise<T>): Promise<T> {
  const previous = chains.get(projectId) ?? Promise.resolve();
  const owner = Symbol(projectId);
  const run = previous.then(() => {
    owners.set(projectId, owner);
    return setup(owner);
  });
  chains.set(projectId, run.then(() => undefined, () => undefined));
  return run;
}

export function isOwner(projectId: string, owner: symbol) {
  return owners.get(projectId) === owner;
}

/** Give up ownership; true only for the current owner, which may then clean the sheet. */
export function release(projectId: string, owner: symbol) {
  if (!isOwner(projectId, owner)) return false;
  owners.delete(projectId);
  return true;
}
