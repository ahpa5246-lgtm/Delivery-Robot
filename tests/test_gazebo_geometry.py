"""Static checks only. Requires a real Gazebo engine to validate dynamics."""
import unittest
from xml.etree import ElementTree as ET
from scripts.generate_gazebo_world import generate

class SDFGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=ET.parse(generate()).getroot()
        cls.robot=cls.root.find('./world/model[@name="cdr01"]')
    def test_links_joints_and_drive(self):
        self.assertEqual(len(self.robot.findall('link')),6)
        self.assertEqual(len(self.robot.findall('joint')),5)
        drive=self.robot.find("plugin[@name='gz::sim::systems::DiffDrive']")
        self.assertEqual(drive.findtext('wheel_radius'),'0.12')
        self.assertEqual(drive.findtext('wheel_separation'),'0.38')
    def test_total_mass_25kg_with_payload(self):
        mass=sum(float(link.findtext('inertial/mass')) for link in self.robot.findall('link'))
        self.assertAlmostEqual(mass,25.0)
    def test_inertias_positive(self):
        for link in self.robot.findall('link'):
            for axis in ('ixx','iyy','izz'):
                self.assertGreater(float(link.findtext('inertial/inertia/'+axis)),0)
    def test_joint_references_and_sensors(self):
        names={link.attrib['name'] for link in self.robot.findall('link')}
        for joint in self.robot.findall('joint'):
            self.assertIn(joint.findtext('parent'),names)
            self.assertIn(joint.findtext('child'),names)
        self.assertIsNotNone(self.robot.find("link[@name='chassis']/sensor[@name='imu']"))

if __name__=='__main__':unittest.main()
