import {
  effectiveStaffSize,
  getDevice,
  getProfile,
  listDevices,
  listProfiles,
  pageSizeMm,
  type DeviceSpec,
  type Profile,
} from '@lily-on-eink/core';

export interface CustomSize {
  widthPx: number;
  heightPx: number;
  ppi: number;
}

export interface Settings {
  /** A preset id or 'custom'. */
  deviceId: string;
  custom: CustomSize;
  profileId: string;
  /** Change of the note size in steps, -3 to +3. */
  noteSizeDelta: number;
}

export const SETTINGS_KEY = 'lily-on-eink:settings:v1';
export const CUSTOM_ID = 'custom';
export const SIZE_LIMITS = { px: { min: 300, max: 4000 }, ppi: { min: 100, max: 600 } } as const;
export const NOTE_SIZE_RANGE = { min: -3, max: 3 } as const;

export const DEFAULT_SETTINGS: Settings = {
  deviceId: 'kobo-sage',
  custom: { widthPx: 1072, heightPx: 1448, ppi: 300 },
  profileId: 'generic',
  noteSizeDelta: 0,
};

const inRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** The custom size if all values are whole numbers within the limits; otherwise a message for the user. */
export function validateCustom(c: Partial<Record<keyof CustomSize, unknown>>): CustomSize | string {
  const { px, ppi } = SIZE_LIMITS;
  const range = (r: { min: number; max: number }) => `a whole number from ${String(r.min)} to ${String(r.max)}`;
  if (!inRange(c.widthPx, px.min, px.max)) return `Width must be ${range(px)}.`;
  if (!inRange(c.heightPx, px.min, px.max)) return `Height must be ${range(px)}.`;
  if (!inRange(c.ppi, ppi.min, ppi.max)) return `Pixel density must be ${range(ppi)}.`;
  return { widthPx: c.widthPx, heightPx: c.heightPx, ppi: c.ppi };
}

/** A device spec for a custom screen size. */
export function customDevice(c: CustomSize): DeviceSpec {
  return {
    id: CUSTOM_ID,
    name: `Custom ${String(c.widthPx)}×${String(c.heightPx)}`,
    widthPx: c.widthPx,
    heightPx: c.heightPx,
    ppi: c.ppi,
    safeAreaMm: { top: 0, right: 0, bottom: 0, left: 0 },
    staffSizeAdjust: 0,
    source: 'user',
  };
}

/** Takes whatever was stored and returns valid settings; every broken part falls back to its default. */
export function sanitize(raw: unknown): Settings {
  const r = asRecord(raw);
  const deviceId =
    typeof r.deviceId === 'string' && (r.deviceId === CUSTOM_ID || listDevices().some((d) => d.id === r.deviceId))
      ? r.deviceId
      : DEFAULT_SETTINGS.deviceId;
  const profileId =
    typeof r.profileId === 'string' && listProfiles().some((p) => p.id === r.profileId)
      ? r.profileId
      : DEFAULT_SETTINGS.profileId;
  const custom = validateCustom(asRecord(r.custom));
  const noteSizeDelta = inRange(r.noteSizeDelta, NOTE_SIZE_RANGE.min, NOTE_SIZE_RANGE.max) ? r.noteSizeDelta : 0;
  return {
    deviceId,
    custom: typeof custom === 'string' ? DEFAULT_SETTINGS.custom : custom,
    profileId,
    noteSizeDelta,
  };
}

/** Stored settings, or the defaults when nothing usable is stored or storage is not available. */
export function loadSettings(storage?: Pick<Storage, 'getItem'>): Settings {
  try {
    const text = (storage ?? localStorage).getItem(SETTINGS_KEY);
    return text === null ? DEFAULT_SETTINGS : sanitize(JSON.parse(text));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Stores the settings; does nothing when storage is not available. */
export function saveSettings(settings: Settings, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? localStorage).setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The app works without storage.
  }
}

export interface Resolved {
  device: DeviceSpec;
  profile: Profile;
  /** The staff size shown to the user: the default for device and music type plus the chosen change. */
  staffSize: number;
  /** Only set when the user changed the note size. */
  staffSizeOverride?: number;
  pageMm: { width: number; height: number };
}

/** All values derived from the settings, or undefined while a custom size is invalid. */
export function resolve(settings: Settings): Resolved | undefined {
  let device: DeviceSpec;
  if (settings.deviceId === CUSTOM_ID) {
    const custom = validateCustom(settings.custom);
    if (typeof custom === 'string') return undefined;
    device = customDevice(custom);
  } else {
    device = getDevice(settings.deviceId);
  }
  const profile = getProfile(settings.profileId);
  const staffSize = effectiveStaffSize(profile, device) + settings.noteSizeDelta;
  return {
    device,
    profile,
    staffSize,
    ...(settings.noteSizeDelta === 0 ? {} : { staffSizeOverride: staffSize }),
    pageMm: pageSizeMm(device),
  };
}
