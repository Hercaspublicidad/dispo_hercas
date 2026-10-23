import { catalog } from '../lib/catalog';
import CatalogClient from './ui/CatalogClient';
export const dynamic = 'force-dynamic';
export default function Page() { return <CatalogClient initial={catalog()} />; }