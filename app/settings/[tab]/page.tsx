// /settings/<tab>: brand · products · competitors · marketplaces · queries · assistants · keys · run-defaults.
// The layout's client screen reads the segment; this page renders nothing.
const TABS = ['brand', 'products', 'competitors', 'marketplaces', 'queries', 'assistants', 'keys', 'run-defaults'];

export function generateStaticParams() {
  return TABS.map((tab) => ({ tab }));
}

export default function SettingsTabPage() {
  return null;
}
