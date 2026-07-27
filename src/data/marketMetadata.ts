export const marketMetadata = {
  source: 'Nasdaq historical API',
  retrievalDate: '2026-07-27',
  startDate: '2023-07-03',
  endDate: '2026-07-24',
  observations: 768,
  frequency: 'US trading days',
  field: 'Close/Last',
  adjustmentStatus: 'Nasdaq provides Close/Last. This project does not independently verify dividend-adjustment status.',
  cashMethod: 'CASH is a synthetic cash proxy using a fixed 4.30% annual rate converted to a daily return; it is not a traded price series.',
  useLimit: 'Frozen educational snapshot only. Review Nasdaq terms and obtain licensed data before commercial or production use.',
} as const
