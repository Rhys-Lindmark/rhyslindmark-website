// Keep the SQL interface used by the tested cap logic, backed by a private
// SQLite Durable Object rather than the account's exhausted D1 read allowance.
export function databaseFor(env) {
  if (!env.JEV_STATE) return env.JEV_DB || null; // injectable SQLite adapter in tests
  const stub = env.JEV_STATE.getByName('claim-check-production');
  return { prepare(sql) {
    return {
      first: () => stub.first(sql, []),
      bind: (...parameters) => ({
        first: () => stub.first(sql, parameters),
        run: () => stub.run(sql, parameters)
      })
    };
  }};
}
