import { createScan, parseScans, type Scan, type ScreeningId, type SelectedImage } from './domain';

const key = 'mediedge.scans.v1';
export async function loadScans(): Promise<Scan[]> {
  return parseScans(localStorage.getItem(key) ?? '[]');
}
export async function saveScan(id: ScreeningId, image: SelectedImage): Promise<Scan> {
  const scans = await loadScans();
  const scan = createScan(id, image);
  // The web picker passes a data URI so images survive a page reload.
  try { localStorage.setItem(key, JSON.stringify([scan, ...scans])); }
  catch { throw new Error('Browser storage is full or unavailable. Remove saved scans or use the mobile app.'); }
  return scan;
}
export async function deleteScan(id: string): Promise<void> {
  localStorage.setItem(key, JSON.stringify((await loadScans()).filter(scan => scan.id !== id)));
}
export async function clearScans(): Promise<void> { localStorage.removeItem(key); }
