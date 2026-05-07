import fs from 'fs';
import path from 'path';
import { RotationState } from '../types';

const ROTATION_FILE = path.resolve(process.env.CACHE_DIR || './cache', 'rotation.json');

const defaults: RotationState = { schuttevaer: 0, nos: 0 };

let state: RotationState = { ...defaults };

export function loadRotation(): void {
  try {
    if (fs.existsSync(ROTATION_FILE)) {
      state = { ...defaults, ...JSON.parse(fs.readFileSync(ROTATION_FILE, 'utf-8')) };
    }
  } catch {
    state = { ...defaults };
  }
}

function save(): void {
  try {
    fs.writeFileSync(ROTATION_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[rotation] Failed to save:', err);
  }
}

export function getSlice(source: keyof RotationState, total: number, count = 4): number[] {
  if (total === 0) return [];
  const start = state[source] % total;
  const indices: number[] = [];
  for (let i = 0; i < count; i++) indices.push((start + i) % total);
  state[source] = (start + count) % total;
  save();
  return indices;
}

export function getRotationNumber(): number {
  return state.schuttevaer + state.nos;
}
