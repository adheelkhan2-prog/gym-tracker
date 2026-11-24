// Stand-in for expo-router used only by the single-page web demo.
// Navigation is kept in memory instead of in the URL.
import { createContext, useContext } from 'react';

export type Route =
  | { name: 'tabs'; tab: string }
  | { name: 'exercise'; params: Record<string, string> }
  | { name: 'complete'; params: Record<string, string> }
  | { name: 'workout'; params: Record<string, string> }
  | { name: 'programs'; params: Record<string, string> }
  | { name: 'builder'; params: Record<string, string> };
type Nav = { push: (r: Route) => void; replace: (r: Route) => void; back: () => void; tab: (t: string) => void };

let nav: Nav | null = null;
export const setNav = (n: Nav) => {
  nav = n;
};
export const ParamsContext = createContext<Record<string, string>>({});
export const FocusContext = createContext(true);

type Href = string | { pathname: string; params?: Record<string, string> };
const toRoute = (href: Href): Route => {
  const path = typeof href === 'string' ? href : href.pathname;
  const params = typeof href === 'string' ? {} : (href.params ?? {});
  if (path.startsWith('/exercise')) return { name: 'exercise', params };
  if (path.startsWith('/complete')) return { name: 'complete', params };
  if (path.startsWith('/workout')) return { name: 'workout', params };
  if (path.startsWith('/programs')) return { name: 'programs', params };
  if (path.startsWith('/builder')) return { name: 'builder', params };
  return { name: 'tabs', tab: path.replace('/', '') || 'index' };
};
const go = (href: Href) => {
  const r = toRoute(href);
  if (r.name === 'tabs') nav?.tab(r.tab);
  else nav?.push(r);
};

export const router = {
  push: go,
  navigate: go,
  replace: (href: Href) => nav?.replace(toRoute(href)),
  back: () => nav?.back(),
  dismissTo: () => nav?.tab('index'),
};
export function useLocalSearchParams<T>() {
  return useContext(ParamsContext) as T;
}
export function useIsFocused() {
  return useContext(FocusContext);
}
