export type ScreeningId = 'brain' | 'bone' | 'lung' | 'breast';
export type Screening = {
  id: ScreeningId; title: string; subtitle: string; modality: string;
  color: string; tint: string; icon: 'brain' | 'bone' | 'lung' | 'breast';
};

// Input modalities must be confirmed against each model's training data before integration.
export const screenings: Screening[] = [
  { id: 'brain', title: 'Brain tumor', subtitle: 'Brain imaging', modality: 'MRI', color: '#7560CF', tint: '#EFEBFB', icon: 'brain' },
  { id: 'bone', title: 'Bone fracture', subtitle: 'Bone imaging', modality: 'X-ray', color: '#CC8835', tint: '#FFF2DF', icon: 'bone' },
  { id: 'lung', title: 'Lung cancer', subtitle: 'Lung imaging', modality: 'Chest X-ray', color: '#348BB4', tint: '#E5F3FA', icon: 'lung' },
  { id: 'breast', title: 'Breast cancer', subtitle: 'Breast imaging', modality: 'Mammogram', color: '#C26495', tint: '#FBEAF3', icon: 'breast' },
];

export type Scan = {
  id: string; screeningId: ScreeningId; imageUri: string; createdAt: string;
  status: 'awaiting-model'; width: number; height: number;
};
export type SelectedImage = { uri: string; width: number; height: number };

export function screeningFor(id: ScreeningId): Screening {
  return screenings.find(s => s.id === id)!;
}

export function parseScans(raw: string): Scan[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(isScan)) {
    throw new Error('Saved scan data could not be read. Your images have not been deleted.');
  }
  return value;
}

function isScan(value: unknown): value is Scan {
  if (!value || typeof value !== 'object') return false;
  const scan = value as Record<string, unknown>;
  return typeof scan.id === 'string' && /^[a-z0-9-]+$/.test(scan.id)
    && screenings.some(s => s.id === scan.screeningId)
    && typeof scan.imageUri === 'string' && scan.imageUri.length > 0
    && typeof scan.createdAt === 'string' && Number.isFinite(Date.parse(scan.createdAt))
    && scan.status === 'awaiting-model'
    && typeof scan.width === 'number' && Number.isFinite(scan.width) && scan.width > 0
    && typeof scan.height === 'number' && Number.isFinite(scan.height) && scan.height > 0;
}

export function createScan(screeningId: ScreeningId, image: SelectedImage): Scan {
  if (!image.uri || image.width <= 0 || image.height <= 0 || !Number.isFinite(image.width + image.height)) {
    throw new Error('Choose a valid image before saving.');
  }
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    screeningId, imageUri: image.uri, createdAt: new Date().toISOString(),
    status: 'awaiting-model', width: image.width, height: image.height,
  };
}
