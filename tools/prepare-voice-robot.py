"""Prepare the static robot_3d.glb for lightweight rigid-part web animation.

Run with Blender:
  blender --background --python tools/prepare-voice-robot.py -- source.glb output.glb
"""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REGIONS = (
    "body",
    "head",
    "left_upper_arm",
    "left_forearm",
    "left_hand",
    "right_upper_arm",
    "right_forearm",
    "right_hand",
)

DECIMATE_RATIO = {
    "body": 0.05,
    "head": 0.11,
    "left_upper_arm": 0.08,
    "left_forearm": 0.08,
    "left_hand": 0.14,
    "right_upper_arm": 0.08,
    "right_forearm": 0.08,
    "right_hand": 0.14,
}


def parse_paths():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Expected source and output GLB paths after --")
    return Path(args[0]).resolve(), Path(args[1]).resolve()


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def classify_component(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center = sum(corners, Vector()) / len(corners)
    x, _, z = center
    if z > 0.345 and abs(x) < 0.16:
        return "head"
    if x > 0.118:
        if z < -0.045:
            return "left_hand"
        if z < 0.135:
            return "left_forearm"
        if z < 0.345:
            return "left_upper_arm"
    if x < -0.118:
        if z < -0.045:
            return "right_hand"
        if z < 0.135:
            return "right_forearm"
        if z < 0.345:
            return "right_upper_arm"
    return "body"


def split_into_regions(source):
    activate(source)
    world_matrix = source.matrix_world.copy()
    source.parent = None
    source.matrix_world = world_matrix
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    base_material = source.data.materials[0]
    activate(source)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")

    region_components = {region: [] for region in REGIONS}
    for obj in list(bpy.context.selected_objects):
        if obj.type != "MESH":
            continue
        region_components[classify_component(obj)].append(obj)

    objects = {}
    for region, components in region_components.items():
        if not components:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for component in components:
            component.select_set(True)
        bpy.context.view_layer.objects.active = components[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f"Robot_{region}"
        obj.data.name = f"Robot_{region}_Mesh"
        obj.data.materials.clear()
        obj.data.materials.append(base_material)
        objects[region] = obj

    missing = [region for region in REGIONS if region not in objects]
    if missing:
        raise RuntimeError(f"Could not isolate robot regions: {', '.join(missing)}")
    return objects, base_material


def decimate(objects):
    stats = {}
    for region, obj in objects.items():
        before = len(obj.data.polygons)
        activate(obj)
        modifier = obj.modifiers.new(name="WebDecimate", type="DECIMATE")
        modifier.ratio = DECIMATE_RATIO[region]
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        stats[region] = {"before": before, "after": len(obj.data.polygons)}
    return stats


def create_pivot(name, location, parent=None):
    pivot = bpy.data.objects.new(name, None)
    pivot.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(pivot)
    pivot.location = location
    bpy.context.view_layer.update()
    if parent:
        world = pivot.matrix_world.copy()
        pivot.parent = parent
        pivot.matrix_world = world
        bpy.context.view_layer.update()
    return pivot


def parent_keep_world(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    bpy.context.view_layer.update()


def build_rig(objects):
    root = create_pivot("RobotRigRoot", (0, 0, 0))
    torso = create_pivot("TorsoRoot", (0, 0, 0), root)
    parent_keep_world(objects["body"], torso)

    head_yaw = create_pivot("HeadYaw", (0, 0, 0.35), torso)
    head_pitch = create_pivot("HeadPitch", (0, 0, 0.35), head_yaw)
    parent_keep_world(objects["head"], head_pitch)

    left_shoulder = create_pivot("LeftShoulderPivot", (0.132, 0, 0.30), torso)
    left_elbow = create_pivot("LeftElbowPivot", (0.17, 0, 0.125), left_shoulder)
    left_wrist = create_pivot("LeftWristPivot", (0.18, 0, -0.035), left_elbow)
    parent_keep_world(objects["left_upper_arm"], left_shoulder)
    parent_keep_world(objects["left_forearm"], left_elbow)
    parent_keep_world(objects["left_hand"], left_wrist)

    right_shoulder = create_pivot("RightShoulderPivot", (-0.132, 0, 0.30), torso)
    right_elbow = create_pivot("RightElbowPivot", (-0.17, 0, 0.125), right_shoulder)
    right_wrist = create_pivot("RightWristPivot", (-0.18, 0, -0.035), right_elbow)
    parent_keep_world(objects["right_upper_arm"], right_shoulder)
    parent_keep_world(objects["right_forearm"], right_elbow)
    parent_keep_world(objects["right_hand"], right_wrist)

    return {
        "root": root,
        "torso": torso,
        "head_yaw": head_yaw,
        "head_pitch": head_pitch,
        "left_shoulder": left_shoulder,
        "left_elbow": left_elbow,
        "left_wrist": left_wrist,
        "right_shoulder": right_shoulder,
        "right_elbow": right_elbow,
        "right_wrist": right_wrist,
    }


def make_material(name, color, emission=None, emission_strength=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Roughness"].default_value = 0.26
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1)
        principled.inputs["Emission Strength"].default_value = emission_strength
    return material


def make_box(name, location, dimensions, material, parent):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    parent_keep_world(obj, parent)
    return obj


def add_face_display(head_obj, head_pitch):
    corners = [head_obj.matrix_world @ Vector(corner) for corner in head_obj.bound_box]
    min_y = min(corner.y for corner in corners)
    min_z = min(corner.z for corner in corners)
    max_z = max(corner.z for corner in corners)
    height = max_z - min_z
    face_y = min_y - 0.0035
    mouth_z = min_z + height * 0.31
    eye_z = min_z + height * 0.69

    mask_material = make_material("FaceDisplayMaskMaterial", (0.006, 0.009, 0.012))
    glow_material = make_material(
        "FaceWaveGlowMaterial",
        (0.48, 0.2, 0.035),
        emission=(1.0, 0.47, 0.08),
        emission_strength=3.2,
    )
    eye_material = make_material(
        "FaceEyeGlowMaterial",
        (0.48, 0.2, 0.035),
        emission=(1.0, 0.47, 0.08),
        emission_strength=2.8,
    )

    make_box(
        "FaceMouthMask",
        (0, face_y, mouth_z),
        (0.066, 0.004, 0.014),
        mask_material,
        head_pitch,
    )

    point_count = 13
    x_values = [-0.025 + index * (0.05 / (point_count - 1)) for index in range(point_count)]
    for index in range(point_count - 1):
        x1, x2 = x_values[index], x_values[index + 1]
        make_box(
            f"MouthWaveSegment{index + 1:02d}",
            ((x1 + x2) * 0.5, face_y - 0.0025, mouth_z),
            ((x2 - x1) * 1.06, 0.0022, 0.0016),
            glow_material,
            head_pitch,
        )

    left_eye = make_box(
        "LeftEyeLight",
        (0.023, face_y - 0.002, eye_z),
        (0.017, 0.002, 0.0026),
        eye_material,
        head_pitch,
    )
    right_eye = make_box(
        "RightEyeLight",
        (-0.023, face_y - 0.002, eye_z),
        (0.017, 0.002, 0.0026),
        eye_material,
        head_pitch,
    )
    left_eye.name = "LeftEyeLight"
    right_eye.name = "RightEyeLight"
    return x_values


def export_glb(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_morph=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_add_webp=True,
        export_image_webp_fallback=False,
        export_image_quality=74,
        export_unused_images=False,
        export_unused_textures=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def main():
    source_path, output_path = parse_paths()
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    source = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    objects, _ = split_into_regions(source)
    stats = decimate(objects)
    rig = build_rig(objects)
    mouth_x = add_face_display(objects["head"], rig["head_pitch"])
    rig["root"]["voice_robot"] = True
    rig["root"]["mouth_x"] = mouth_x
    export_glb(output_path)
    print(json.dumps({
        "source": str(source_path),
        "output": str(output_path),
        "bytes": output_path.stat().st_size,
        "decimation": stats,
    }, indent=2))


if __name__ == "__main__":
    main()
