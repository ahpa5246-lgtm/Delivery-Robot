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

    def test_warehouse_structural_walls_match_native_collision_world(self):
        world=Campus(theme="warehouse")
        scene=ET.parse(construct("warehouse")).getroot().find("world")
        self.assertEqual(len(world.buildings),2)
        for index, rect in enumerate(world.buildings):
            node=scene.find(f"./model[@name='building_{index}']")
            self.assertIsNotNone(node)
            self.assertAlmostEqual(
                float(node.findtext("link/collision/geometry/box/size").split()[0]),
                rect[2]-rect[0], places=4)
            self.assertAlmostEqual(float(node.findtext("pose").split()[2]),2.4,places=4)
        special=ET.parse(construct("warehouse", wall_contact_test=True)).getroot()
        self.assertEqual([float(v) for v in special.find(
            "./world/model[@name='cdr01']/pose").text.split()[:2]],[26,2])

    def test_contact_gate_only_in_physics_trials(self):
        for theme in ("campus", "warehouse"):
            regular=ET.parse(construct(theme)).getroot().find("world")
            special=ET.parse(construct(theme,wall_contact_test=True)).getroot().find("world")
            self.assertEqual(len(regular.findall(".//plugin[@name='gz::sim::systems::TouchPlugin']")),0)
            wall_index=0 if theme=="campus" else 1
            wall=special.find(f"./model[@name='building_{wall_index}']")
            touch=wall.find("./plugin[@name='gz::sim::systems::TouchPlugin']")
            self.assertIsNotNone(touch)
            self.assertEqual(touch.findtext("create_contact_sensor_for_collision"),"true")
            relay=special.find("./plugin[@name='gz::sim::systems::TriggeredPublisher']")
            self.assertEqual(relay.findtext("output"),"data: false")
            self.assertEqual(relay.find("output").attrib["topic"],"/model/cdr01/enable")

    def test_every_visible_solid_fixture_has_gazebo_collision_from_manifest(self):
        for theme in ("campus","warehouse"):
            campus=Campus(theme=theme)
            scene=ET.parse(construct(theme)).getroot().find("world")
            names={m.get("name") for m in scene.findall("model")}
            for item in campus.fixtures:
                with self.subTest(theme=theme,id=item["id"]):
                    key="fixture_"+item["id"]
                    self.assertIn(key,names)
                    model=scene.find("./model[@name='"+key+"']")
                    self.assertEqual(model.findtext("static"),"true")
                    self.assertIsNotNone(model.find("link/collision/geometry/box"))
                    x0,y0,x1,y1=item["footprint_m"]
                    width,depth,height=(float(x) for x in
                        model.findtext("link/collision/geometry/box/size").split())
                    self.assertAlmostEqual(width,x1-x0,places=4)
                    self.assertAlmostEqual(depth,y1-y0,places=4)
                    self.assertGreater(height,0)
                    self.assertAlmostEqual(float(model.findtext("pose").split()[0]),
                                           (x0+x1)/2,places=4)

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
