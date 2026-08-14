/** Bloc `pagination` de l'API admin (même forme que le module `scenarios`). */
export function buildPagination(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function skipFor(page: number, limit: number): number {
  return (page - 1) * limit;
}
