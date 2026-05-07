export type SlideType =
  | 'weather'
  | 'buienradar'
  | 'news'
  | 'traffic'
  | 'iframe'
  | 'placeholder';

export interface WeatherDay {
  date: string;        // ISO date
  weekday: string;     // 'Maandag' etc.
  wmoCode: number;
  tempMax: number;
  tempMin: number;
  precipitation: number;
}

export interface WeatherData {
  city: string;
  days: WeatherDay[];
  fetchedAt: string;
}

export interface NewsArticle {
  id: string;
  source: 'schuttevaer' | 'bnr' | 'nos';
  title: string;
  summary: string;
  imageUrl?: string;
  articleUrl: string;
  publishedAt: string;
}

export interface TrafficJam {
  id: string;
  road: string;
  from: string;
  to: string;
  reason: string;
  causeType: string;   // 'congestion' | 'carriagewayClosed' | 'roadWorks' | ...
  lat: number;
  lon: number;
  coordinates: [number, number][];  // [[lat, lon], ...] for drawing on map
  distanceFromApeldoorn?: number;
}

export interface TrafficData {
  jams: TrafficJam[];
  fetchedAt: string;
}

export interface SlideDefinition {
  id: string;
  type: SlideType;
  label: string;
  // type-specific payloads
  weather?: WeatherData;
  article?: NewsArticle;
  traffic?: TrafficData;
  iframeUrl?: string;
  placeholderTitle?: string;
  placeholderIcon?: string;
}

export interface ContentResponse {
  slides: SlideDefinition[];
  rotation: number;
  generatedAt: string;
}

export interface StatusResponse {
  online: boolean;
  lastRefresh: string | null;
}

export interface Flitser {
  id: number;
  road: string;
  from: string;
  to: string;
  hm?: number;
  direction: string;
}

export interface FlitsData {
  flitsers: Flitser[];
  fetchedAt: string;
}

export interface SpitsMoment {
  time: string;
  expected: number;
  average: number;
}

export interface SpitsVerwachting {
  date: string;
  daypart: 'AM' | 'PM';
  severity: number;
  severityExplanation: string;
  content: string;
  moments: SpitsMoment[];
}

export interface SpitsData {
  predictions: SpitsVerwachting[];
  fetchedAt: string;
}

export interface CacheStore {
  weather: WeatherData | null;
  schuttevaer: NewsArticle[];
  nos: NewsArticle[];
  bnr: NewsArticle[];
  traffic: TrafficData | null;
  flitsers: FlitsData | null;
  spits: SpitsData | null;
  lastRefresh: string | null;
}

export interface RotationState {
  schuttevaer: number;
  nos: number;
}
