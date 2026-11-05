"""Rendu physique (Blender Cycles) des objets des designs réalistes.

Chaque objet est un relief posé à plat, vu du dessus par une caméra orthographique :
  blender -b --python real_render.py -- jobs.json
Le relief, la couleur, la rugosité et le détail de surface sont préparés par real_compose.py
à partir de photos de matières réelles. Blender n'apporte que la lumière et les ombres.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

PX = 0.01  # 1 pixel de l'image = 1 cm de scène


def use_gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            usable = [d for d in prefs.devices if d.type == kind]
            if usable:
                for d in prefs.devices:
                    d.use = d.type == kind
                bpy.context.scene.cycles.device = "GPU"
                return kind
        except TypeError:
            continue
    return "CPU"


def clear():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for item in list(coll):
            coll.remove(item)


def image_node(tree, path, data):
    node = tree.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(path)
    node.image.colorspace_settings.name = "Non-Color" if data else "sRGB"
    node.extension = "EXTEND"
    node.interpolation = "Cubic"
    return node


def material(job):
    mat = bpy.data.materials.new(job["name"])
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    color = image_node(tree, job["albedo"], False)
    tree.links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    rough = image_node(tree, job["rough"], True)
    tree.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    if job.get("metal_map"):
        metal = image_node(tree, job["metal_map"], True)
        tree.links.new(metal.outputs["Color"], bsdf.inputs["Metallic"])
    else:
        bsdf.inputs["Metallic"].default_value = job.get("metallic", 0.0)
    if job.get("normal"):
        nor = image_node(tree, job["normal"], True)
        nmap = tree.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = job.get("normal_strength", 1.0)
        tree.links.new(nor.outputs["Color"], nmap.inputs["Color"])
        tree.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Specular IOR Level"].default_value = job.get("specular", 0.5)
    if job.get("coat"):
        bsdf.inputs["Coat Weight"].default_value = job["coat"]
        bsdf.inputs["Coat Roughness"].default_value = job.get("coat_rough", 0.3)
    if job.get("sss"):
        bsdf.inputs["Subsurface Weight"].default_value = job["sss"]
        bsdf.inputs["Subsurface Scale"].default_value = job.get("sss_scale", 0.05)
    return mat


def relief(job):
    height = np.load(job["height"]).astype(np.float32)
    mask = np.load(job["mask"]).astype(bool)
    rows, cols = height.shape
    step = job.get("step", 1)
    w_px, h_px = job["size"]
    xs = (np.arange(cols) * step - w_px / 2) * PX
    ys = (h_px / 2 - np.arange(rows) * step) * PX
    gx, gy = np.meshgrid(xs, ys)
    coords = np.stack([gx.ravel(), gy.ravel(), (height * PX).ravel()], axis=1)

    keep = mask[:-1, :-1] & mask[1:, :-1] & mask[:-1, 1:] & mask[1:, 1:]
    r, c = np.nonzero(keep)
    a = r * cols + c
    quads = np.stack([a + cols, a + cols + 1, a + 1, a], axis=1)

    mesh = bpy.data.meshes.new(job["name"])
    mesh.vertices.add(len(coords))
    mesh.vertices.foreach_set("co", coords.ravel())
    mesh.loops.add(quads.size)
    mesh.loops.foreach_set("vertex_index", quads.ravel())
    mesh.polygons.add(len(quads))
    mesh.polygons.foreach_set("loop_start", np.arange(len(quads), dtype=np.int32) * 4)
    mesh.update(calc_edges=True)

    uv = mesh.uv_layers.new(name="UVMap")
    loop_v = quads.ravel()
    u = (loop_v % cols) / (cols - 1)
    v = 1 - (loop_v // cols) / (rows - 1)
    uv.data.foreach_set("uv", np.stack([u, v], axis=1).ravel().astype(np.float32))
    mesh.shade_smooth()

    obj = bpy.data.objects.new(job["name"], mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material(job))
    return obj


def render(job, device):
    clear()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU" if device != "CPU" else "CPU"
    scene.cycles.samples = job.get("samples", 256)
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.max_bounces = 8
    scene.cycles.film_exposure = job.get("exposure", 1.0)
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    w_px, h_px = job["size"]
    scene.render.resolution_x = w_px
    scene.render.resolution_y = h_px
    scene.render.filepath = job["out"]

    relief(job)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(w_px, h_px) * PX
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 30)
    scene.camera = cam

    if job.get("shadow", True):
        bpy.ops.mesh.primitive_plane_add(size=max(w_px, h_px) * PX * 3, location=(0, 0, -0.002))
        bpy.context.active_object.is_shadow_catcher = True

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = job.get("sun", 3.0)
    sun_data.angle = math.radians(job.get("sun_angle", 6))
    sun_data.color = job.get("sun_color", (1.0, 0.96, 0.9))
    sun = bpy.data.objects.new("sun", sun_data)
    bpy.context.collection.objects.link(sun)
    d = Vector(job.get("sun_dir", (0.55, -0.7, -1.0))).normalized()
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = d.to_track_quat("-Z", "Y")

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    scene.world = world
    tree = world.node_tree
    env = tree.nodes.new("ShaderNodeTexEnvironment")
    base = os.path.dirname(bpy.app.binary_path)
    version = f"{bpy.app.version[0]}.{bpy.app.version[1]}"
    env.image = bpy.data.images.load(os.path.join(base, version, "datafiles", "studiolights", "world", job.get("hdri", "interior.exr")))
    bg = tree.nodes["Background"]
    bg.inputs["Strength"].default_value = job.get("world", 0.8)
    tree.links.new(env.outputs["Color"], bg.inputs["Color"])

    bpy.ops.render.render(write_still=True)


def main():
    jobs = json.load(open(sys.argv[sys.argv.index("--") + 1], encoding="utf8"))
    device = use_gpu()
    print("device", device, flush=True)
    for job in jobs:
        render(job, device)
        print("rendu", job["name"], flush=True)


main()
