import type { ScreeningId, SelectedImage } from './domain';

export type ModelOutput = { label: string; confidence: number; modelVersion: string };
export interface LocalModelAdapter {
  screeningId: ScreeningId;
  version: string;
  inputDescription: string;
  // Implement preprocessing and inference here with a bundled on-device runtime.
  analyze(image: SelectedImage): Promise<ModelOutput>;
}

// Intentionally empty: never substitute simulated predictions for missing models.
const adapters: Partial<Record<ScreeningId, LocalModelAdapter>> = {};

export function getModel(id: ScreeningId): LocalModelAdapter | undefined {
  return adapters[id];
}

export async function analyzeLocally(id: ScreeningId, image: SelectedImage): Promise<ModelOutput> {
  const adapter = getModel(id);
  if (!adapter) throw new Error('This model has not been added yet. No analysis was performed.');
  return adapter.analyze(image);
}
