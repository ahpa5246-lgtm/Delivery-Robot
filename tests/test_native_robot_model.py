"""The native model must reference retained licensed meshes and valid frame links."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
class NativeRobotModelTests(unittest.TestCase):
 def test_visual_cad_is_local_and_frame_connected(self):
  root=ET.parse(ROOT/'assets/robot/cdr01-lichtblick.urdf').getroot()
  links={e.attrib['name'] for e in root.findall('link')}
  self.assertIn('base_link',links)
  meshes=root.findall('.//mesh');self.assertGreaterEqual(len(meshes),3)
  for mesh in meshes:
   self.assertTrue((ROOT/'dashboard/assets/robot'/mesh.attrib['filename']).is_file())
   self.assertEqual(len(mesh.attrib['scale'].split()),3)
  for joint in root.findall('joint'):
   self.assertEqual(joint.attrib['type'],'fixed')
   self.assertIn(joint.find('parent').attrib['link'],links)
   self.assertIn(joint.find('child').attrib['link'],links)
