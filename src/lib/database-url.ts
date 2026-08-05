export function prismaPgAdapterConfig(databaseUrl: string) {
  const parsedUrl = new URL(databaseUrl);
  const schema = parsedUrl.searchParams.get("schema")?.trim();
  if (!schema) {
    return {
      poolConfig: { connectionString: databaseUrl },
      adapterOptions: undefined,
    };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(schema)) {
    throw new Error("The PostgreSQL schema must be a safe identifier.");
  }

  const existingOptions = parsedUrl.searchParams.get("options")?.trim();
  const searchPathOption = `-c search_path=${schema}`;
  parsedUrl.searchParams.set(
    "options",
    existingOptions
      ? `${existingOptions} ${searchPathOption}`
      : searchPathOption,
  );

  return {
    poolConfig: { connectionString: parsedUrl.toString() },
    adapterOptions: { schema },
  };
}
