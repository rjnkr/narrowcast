import { NewsArticle } from '../types';
import { parseRss } from './rssParser';

const RSS_URL = 'https://www.schuttevaer.nl/nieuws/rss/';

export async function fetchSchuttevaer(): Promise<NewsArticle[]> {
  return parseRss(RSS_URL, 'schuttevaer', 20);
}
