import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('scan_catalog', Path(__file__).resolve().parents[1] / 'scripts' / 'scan_catalog.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)

class ScanCatalogTests(unittest.TestCase):
    def test_matches_provider_code_embedded_on_powerpoint_slide(self):
        item = dict(code='', city='', address='', text='Valla 12345 - Calle 20, disponible')
        record = dict(codigo_hercas='MV-CLO-001', codigo_proveedor='12345', ubicacion='Otra dirección', ciudad='Cali')
        self.assertEqual(scanner.match(item, [record])[0]['codigo'], 'MV-CLO-001')

    def test_available_by_inclusion_only_for_explicit_complete_list(self):
        self.assertEqual(scanner.inferred_status(None, True, '.pptx'), 'Disponible')
        self.assertIsNone(scanner.inferred_status(None, False, '.pptx'))
        self.assertIsNone(scanner.inferred_status(None, True, '.xlsx'))

    def test_unavailable_wording_overrides_inclusion(self):
        self.assertEqual(scanner.inferred_status(scanner.availability('Valla reservada'), True, '.pptx'), 'No disponible')
        self.assertEqual(scanner.availability('No disponibles'), 'No disponible')

if __name__ == '__main__':
    unittest.main()
