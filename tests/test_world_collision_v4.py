"""Prove the source-driven visual fixtures are also known to the offline planner."""
import unittest
from math import hypot
from xml.etree import ElementTree as ET
from pathlib import Path
from cdr_sim.campus import (
    Campus, ReplayOptions, astar, replay, swept_rect_intersects, shared_world,
)


class SharedWorldCollisionTests(unittest.TestCase):
    def test_manifest_has_required_provenance(self):
        spec=shared_world()
        self.assertEqual(spec["schema"],"cdr-shared-collision-world-v4")
        self.assertEqual(set(spec["worlds"]),{"campus","warehouse"})
        for theme in spec["worlds"]:
            world=Campus(theme=theme)
            registered={o["id"] for o in world.fixtures}
            self.assertEqual(len(registered),len(world.fixtures))
            self.assertGreater(len(registered),10)
            self.assertEqual(len(world.obstacles),len(world.buildings)+len(world.fixtures))
            self.assertEqual(world.as_dict()["collision_objects"],len(world.obstacles))
            for item in world.fixtures:
                with self.subTest(theme=theme,fixture=item["id"]):
                    x0,y0,x1,y1=item["footprint_m"]
                    self.assertLess(x0,x1)
                    self.assertLess(y0,y1)
                    self.assertTrue(world.width>=x1>=0)
                    self.assertTrue(world.height>=y1>=0)
                    self.assertFalse(world.free(world.cell(((x0+x1)/2,(y0+y1)/2))))
            for stop in world.stops.values():
                with self.subTest(theme=theme,stop=stop):
                    self.assertTrue(world.free(world.cell(stop)))

    def test_warehouse_uses_rendered_walls_not_invisible_campus_wings(self):
        campus=Campus(theme="campus")
        warehouse=Campus(theme="warehouse")
        self.assertNotEqual(warehouse.buildings, campus.buildings)
        self.assertEqual(len(warehouse.buildings),2)
        scene=ET.parse(Path("assets/world/native-logistics.urdf")).getroot()
        for name, rect in zip(("rear-wall_29","east-wall_30"),warehouse.buildings):
            v=scene.find(".//visual[@name='"+name+"']")
            self.assertIsNotNone(v)
            x,y,_=map(float,v.find("origin").attrib["xyz"].split())
            w,h,_=map(float,v.find("geometry/box").attrib["size"].split())
            self.assertAlmostEqual(x-w/2,rect[0],places=4)
            self.assertAlmostEqual(y-h/2,rect[1],places=4)
            self.assertAlmostEqual(x+w/2,rect[2],places=4)
            self.assertAlmostEqual(y+h/2,rect[3],places=4)

    def test_swept_segment_exact_intersection(self):
        box=(1.0,1.0,2.0,2.0)
        self.assertTrue(swept_rect_intersects((0,1.5),(3,1.5),box,0))
        self.assertFalse(swept_rect_intersects((0,2.8),(3,2.8),box,.1))
        # A segment that grazes an inflated corner must not be ignored.
        self.assertTrue(swept_rect_intersects((.5,1.35),(1.1,1.35),box,.1))

    def test_declared_solid_blocks_direct_route(self):
        for theme in ("campus","warehouse"):
            world=Campus(theme=theme)
            fixture=world.fixtures[0]
            x0,y0,x1,y1=fixture["footprint_m"]
            cy=(y0+y1)/2
            a=(max(.2,x0-2),cy)
            b=(min(world.width-.2,x1+2),cy)
            self.assertFalse(world.segment_safe(a,b))

    def test_all_model_frames_and_routes_obey_known_static_obstacles(self):
        for theme in ("campus","warehouse"):
            world=Campus(theme=theme)
            for name in ("engineering","library","student_center"):
                for seed in (0,7,19):
                    for scenario in ("clear","construction"):
                        with self.subTest(theme=theme,destination=name,seed=seed,scenario=scenario):
                            run=replay(ReplayOptions(destination=name,seed=seed,scenario=scenario),
                                       campus=world)
                            self.assertIn(run["status"],{"COMPLETED","PAUSED_SAFE"})
                            self.assertTrue(run["collision_checked"])
                            self.assertEqual(run["collision_objects"],len(world.obstacles))
                            self.assertGreaterEqual(run["minimum_sampled_clearance_m"],0)
                            for a,b in zip(run["frames"],run["frames"][1:]):
                                self.assertTrue(world.segment_safe(
                                    (a["x_m"],a["y_m"]),(b["x_m"],b["y_m"])))
                            for entry in run["routes"]:
                                points=entry["points"]
                                # Construction changes dynamic occupancy at detection time;
                                # every route remains safe against static solid assets.
                                for a,b in zip(points,points[1:]):
                                    self.assertTrue(world.segment_safe(tuple(a),tuple(b)))

if __name__=="__main__":
    unittest.main()
