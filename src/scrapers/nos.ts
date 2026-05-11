import { NewsArticle } from '../types';
import { parseRss } from './rssParser';

const RSS_URL = 'https://feeds.nos.nl/nosnieuwsalgemeen';

export async function fetchNos(): Promise<NewsArticle[]> {
  return parseRss(RSS_URL, 'nos', 20);
}
