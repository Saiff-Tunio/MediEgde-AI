import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, BackHandler, Image, Linking, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Icon, type IconName } from './src/Icon';
import { screenings, screeningFor, type Scan, type ScreeningId, type SelectedImage } from './src/domain';
import * as storage from './src/storage';

type Tab = 'home' | 'scan' | 'history' | 'settings';
type Dialog = { title: string; message: string; action?: () => Promise<void>; actionLabel?: string; destructive?: boolean };
const C = { ink: '#152F40', muted: '#6D7E89', teal: '#117E79', mint: '#C3F3DD', line: '#E4EBEF', bg: '#F4F7FA', white: '#FFFFFF' };

function Button({ label, onPress, icon, secondary = false, disabled = false, loading = false }: {
  label: string; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean; loading?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondaryButton, (disabled || loading) && s.disabledButton, pressed && s.pressed]}>
    {loading ? <ActivityIndicator color={secondary ? C.teal : C.white} /> : icon && <Icon name={icon} color={secondary ? C.teal : C.white} size={20} />}
    <Text style={[s.buttonText, secondary && { color: C.teal }]}>{label}</Text>
  </Pressable>;
}

function Tag({ children, green = false }: { children: React.ReactNode; green?: boolean }) {
  return <View style={[s.tag, green && { backgroundColor: '#E5F5ED' }]}><Text style={[s.tagText, green && { color: '#23724E' }]}>{children}</Text></View>;
}

function Section({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={s.sectionHeading}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}><Text style={s.textLink}>{action}</Text></Pressable>}</View>;
}

function Empty({ title, body, icon = 'history' }: { title: string; body: string; icon?: IconName }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name={icon} size={28} color={C.teal} /></View><Text style={s.cardTitle}>{title}</Text><Text style={[s.body, { textAlign: 'center', maxWidth: 290 }]}>{body}</Text></View>;
}

