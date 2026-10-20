"""Generate a Gazebo Harmonic campus variant aligned with cdr_sim.campus.

Reuses the existing dynamic differential-drive CDR-01 starter; static world
geometry comes from exactly the same Campus object as the offline map. This
generator alone does not verify Gazebo contact or Nav2 navigation.
"""
from pathlib import Path
import sys
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cdr_sim.campus import Campus
from scripts.generate_gazebo_world import generate, child


OUTPUT = ROOT / "simulation" / "campus_delivery.sdf"


def construct(theme: str = "campus", *, wall_contact_test: bool = False):
    if wall_contact_test and theme != "warehouse":
        raise ValueError("dedicated wall contact scenario is for warehouse only")
    # Gazebo's collision and the offline A* planner share the SAME rectangles.
    campus = Campus(theme=theme)
    source = generate()
    sdf = ET.parse(source).getroot()
    world = sdf.find("world")
    pavement = world.find("./model[@name='pavement']/link[@name='ground']")
    pavement.find("pose").text = f"{campus.width/2} {campus.height/2} -0.1 0 0 0"
    for part in ("visual", "collision"):
        pavement.find(f"{part}/geometry/box/size").text = f"{campus.width} {campus.height} 0.2"

    for node in list(world.findall("model")):
        if node.get("name", "").startswith("campus_bollard"):
            world.remove(node)

    robot = world.find("./model[@name='cdr01']")
    # Warehouse contact trial starts 5.7m before the east wall, whereas
    # the normal warehouse recording still starts at the depot (2,2).
    home = (26.0, 2.0) if wall_contact_test else campus.stops["depot"]
    robot.find("pose").text = f"{home[0]} {home[1]} 0 0 0 0"

    for index, (x0,y0,x1,y1) in enumerate(campus.buildings):
        height = (4.8 if theme == "warehouse" else (2.8 if index < 3 else 0.8))
        building = child(world, "model", name=f"building_{index}")
        child(building, "static", "true")
        child(building, "pose", f"{(x0+x1)/2} {(y0+y1)/2} {height/2} 0 0 0")
        link = child(building, "link", name="block")
        for section in ("collision", "visual"):
            shape = child(child(link, section, name="block_"+section), "geometry")
            child(child(shape,"box"),"size",f"{x1-x0} {y1-y0} {height}")
        visual=link.find("visual")
        material=child(visual,"material")
        child(material,"ambient","0.19 0.29 0.34 1")
        child(material,"diffuse","0.25 0.42 0.48 1")

    heights={"tree":1.50,"bench":.74,"table":.85,"light":2.8,
             "bike_rack":.70,"shelf":2.15,"cargo":.93}
    for fixture in campus.fixtures:
        x0,y0,x1,y1=fixture["footprint_m"]
        height=heights[fixture["kind"]]
        model=child(world,"model",name="fixture_"+fixture["id"])
        child(model,"static","true")
        child(model,"pose",f"{(x0+x1)/2} {(y0+y1)/2} {height/2} 0 0 0")
        link=child(model,"link",name="solid")
        for section in ("collision","visual"):
            geometry=child(child(link,section,name=fixture["id"]+"_"+section),
                           "geometry")
            child(child(geometry,"box"),"size",f"{x1-x0} {y1-y0} {height}")
        material=child(link.find("visual"),"material")
        child(material,"ambient","0.37 0.46 0.44 1")
        child(material,"diffuse","0.43 0.52 0.50 1")

    for name,(x,y) in campus.stops.items():
        m=child(world,"model",name="stop_"+name)
        child(m,"static","true")
        child(m,"pose",f"{x} {y} 0.027 0 0 0")
        link=child(m,"link",name="marker")
        visual=child(link,"visual",name="marker_visual")
        cylinder=child(child(visual,"geometry"),"cylinder")
        child(cylinder,"radius",".22")
        child(cylinder,"length",".05")
        material=child(visual,"material")
        child(material,"ambient","0.14 0.75 0.57 1")
        child(material,"diffuse","0.24 0.81 0.67 1")
    ET.indent(sdf,space="  ")
    output = (ROOT/"simulation"/"warehouse_collision_test.sdf" if wall_contact_test
              else OUTPUT if theme=="campus"
              else ROOT/"simulation"/"warehouse_delivery.sdf")
    output.parent.mkdir(parents=True,exist_ok=True)
    ET.ElementTree(sdf).write(output,encoding="utf-8",xml_declaration=True)
    return output


if __name__ == "__main__":
    for theme in ("campus","warehouse"):
        print("Wrote Gazebo world with authoritative collision fixtures:",construct(theme))
    print("Wrote dedicated warehouse east-wall physical challenge:",
          construct("warehouse", wall_contact_test=True))
