// Stand-in for expo-router used only by the single-page web demo.
// Navigation is kept in memory instead of in the URL.
import { createContext, useContext } from 'react';

type Route = { name: 'tabs'; tab: string } | { name: 'exercise'; params: Record<string, string> };
type Nav = { push: (r: Route) => void; back: () => void; tab: (t: string) => void };

let nav: Nav | null = null;
export const setNav = (n: Nav) => {
  nav = n;
};
export const ParamsContext = createContext<Record<string, string>>({});

type Href = string | { pathname: string; params?: Record<string, string> };
const go = (href: Href) => {
  const path = typeof href === 'string' ? href : href.pathname;
  if (path.startsWith('/exercise')) nav?.push({ name: 'exercise', params: typeof href === 'string' ? {} : href.params ?? {} });
  else nav?.tab(path.replace('/', '') || 'index');
};

export const router = { push: go, navigate: go, replace: go, back: () => nav?.back() };
export function useLocalSearchParams<T>() {
  return useContext(ParamsContext) as T;
}
