import * as FileSystem from 'expo-file-system/legacy';
import { createScan, parseScans, type Scan, type ScreeningId, type SelectedImage } from './domain';

function root() {
  if (!FileSystem.documentDirectory) throw new Error('Device storage is unavailable.');
  return `${FileSystem.documentDirectory}mediedge/`;
}

async function prepare() {
  const directory = root();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export async function loadScans(): Promise<Scan[]> {
  const directory = await prepare();
  const file = `${directory}scans.json`;
  const info = await FileSystem.getInfoAsync(file);
  const backup = `${directory}scans.backup.json`;
  if (!info.exists) {
    // Recover if the app stopped between replacing the metadata files.
    if (!(await FileSystem.getInfoAsync(backup)).exists) return [];
    await FileSystem.copyAsync({ from: backup, to: file });
  }
  // iOS can relocate the app container after an update; rebuild local image paths.
  return parseScans(await FileSystem.readAsStringAsync(file)).map(scan => ({ ...scan, imageUri: `${directory}${scan.id}.jpg` }));
}

async function writeScans(scans: Scan[]) {
  const directory = await prepare();
  const target = `${directory}scans.json`;
  const temporary = `${directory}scans.next.json`;
  const backup = `${directory}scans.backup.json`;
  await FileSystem.writeAsStringAsync(temporary, JSON.stringify(scans));
  const hadPrevious = (await FileSystem.getInfoAsync(target)).exists;
  if (hadPrevious) await FileSystem.copyAsync({ from: target, to: backup });
  try { await FileSystem.moveAsync({ from: temporary, to: target }); }
  catch (error) {
    if (hadPrevious) await FileSystem.copyAsync({ from: backup, to: target });
    throw error;
  }
  await FileSystem.deleteAsync(backup, { idempotent: true }).catch(() => {});
}

export async function saveScan(id: ScreeningId, image: SelectedImage): Promise<Scan> {
  const existing = await loadScans();
  const scan = createScan(id, image);
  const destination = `${root()}${scan.id}.jpg`;
  // The picker supplies a normalized JPEG; copy it out of the temporary cache.
  await FileSystem.copyAsync({ from: image.uri, to: destination });
  scan.imageUri = destination;
  try { await writeScans([scan, ...existing]); }
  catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw error;
  }
  return scan;
}

export async function deleteScan(id: string): Promise<void> {
  const existing = await loadScans();
  const scan = existing.find(item => item.id === id);
  if (!scan) return;
  // Derive paths from validated IDs, never from user-controlled metadata URIs.
  await FileSystem.deleteAsync(`${root()}${scan.id}.jpg`, { idempotent: true });
  await writeScans(existing.filter(item => item.id !== id));
}

export async function clearScans(): Promise<void> {
  await FileSystem.deleteAsync(root(), { idempotent: true });
}
