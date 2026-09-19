/**
 * Helper utilities for vehicle-related transaction detection and management
 */

export const DEFAULT_VEHICLE_CATEGORIES = [
  'Frete do Dia',
  'Pizzaria',
  'Uber',
  'Trabalho',
  'Manutenção',
  'Combustível',
  'Pedágio',
];

export function isVehicleRelatedCategory(
  category?: string | null,
  activeTab?: string | null,
  type?: 'income' | 'expense' | string | null,
  settings?: {
    vehicle_categories?: string[];
    operational_expense_categories?: string[];
    categories_with_km?: string[];
    income_categories?: string[];
  } | null
): boolean {
  // Pure savings / financial reserves (aportes) / investments never have a vehicle
  if (activeTab === 'investimento') return false;

  // Pizzaria deliveries and Day Freight are always vehicle-based operations
  if (activeTab === 'pizzaria' || activeTab === 'frete') return true;

  if (!category) return false;

  const catLower = category.toLowerCase().trim();
  const catNorm = catLower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. If user configured specific vehicle_categories in settings, check against it
  if (settings?.vehicle_categories && settings.vehicle_categories.length > 0) {
    const isConfigured = settings.vehicle_categories.some(c => {
      const cNorm = c.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return catNorm === cNorm || catNorm.includes(cNorm) || cNorm.includes(catNorm);
    });
    if (isConfigured) return true;
  }

  // 2. Default authorized list:
  // frete do dia, pizzaria, Uber, trabalho (opcional), manutenção, combustível, pedagio
  const vehicleAllowedKeywords = [
    'frete do dia',
    'frete',
    'pizzaria',
    'uber',
    'trabalho',
    'manutencao',
    'manutenção',
    'revisao',
    'oficina',
    'mecanico',
    'oleo',
    'óleo',
    'pneu',
    'pneus',
    'borracharia',
    'combustivel',
    'gasolina',
    'etanol',
    'abastecimento',
    'pedagio',
    'seguro',
    'ipva',
    'moto',
    'veiculo',
    'carro',
  ];

  if (vehicleAllowedKeywords.some(kw => catNorm.includes(kw) || kw.includes(catNorm))) {
    return true;
  }

  // 3. Check if explicitly configured in settings categories_with_km
  if (settings?.categories_with_km?.some(c => c.toLowerCase().trim() === catLower)) {
    return true;
  }

  return false;
}

/**
 * Checks if a category should NOT have an automatic default vehicle selected.
 * Specifically, 'Trabalho' is vehicle-related (user can pick a vehicle), but defaults to 'Nenhum Veículo' (empty).
 */
export function shouldDefaultToNoVehicle(category?: string | null): boolean {
  if (!category) return false;
  const catNorm = category
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return catNorm === 'trabalho' || catNorm.includes('trabalho');
}

