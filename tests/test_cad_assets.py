"""Offline API and provenance tests for locally served original CAD assets."""
import unittest
from pathlib import Path
from scripts.serve_dashboard import response_for

ROOT = Path(__file__).resolve().parents[1]

class ImportedGeometryTests(unittest.TestCase):
    def test_original_cad_parts_are_served_and_nonempty(self):
        for name in ('rbot-wheel.stl','rbot-camera.stl','delivery-cad-part.stl'):
            with self.subTest(mesh=name):
                status, media, data = response_for('/assets/robot/'+name)
                self.assertEqual(status, 200)
                self.assertEqual(media, 'model/stl')
                self.assertGreater(len(data), 30000)

    def test_architecture_and_original_materials(self):
        for name in ('clearpath-office.dae','warehouse-shelf.dae',
                     'warehouse-lamp.dae','warehouse-cargo.dae',
                     'warehouse-roof.dae','cafe-table.dae'):
            with self.subTest(model=name):
                status, media, content=response_for('/assets/world/'+name)
                self.assertEqual(status, 200)
                self.assertEqual(media,'model/vnd.collada+xml')
                self.assertIn(b'<COLLADA',content[:400])
        for photo in ('Maple.jpg','Wood_Floor_Dark.jpg'):
            status, media, content=response_for('/assets/world/'+photo)
            self.assertEqual(status,200)
            self.assertEqual(media,'image/jpeg')
            self.assertGreater(len(content),2000)

    def test_no_arbitrary_local_file_path(self):
        for path in ('/assets/../../README.md','/api/../README.md',
                     '/.git/config','/assets/world/unknown_file.dae'):
            with self.subTest(path=path):
                status,_,_ = response_for(path)
                self.assertEqual(status,404)

    def test_new_scripts_and_styles_are_served(self):
        for path in ('/vendor/STLLoader.js','/vendor/ColladaLoader.js',
                     '/cad-enhancement.js','/analytics.js'):
            status,media,body=response_for(path)
            self.assertEqual(status,200)
            self.assertIn('javascript',media)
            self.assertGreater(len(body),3000)
        status,media,body=response_for('/command-center.css')
        self.assertEqual(status,200)
        self.assertIn('text/css',media)
        self.assertIn(b'.insights',body)

    def test_documented_licenses_and_authorship(self):
        text=(ROOT/'dashboard/assets/SOURCES.md').read_text()
        for source in ('rlxai/rbot','Pouya-Mansournia/Delivery-Robot-ROS',
                       'clearpathrobotics/clearpath_simulator',
                       'ROBOTIS-GIT/turtlebot3_simulations',
                       'motomechatronics/aws_robomaker_small_warehouse_world'):
            self.assertIn(source,text)
        for p in ('rbot-nav2','pouya-sixwheel','clearpath-outdoor',
                  'turtlebot3','aws-warehouse'):
            self.assertTrue((ROOT/'integrations/upstream_samples'/p/'LICENSE').is_file())

if __name__ == '__main__':
    unittest.main()
