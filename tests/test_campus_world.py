"""Geometry correspondence test; Gazebo engine verification is a separate CI job."""
import unittest
from xml.etree import ElementTree as ET

from cdr_sim.campus import Campus
from scripts.generate_campus_gazebo import construct


class CampusSDFTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=ET.parse(construct()).getroot()
        cls.world=cls.root.find("world")
        cls.campus=Campus()

    def test_differential_robot_stays_25_kg_and_starts_at_depot(self):
        robot=self.world.find("./model[@name='cdr01']")
        mass=sum(float(x.findtext("inertial/mass")) for x in robot.findall("link"))
        self.assertAlmostEqual(mass,25.0)
        home=self.campus.stops["depot"]
        self.assertEqual([float(x) for x in robot.findtext("pose").split()[:2]],list(home))

    def test_bounding_boxes_match_2d_occupancy(self):
        for i,rect in enumerate(self.campus.buildings):
            model=self.world.find(f"./model[@name='building_{i}']")
            self.assertIsNotNone(model)
            self.assertEqual(model.findtext("static"),"true")
            x0,y0,x1,y1=rect
            xx,yy,zz=[float(x) for x in model.findtext("pose").split()[:3]]
            self.assertAlmostEqual(xx,(x0+x1)/2)
            self.assertAlmostEqual(yy,(y0+y1)/2)
            dims=[float(x) for x in model.findtext("link/collision/geometry/box/size").split()]
            self.assertAlmostEqual(dims[0],x1-x0)
            self.assertAlmostEqual(dims[1],y1-y0)
            self.assertAlmostEqual(zz,dims[2]/2)

    def test_destination_markers_are_visual_only(self):
        for name in self.campus.stops:
            marker=self.world.find(f"./model[@name='stop_{name}']")
            self.assertIsNotNone(marker)
            self.assertIsNotNone(marker.find("link/visual"))
            self.assertIsNone(marker.find("link/collision"))
            self.assertEqual(marker.findtext("static"),"true")

    def test_ground_spans_map(self):
        size=[float(x) for x in self.world.findtext("./model[@name='pavement']/link/visual/geometry/box/size").split()]
        self.assertEqual(size[:2],[self.campus.width,self.campus.height])


if __name__ == "__main__":
    unittest.main()