function ScanRow({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  const category = screeningFor(scan.screeningId);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${category.title} scan from ${new Date(scan.createdAt).toLocaleDateString()}`} onPress={onPress} style={({ pressed }) => [s.scanRow, pressed && s.pressed]}>
    <Image source={{ uri: scan.imageUri }} style={s.thumbnail} accessibilityLabel="Saved medical image" />
    <View style={{ flex: 1, gap: 5 }}><Text style={s.cardTitle}>{category.title}</Text><Text style={s.small}>{new Date(scan.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Awaiting model</Text></View>
    <Icon name="arrow" size={18} color={C.muted} />
  </Pressable>;
}

export default function App() {
  return <SafeAreaProvider><MediEdge /></SafeAreaProvider>;
}

function MediEdge() {
  const [tab, setTab] = useState<Tab>('home');
  const [category, setCategory] = useState<ScreeningId>('brain');
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [detail, setDetail] = useState<Scan | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ScreeningId | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [privacyCover, setPrivacyCover] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const selected = screeningFor(category);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setScans(await storage.loadScans()); setStorageError(null); }
    catch (error) { setStorageError(error instanceof Error ? error.message : 'Unable to open device storage.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setPrivacyCover(state !== 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (detail) { setDetail(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [busy, detail, tab]);

  function navigate(next: Tab) {
    if (operation.current) return;
    setDetail(null); setTab(next); scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function startScan(id?: ScreeningId) {
    if (id && id !== category) setImage(null);
    if (id) setCategory(id);
    navigate('scan');
  }
  function openDetail(scan: Scan) {
    setTab('history'); setDetail(scan);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function showError(error: unknown) {
    setDialog({ title: 'Something needs attention', message: error instanceof Error ? error.message : 'Please try again.' });
  }

  async function pickImage(camera: boolean) {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setDialog({ title: 'Camera access is off', message: permission.canAskAgain ? 'Allow camera access when prompted, or choose an image from your gallery.' : 'Enable camera access in your phone settings, or choose an image from your gallery.',
            ...(Platform.OS !== 'web' && !permission.canAskAgain ? { actionLabel: 'Open settings', action: async () => { await Linking.openSettings(); } } : {}) });
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.width || !asset.height) throw new Error('This image could not be opened. Choose a JPEG or PNG image.');
      if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) throw new Error('Choose an image smaller than 25 MB.');
      // Normalize format without cropping or resizing medical content. Model-specific preprocessing belongs in the adapter.
      const normalized = await manipulateAsync(asset.uri, [], { format: SaveFormat.JPEG, compress: 1, base64: Platform.OS === 'web' });
      setImage({ uri: Platform.OS === 'web' && normalized.base64 ? `data:image/jpeg;base64,${normalized.base64}` : normalized.uri, width: normalized.width, height: normalized.height });
    } catch (error) { showError(error); }
    finally { operation.current = false; setBusy(false); }
  }

  async function save() {
    if (!image || operation.current || storageError) return;
    operation.current = true; setBusy(true);
    try {
      const scan = await storage.saveScan(category, image);
      setScans(previous => [scan, ...previous]); setImage(null); setTab('history'); setDetail(scan);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (error) { showError(error); }
    finally { operation.current = false; setBusy(false); }
  }

  function confirmDelete(scan?: Scan) {
    setDialog({ title: scan ? 'Delete this scan?' : 'Delete all saved scans?', message: 'This removes the app’s saved images and records from this device. Original images in your gallery are not affected. This cannot be undone.',
      actionLabel: scan ? 'Delete scan' : 'Delete all scans', destructive: true, action: async () => {
        if (scan) await storage.deleteScan(scan.id); else await storage.clearScans();
        setDetail(null); await refresh();
      } });
  }

  const visibleScans = scans.filter(scan => (filter === 'all' || scan.screeningId === filter) && screeningFor(scan.screeningId).title.toLowerCase().includes(query.trim().toLowerCase()));

  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
    <StatusBar style="dark" />
    <View style={s.header}><View style={s.headerInner}>
      <Pressable accessibilityRole="button" accessibilityLabel="MediEdge home" onPress={() => navigate('home')} style={s.brand}>
        <View style={s.logo}><Icon name="plus" size={27} color={C.white} /></View>
        <View><Text style={s.brandName}>MediEdge<Text style={{ color: C.teal }}> AI</Text></Text><Text style={s.brandCaption}>CARE BEYOND CONNECTION</Text></View>
      </Pressable>
      <View style={s.localPill} accessibilityLabel="On-device storage"><View style={s.dot} />{width >= 360 && <Text style={s.localText}>On-device</Text>}</View>
    </View></View>

    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[s.content, wide && { paddingHorizontal: 36 }]} keyboardShouldPersistTaps="handled">
      {storageError && <View style={s.warning}><Text style={s.cardTitle}>Local storage needs attention</Text><Text style={s.body}>{storageError}</Text><Button label="Try again" secondary onPress={() => void refresh()} /></View>}

      {detail ? <>
        <Pressable accessibilityRole="button" onPress={() => setDetail(null)} style={s.back}><Icon name="back" size={20} /><Text style={s.textLink}>Back to history</Text></Pressable>
        <View style={s.pageHeading}><Text style={s.eyebrow}>SAVED ON THIS DEVICE</Text><Text style={s.title}>{screeningFor(detail.screeningId).title}</Text><Text style={s.body}>{new Date(detail.createdAt).toLocaleString()}</Text></View>
        <View style={s.preview}><Image source={{ uri: detail.imageUri }} style={s.previewImage} resizeMode="contain" accessibilityLabel="Saved scan preview" /></View>
        <View style={s.card}><View style={s.inline}><View style={s.iconTile}><Icon name="chip" color={C.teal} /></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>Awaiting model</Text><Text style={s.body}>Image saved. No analysis performed.</Text></View></View><View style={s.divider} /><Text style={s.body}>The {screeningFor(detail.screeningId).title.toLowerCase()} model has not been added yet. Results and confidence scores will be available after model integration.</Text><View style={s.metaRow}><Text style={s.small}>Image dimensions</Text><Text style={s.metaValue}>{detail.width} × {detail.height} px</Text></View></View>
        <Button label="New scan" icon="plus" onPress={() => startScan(detail.screeningId)} />
        <Pressable accessibilityRole="button" onPress={() => confirmDelete(detail)} style={s.deleteButton}><Icon name="trash" size={18} color="#B34D52" /><Text style={s.deleteText}>Delete saved scan</Text></Pressable>
      </> : tab === 'home' ? <>
        <View style={s.pageHeading}><Text style={s.eyebrow}>YOUR MOBILE IMAGING COMPANION</Text><Text style={s.title}>Care starts here.</Text><Text style={s.body}>One place for your medical images. All on your phone.</Text></View>
        <View style={s.hero}>
          <View style={s.heroRing} /><View style={s.heroRingSmall} />
          <View style={s.heroBadge}><Icon name="shield" size={14} color={C.mint} /><Text style={s.heroBadgeText}>BUILT FOR OFFLINE CARE</Text></View>
          <View style={s.heroBody}><View style={{ flex: 1, gap: 12 }}><Text style={s.heroTitle}>Small device.{ '\n' }Greater possibilities.</Text><Text style={s.heroDescription}>Prepare your scans today.{ '\n' }On-device AI is the next step.</Text></View><View style={s.heroGraphic}><Icon name="scan" size={68} color={C.mint} /><View style={s.graphicCross}><Icon name="plus" size={21} color={C.ink} /></View></View></View>
          <Pressable accessibilityRole="button" onPress={() => startScan()} style={({ pressed }) => [s.heroButton, pressed && s.pressed]}><Text style={s.heroButtonText}>Start a new scan</Text><Icon name="arrow" color={C.ink} size={20} /></Pressable>
        </View>
        <View style={s.stats}><View style={s.stat}><Text style={s.statNumber}>04</Text><Text style={s.small}>Screening categories</Text></View><View style={s.statDivider} /><View style={s.stat}><Text style={s.statNumber}>{String(scans.length).padStart(2, '0')}</Text><Text style={s.small}>Saved scans</Text></View><View style={s.statDivider} /><View style={s.stat}><Icon name="shield" size={25} color={C.teal} /><Text style={s.small}>Local storage</Text></View></View>
        <Section title="Choose a screening" />
        <Text style={[s.body, { marginTop: -9 }]}>Select the type of image you want to review.</Text>
        <View style={s.categoryGrid}>{screenings.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => startScan(item.id)} style={({ pressed }) => [s.categoryCard, wide && { flexBasis: '23%' }, pressed && s.pressed]}>
          <View style={s.categoryTop}><View style={[s.categoryIcon, { backgroundColor: item.tint }]}><Icon name={item.icon} size={30} color={item.color} /></View><Icon name="arrow" size={17} color="#9BA8AF" /></View>
          <Text style={s.categoryTitle}>{item.title}</Text><Text style={s.small}>{item.modality}</Text><View style={s.categoryFooter}><View style={s.pendingDot} /><Text style={s.pendingText}>Model coming later</Text></View>
        </Pressable>)}</View>
        <View style={s.privacyNote}><Icon name="shield" size={23} color={C.teal} /><View style={{ flex: 1, gap: 3 }}><Text style={s.noteTitle}>Your images stay with you</Text><Text style={s.small}>No account. No image uploads. No cloud processing.</Text></View></View>
        <Section title="Recent scans" action="View all" onPress={() => navigate('history')} />
        <View style={s.card}>{loading ? <ActivityIndicator color={C.teal} style={{ padding: 25 }} /> : scans.length ? scans.slice(0, 3).map(scan => <ScanRow key={scan.id} scan={scan} onPress={() => openDetail(scan)} />) : <Empty title="A fresh start" body="Your saved scans will appear here. Choose a screening to add your first image." />}</View>
        <Text style={s.footnote}>FYP research prototype · Models not yet connected</Text>
      </> : tab === 'scan' ? <>
        <View style={s.pageHeading}><Text style={s.eyebrow}>A SIMPLE, GUIDED WORKFLOW</Text><Text style={s.title}>New scan</Text><Text style={s.body}>Choose a category, then add your medical image.</Text></View>
        <View style={s.steps}>{['Select', 'Add image', 'Save'].map((label, index) => <View key={label} style={s.step}><View style={[s.stepNumber, (index === 0 || (image && index === 1)) && s.stepActive]}>{index === 0 ? <Icon name="check" size={14} color={C.white} /> : <Text style={[s.stepText, image && index === 1 && { color: C.white }]}>{index + 1}</Text>}</View><Text style={s.small}>{label}</Text>{index < 2 && <View style={s.stepLine} />}</View>)}</View>
        <Section title="01  Screening category" />
        <View style={s.selectorGrid}>{screenings.map(item => <Pressable key={item.id} disabled={busy} accessibilityRole="radio" aria-checked={category === item.id} accessibilityState={{ checked: category === item.id, disabled: busy }} onPress={() => { setCategory(item.id); setImage(null); }} style={[s.selector, category === item.id && s.selectorActive]}><Icon name={item.icon} color={category === item.id ? C.teal : C.muted} size={23} /><Text style={[s.selectorText, category === item.id && { color: C.teal }]}>{item.title}</Text>{category === item.id && <Icon name="check" size={15} color={C.teal} />}</Pressable>)}</View>
        <Section title="02  Medical image" />
        <View style={s.imageHint}><Text style={s.cardTitle}>{selected.modality}</Text><Text style={s.body}>Use a clear image of the full scan. Image requirements will be finalized with the model.</Text></View>
        {image ? <View style={s.preview}><Image source={{ uri: image.uri }} style={s.previewImage} resizeMode="contain" accessibilityLabel="Selected medical image preview" /><View style={s.previewFooter}><Text style={{ color: '#CAD8E0', fontSize: 12 }}>{image.width} × {image.height} px · Ready to save</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Remove selected image" onPress={() => setImage(null)} hitSlop={12}><Icon name="close" color={C.white} size={20} /></Pressable></View></View> : <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Choose medical image from gallery" onPress={() => void pickImage(false)} style={({ pressed }) => [s.uploadArea, pressed && s.pressed]}><View style={s.uploadIcon}><Icon name="image" size={34} color={C.teal} /></View><Text style={s.cardTitle}>Add your medical image</Text><Text style={[s.body, { textAlign: 'center' }]}>Choose an image from your gallery{ '\n' }or capture one with your camera.</Text><Text style={s.small}>JPEG or PNG · Up to 25 MB · No DICOM support</Text></Pressable>}
        <View style={s.inputButtons}><View style={{ flex: 1 }}><Button label={image ? 'Replace image' : 'Gallery'} icon="image" secondary disabled={busy} onPress={() => void pickImage(false)} /></View><View style={{ flex: 1 }}><Button label="Camera" icon="camera" secondary disabled={busy} onPress={() => void pickImage(true)} /></View></View>
        {busy && <ActivityIndicator color={C.teal} accessibilityLabel="Processing image" />}
        <View style={s.modelNotice}><Icon name="chip" color="#997336" size={24} /><View style={{ flex: 1, gap: 4 }}><Text style={s.noteTitle}>Model not connected yet</Text><Text style={s.body}>You can save and review this image. Detection, confidence scores, and visual explanations will be added with your models.</Text></View></View>
        <Button label="Save scan on device" icon="plus" disabled={!image || busy || loading || !!storageError} loading={busy} onPress={() => void save()} />
        <Text style={s.footnote}>Saving an image does not perform a medical analysis.</Text>
      </> : tab === 'history' ? <>
        <View style={s.pageHeading}><Text style={s.eyebrow}>YOUR ON-DEVICE LIBRARY</Text><Text style={s.title}>Scan history</Text><Text style={s.body}>Review the images you have saved on this device.</Text></View>
        <View style={s.search}><Icon name="search" size={20} color={C.muted} /><TextInput accessibilityLabel="Search scans by screening category" placeholder="Search by screening category" placeholderTextColor={C.muted} value={query} onChangeText={setQuery} style={s.searchInput} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Pressable accessibilityRole="button" aria-selected={filter === 'all'} accessibilityState={{ selected: filter === 'all' }} onPress={() => setFilter('all')} style={[s.filter, filter === 'all' && s.filterActive]}><Text style={[s.filterText, filter === 'all' && { color: C.white }]}>All scans</Text></Pressable>{screenings.map(item => <Pressable key={item.id} accessibilityRole="button" aria-selected={filter === item.id} accessibilityState={{ selected: filter === item.id }} onPress={() => setFilter(item.id)} style={[s.filter, filter === item.id && s.filterActive]}><Text style={[s.filterText, filter === item.id && { color: C.white }]}>{item.title}</Text></Pressable>)}</ScrollView>
        <Section title={`${visibleScans.length} saved ${visibleScans.length === 1 ? 'scan' : 'scans'}`} />
        <View style={s.card}>{loading ? <ActivityIndicator color={C.teal} style={{ padding: 40 }} /> : visibleScans.length ? visibleScans.map(scan => <ScanRow key={scan.id} scan={scan} onPress={() => openDetail(scan)} />) : <Empty title={scans.length ? 'No matching scans' : 'Your history starts here'} body={scans.length ? 'Try another category or search term.' : 'Add a medical image and save it to build your local library.'} />}</View>
        <Button label="Add a new scan" icon="plus" onPress={() => startScan()} />
        <View style={s.privacyNote}><Icon name="shield" size={23} color={C.teal} /><Text style={[s.small, { flex: 1 }]}>Saved images stay in this app’s local storage. Deleting the app may delete your scans.</Text></View>
      </> : <>
        <View style={s.pageHeading}><Text style={s.eyebrow}>MADE TO WORK ON YOUR PHONE</Text><Text style={s.title}>Settings & models</Text><Text style={s.body}>Your app, your data, your device.</Text></View>
        <View style={s.card}><View style={s.inline}><View style={s.iconTile}><Icon name="shield" color={C.teal} /></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>Local by design</Text><Text style={s.body}>No sign-in or backend required</Text></View><Tag green>LOCAL</Tag></View><View style={s.divider} /><Text style={s.body}>This app does not upload your images or use a cloud analysis service. Saved scans are stored on this device.</Text>{Platform.OS === 'web' && <Text style={s.small}>Browser preview: images use browser storage, which has limited capacity. Use the native app for the intended mobile experience.</Text>}</View>
        <Section title="Model library" />
        <Text style={[s.body, { marginTop: -8 }]}>Four categories. A dedicated model for each.</Text>
        <View style={s.card}>{screenings.map(item => <View key={item.id} style={s.modelRow}><View style={[s.categoryIcon, { backgroundColor: item.tint, width: 44, height: 44 }]}><Icon name={item.icon} color={item.color} size={24} /></View><View style={{ flex: 1, gap: 3 }}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.small}>{item.modality}</Text></View><Tag>Not added</Tag></View>)}</View>
        <View style={s.modelNotice}><Icon name="info" size={22} color="#997336" /><Text style={[s.body, { flex: 1 }]}>Models will be bundled into a future app build. No model downloads are needed in this version.</Text></View>
        <Section title="Device storage" />
        <View style={s.card}><View style={s.metaRow}><Text style={s.cardTitle}>Saved scans</Text><Text style={s.metaValue}>{scans.length}</Text></View><Text style={s.body}>Remove the images and history stored by this app.</Text><Pressable disabled={busy || (!scans.length && !storageError)} accessibilityRole="button" accessibilityState={{ disabled: busy || (!scans.length && !storageError) }} onPress={() => confirmDelete()} style={[s.deleteButton, !scans.length && !storageError && { opacity: 0.4 }]}><Icon name="trash" size={18} color="#B34D52" /><Text style={s.deleteText}>Delete all saved scans</Text></Pressable></View>
        <Section title="About MediEdge AI" />
        <View style={s.card}><Text style={s.cardTitle}>An offline edge AI research project</Text><Text style={s.body}>Built for a final year project at Aror University, Sukkur. This version provides the mobile workflow; disease detection models will be integrated separately.</Text><View style={s.divider} /><Text style={s.small}>Research prototype only. No diagnosis is provided. Medical images and any future results require review by a qualified healthcare professional.</Text><View style={s.metaRow}><Text style={s.small}>App version</Text><Text style={s.metaValue}>1.0.0 · Prototype</Text></View></View>
      </>}
      <View style={{ height: 12 }} />
    </ScrollView>

    <SafeAreaView edges={['bottom']} style={s.navSafe}><View style={s.nav}>{([
      { id: 'home', label: 'Home', icon: 'home' }, { id: 'scan', label: 'New scan', icon: 'scan' },
      { id: 'history', label: 'History', icon: 'history' }, { id: 'settings', label: 'Settings', icon: 'settings' },
    ] as { id: Tab; label: string; icon: IconName }[]).map(item => <Pressable key={item.id} accessibilityRole="tab" aria-selected={tab === item.id} accessibilityState={{ selected: tab === item.id, disabled: busy }} disabled={busy} onPress={() => navigate(item.id)} style={s.navItem}><View style={[s.navIcon, tab === item.id && s.navIconActive]}><Icon name={item.icon} color={tab === item.id ? C.teal : '#82909A'} size={23} /></View><Text style={[s.navLabel, tab === item.id && { color: C.teal, fontWeight: '700' }]}>{item.label}</Text></Pressable>)}</View></SafeAreaView>

    <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => { if (!busy) setDialog(null); }}><View style={s.modalBackdrop}><View style={s.modalCard} accessibilityViewIsModal><View style={[s.emptyIcon, dialog?.destructive && { backgroundColor: '#FBEDEE' }]}><Icon name={dialog?.destructive ? 'trash' : 'info'} size={28} color={dialog?.destructive ? '#B34D52' : C.teal} /></View><Text style={s.sectionTitle}>{dialog?.title}</Text><Text style={s.body}>{dialog?.message}</Text>{dialog?.action && <Button label={dialog.actionLabel ?? 'Continue'} loading={busy} onPress={() => {
      if (operation.current) return;
      const action = dialog.action!;
      operation.current = true; setBusy(true);
      void action().then(() => setDialog(null)).catch(showError).finally(() => { operation.current = false; setBusy(false); });
    }} />}<Button label={dialog?.action ? 'Cancel' : 'Got it'} secondary disabled={busy} onPress={() => setDialog(null)} /></View></View></Modal>
    {privacyCover && <View style={s.privacyCover}><View style={s.logo}><Icon name="plus" size={28} color={C.white} /></View><Text style={s.brandName}>MediEdge AI</Text><Text style={s.body}>Your images stay with you.</Text></View>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  headerInner: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.7 }, brandCaption: { fontSize: 8, fontWeight: '700', color: C.muted, letterSpacing: 1.25, marginTop: 3 },
  localPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EAF6F0', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 30 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#378863' }, localText: { fontSize: 10, color: '#337A59', fontWeight: '600' },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 22, gap: 17, paddingBottom: 28 },
  pageHeading: { gap: 8, paddingTop: 8, paddingBottom: 3 }, eyebrow: { color: C.teal, fontWeight: '700', fontSize: 10, letterSpacing: 1.7 }, title: { color: C.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.1 },
  body: { color: C.muted, fontSize: 13, lineHeight: 21 }, small: { color: C.muted, fontSize: 11, lineHeight: 17 },
  hero: { backgroundColor: '#153B4A', borderRadius: 23, padding: 23, gap: 21, overflow: 'hidden' },
  heroRing: { position: 'absolute', width: 260, height: 260, borderRadius: 150, borderWidth: 1, borderColor: '#305866', right: -130, top: -65 },
  heroRingSmall: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: '#305866', right: -100, top: -35 },
  heroBadge: { flexDirection: 'row', gap: 7, alignItems: 'center' }, heroBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: C.mint },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 5 }, heroTitle: { fontSize: 26, lineHeight: 33, fontWeight: '700', color: C.white, letterSpacing: -0.6 }, heroDescription: { color: '#BBD0D9', fontSize: 12, lineHeight: 20 },
  heroGraphic: { width: 77, height: 90, alignItems: 'center', justifyContent: 'center' }, graphicCross: { position: 'absolute', right: -5, bottom: 0, backgroundColor: C.mint, width: 32, height: 32, borderRadius: 11, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-10deg' }] },
  heroButton: { alignSelf: 'flex-start', borderRadius: 11, backgroundColor: C.mint, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, gap: 25 }, heroButtonText: { color: C.ink, fontSize: 13, fontWeight: '700' },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 18 }, stat: { flex: 1, alignItems: 'center', gap: 5 }, statNumber: { fontSize: 25, fontWeight: '700', color: C.ink }, statDivider: { width: 1, height: 30, backgroundColor: C.line },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 }, sectionTitle: { fontSize: 19, color: C.ink, fontWeight: '700', letterSpacing: -0.4 }, textLink: { fontSize: 12, color: C.teal, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, categoryCard: { flexGrow: 1, flexBasis: '46%', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 5 }, categoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  categoryIcon: { width: 49, height: 49, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, categoryTitle: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.3 }, categoryFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }, pendingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#96A1AA' }, pendingText: { color: '#81909B', fontSize: 9 },
  privacyNote: { backgroundColor: '#EAF4F1', borderRadius: 14, padding: 15, flexDirection: 'row', gap: 12, alignItems: 'center' }, noteTitle: { color: C.ink, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 17, gap: 12 }, cardTitle: { fontSize: 14, fontWeight: '700', color: C.ink }, empty: { paddingVertical: 20, alignItems: 'center', gap: 10 }, emptyIcon: { width: 56, height: 56, borderRadius: 19, backgroundColor: '#EBF4F3', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  footnote: { textAlign: 'center', color: '#85949E', fontSize: 10, lineHeight: 17 }, scanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }, thumbnail: { width: 49, height: 55, backgroundColor: '#E2E9ED', borderRadius: 9 },
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 13, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, secondaryButton: { backgroundColor: C.white, borderWidth: 1, borderColor: '#CDDCDb' }, buttonText: { fontSize: 13, fontWeight: '700', color: C.white }, disabledButton: { opacity: 0.45 }, pressed: { opacity: 0.72 },
  steps: { flexDirection: 'row', paddingVertical: 12, gap: 9 }, step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, stepNumber: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#E3E9ED', alignItems: 'center', justifyContent: 'center' }, stepActive: { backgroundColor: C.teal }, stepText: { fontSize: 10, fontWeight: '700', color: C.muted }, stepLine: { height: 1, backgroundColor: '#CFDADD', flex: 1 },
  selectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, selector: { flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, minHeight: 56 }, selectorActive: { borderColor: C.teal, backgroundColor: '#EAF5F2' }, selectorText: { fontSize: 12, fontWeight: '600', color: C.muted, flex: 1 },
  imageHint: { gap: 5 }, uploadArea: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B4CECC', backgroundColor: '#F0F7F5', borderRadius: 19, paddingHorizontal: 15, paddingVertical: 30, gap: 13, alignItems: 'center', justifyContent: 'center' }, uploadIcon: { width: 65, height: 65, borderRadius: 20, backgroundColor: '#DDEDE8', alignItems: 'center', justifyContent: 'center' }, inputButtons: { flexDirection: 'row', gap: 12 },
  modelNotice: { backgroundColor: '#FCF5E8', padding: 16, borderRadius: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, preview: { backgroundColor: '#152B39', borderRadius: 18, overflow: 'hidden' }, previewImage: { width: '100%', height: 310 }, previewFooter: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchInput: { color: C.ink, flex: 1, paddingVertical: 15, fontSize: 13, minWidth: 0 }, filter: { backgroundColor: '#E9EEF1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 30 }, filterActive: { backgroundColor: C.teal }, filterText: { fontSize: 11, fontWeight: '600', color: C.muted },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 11 }, iconTile: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#E8F3F0', alignItems: 'center', justifyContent: 'center' }, divider: { height: 1, backgroundColor: C.line, marginVertical: 2 }, metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 5 }, metaValue: { fontSize: 12, color: C.ink, fontWeight: '600' }, modelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }, tag: { backgroundColor: '#EFF2F4', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }, tagText: { fontSize: 9, color: C.muted, fontWeight: '600' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 13, minHeight: 44 }, deleteText: { color: '#B34D52', fontSize: 12, fontWeight: '600' }, back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, warning: { borderWidth: 1, borderColor: '#E3C59A', borderRadius: 15, padding: 16, gap: 10, backgroundColor: '#FFF8EB' },
  navSafe: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line }, nav: { flexDirection: 'row', maxWidth: 750, width: '100%', alignSelf: 'center', paddingTop: 8, paddingBottom: 10 }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { width: 54, height: 31, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: '#E7F3F0' }, navLabel: { fontSize: 10, color: '#82909A' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,35,47,0.55)', justifyContent: 'center', alignItems: 'center', padding: 25 }, modalCard: { backgroundColor: C.white, padding: 24, width: '100%', maxWidth: 410, borderRadius: 23, gap: 16 }, privacyCover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 15 },
});

