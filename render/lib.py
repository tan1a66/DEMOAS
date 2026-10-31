"""Funzioni comuni per costruire la villa in Blender (bpy) e renderizzarla con Cycles.

Coordinate: come in src/data/villa.json, in metri:
  x = da ovest (mare, x=0 facciata) verso est (strada)
  y = quota (0 = pavimento del livello mare)
  z = da nord (0) verso sud
In Blender: X = x, Y = -z (nord positivo), Z = y.
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
TEX = ASSETS / "textures"


def B(x, y, z):
    return Vector((x, -z, y))


# ---------------------------------------------------------------- scena

def use_gpu():
    """Usa la GPU se c'è (OptiX, poi CUDA); altrimenti CPU. Restituisce il tipo scelto."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except KeyError:
        return "CPU"
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
        except Exception:  # noqa: BLE001
            continue
        devs = [d for d in prefs.devices if d.type == kind]
        if devs:
            for d in prefs.devices:
                d.use = d.type == kind
            bpy.context.scene.cycles.device = "GPU"
            return kind
    bpy.context.scene.cycles.device = "CPU"
    return "CPU"


def reset(samples=256, res=(1600, 1067)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    print("Dispositivo di render:", use_gpu())
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.015
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    sc.cycles.denoising_prefilter = "ACCURATE"
    sc.cycles.max_bounces = 10
    sc.cycles.diffuse_bounces = 5
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 12
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 8.0
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 1.15
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 92
    return sc


def world_hdri(path, rotation_deg=0.0, strength=1.0, background_strength=None):
    """Cielo HDRI. rotation_deg ruota l'ambiente intorno all'asse verticale."""
    w = bpy.data.worlds.new("Cielo")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value[2] = math.radians(-rotation_deg)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(str(path))
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    if background_strength is None:
        bg = nt.nodes.new("ShaderNodeBackground")
        bg.inputs["Strength"].default_value = strength
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    else:
        # luce dall'HDRI con una intensità, sfondo visibile (camera) con un'altra
        bg_l = nt.nodes.new("ShaderNodeBackground")
        bg_l.inputs["Strength"].default_value = strength
        bg_c = nt.nodes.new("ShaderNodeBackground")
        bg_c.inputs["Strength"].default_value = background_strength
        lp = nt.nodes.new("ShaderNodeLightPath")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(env.outputs["Color"], bg_l.inputs["Color"])
        nt.links.new(env.outputs["Color"], bg_c.inputs["Color"])
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
        nt.links.new(bg_l.outputs["Background"], mix.inputs[1])
        nt.links.new(bg_c.outputs["Background"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return w


def sun(direction_from, strength=4.0, angle_deg=0.6, color=(1.0, 0.86, 0.7)):
    """Sole: direction_from = vettore Blender dal punto verso il sole."""
    d = Vector(direction_from).normalized()
    data = bpy.data.lights.new("Sole", "SUN")
    data.energy = strength
    data.angle = math.radians(angle_deg)
    data.color = color
    ob = bpy.data.objects.new("Sole", data)
    bpy.context.collection.objects.link(ob)
    ob.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    return ob


def camera(pos, target, lens=16.0, sensor=36.0, shift=(0.0, 0.0), name="Camera"):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = sensor
    data.shift_x, data.shift_y = shift
    data.clip_start = 0.05
    data.clip_end = 2000
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    p = B(*pos)
    t = B(*target)
    ob.location = p
    ob.rotation_euler = (t - p).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


# ---------------------------------------------------------------- materiali

def _nodes(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    return m, nt, bsdf


def mat_color(name, color, rough=0.5, metal=0.0, coat=0.0, spec=0.5):
    m, nt, b = _nodes(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Specular IOR Level"].default_value = spec
    return m


def _image(nt, path, non_color=False, proj="BOX", blend=0.25):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(str(path), check_existing=True)
    if non_color:
        n.image.colorspace_settings.name = "Non-Color"
    n.projection = proj
    n.projection_blend = blend
    return n


def mat_pbr(name, tex_id, size=1.0, tint=None, rough_add=0.0, rough_mul=1.0, bump=0.4, rot_deg=0.0,
            hsv=None, normal_strength=1.0, offset=(0, 0, 0)):
    """Materiale fisico da texture Poly Haven, proiezione a cubo in coordinate di oggetto (metri).
    size = lato della texture in metri."""
    m, nt, b = _nodes(name)
    d = TEX / tex_id
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size, 1 / size, 1 / size)
    mp.inputs["Rotation"].default_value[2] = math.radians(rot_deg)
    mp.inputs["Location"].default_value = offset
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    col = _image(nt, d / "diffuse.jpg")
    nt.links.new(mp.outputs["Vector"], col.inputs["Vector"])
    c_out = col.outputs["Color"]
    if hsv:
        h = nt.nodes.new("ShaderNodeHueSaturation")
        h.inputs["Hue"].default_value, h.inputs["Saturation"].default_value, h.inputs["Value"].default_value = hsv
        nt.links.new(c_out, h.inputs["Color"])
        c_out = h.outputs["Color"]
    if tint:
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.blend_type = "MULTIPLY"
        mx.inputs["Factor"].default_value = 1.0
        mx.inputs["B"].default_value = (*tint, 1)
        nt.links.new(c_out, mx.inputs["A"])
        c_out = mx.outputs["Result"]
    nt.links.new(c_out, b.inputs["Base Color"])
    rp = d / "rough.jpg"
    if rp.exists():
        r = _image(nt, rp, True)
        nt.links.new(mp.outputs["Vector"], r.inputs["Vector"])
        mm = nt.nodes.new("ShaderNodeMath")
        mm.operation = "MULTIPLY_ADD"
        mm.inputs[1].default_value = rough_mul
        mm.inputs[2].default_value = rough_add
        mm.use_clamp = True
        nt.links.new(r.outputs["Color"], mm.inputs[0])
        nt.links.new(mm.outputs["Value"], b.inputs["Roughness"])
    npth = d / "nor_gl.jpg"
    if npth.exists() and normal_strength > 0:
        n = _image(nt, npth, True)
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_glass(name="Vetro", tint=(0.92, 0.95, 0.95)):
    """Vetro architettonico sottile: rifrazione per la camera, trasparente alle ombre (entra il sole)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    glass = nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value = (*tint, 1)
    glass.inputs["Roughness"].default_value = 0.0
    glass.inputs["IOR"].default_value = 1.5
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (*tint, 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    mx2 = nt.nodes.new("ShaderNodeMixShader")
    # raggi d'ombra e diffusi attraversano il vetro come se fosse sottile
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MAXIMUM"
    nt.links.new(lp.outputs["Is Shadow Ray"], add.inputs[0])
    nt.links.new(lp.outputs["Is Diffuse Ray"], add.inputs[1])
    nt.links.new(add.outputs["Value"], mx.inputs["Fac"])
    nt.links.new(glass.outputs["BSDF"], mx.inputs[1])
    nt.links.new(tr.outputs["BSDF"], mx.inputs[2])
    # riflesso debole e trasmissione quasi piena per la camera (vetro sottile, niente distorsione)
    fres = nt.nodes.new("ShaderNodeFresnel")
    fres.inputs["IOR"].default_value = 1.5
    gl = nt.nodes.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.0
    # riflesso solo sulla faccia esterna della lastra: niente riflessione totale interna
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    front = nt.nodes.new("ShaderNodeMath")
    front.operation = "SUBTRACT"
    front.inputs[0].default_value = 1.0
    nt.links.new(geo.outputs["Backfacing"], front.inputs[1])
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    nt.links.new(fres.outputs["Fac"], fac.inputs[0])
    nt.links.new(front.outputs["Value"], fac.inputs[1])
    nt.links.new(fac.outputs["Value"], mx2.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], mx2.inputs[1])
    nt.links.new(gl.outputs["BSDF"], mx2.inputs[2])
    final = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], final.inputs["Fac"])
    nt.links.new(mx.outputs["Shader"], final.inputs[1])
    nt.links.new(mx2.outputs["Shader"], final.inputs[2])
    nt.links.new(final.outputs["Shader"], out.inputs["Surface"])
    return m


def mat_emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def mat_fabric(name, color, rough=0.85, sheen=0.25, bump_scale=900.0, bump=0.08):
    """Tessuto: base opaca, sheen per la peluria, micro-trama con rumore."""
    m, nt, b = _nodes(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Roughness"].default_value = 0.5
    b.inputs["Sheen Tint"].default_value = (*[min(1.0, c * 1.6) for c in color], 1)
    b.inputs["Specular IOR Level"].default_value = 0.3
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = bump_scale
    noise.inputs["Detail"].default_value = 2
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    nt.links.new(noise.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_rug(name, color):
    """Tappeto a pelo corto: variazione di colore a chiazze, fibre fini, bordo leggermente più scuro."""
    m, nt, b = _nodes(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    big = nt.nodes.new("ShaderNodeTexNoise")
    big.inputs["Scale"].default_value = 3.0
    big.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], big.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (color[0] * 0.85, color[1] * 0.85, color[2] * 0.85, 1)
    ramp.color_ramp.elements[1].color = (color[0] * 1.1, color[1] * 1.1, color[2] * 1.08, 1)
    nt.links.new(big.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    fib = nt.nodes.new("ShaderNodeTexNoise")
    fib.inputs["Scale"].default_value = 1400
    fib.inputs["Detail"].default_value = 1
    nt.links.new(tc.outputs["Object"], fib.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    nt.links.new(fib.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Sheen Weight"].default_value = 0.8
    b.inputs["Sheen Roughness"].default_value = 0.6
    b.inputs["Specular IOR Level"].default_value = 0.2
    return m


def mat_black_marble(name="MarmoNero"):
    """Marmo nero con venature bianche sottili (tipo Nero Marquina), procedurale."""
    m, nt, b = _nodes(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.9, 0.9, 0.9)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    warp = nt.nodes.new("ShaderNodeTexNoise")
    warp.inputs["Scale"].default_value = 1.6
    warp.inputs["Detail"].default_value = 6
    warp.inputs["Distortion"].default_value = 1.4
    nt.links.new(mp.outputs["Vector"], warp.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.inputs["Scale"].default_value = 1.1
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 6
    wave.inputs["Detail Scale"].default_value = 1.5
    nt.links.new(warp.outputs["Color"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.012, 0.012, 0.013, 1)
    cr.elements[1].position = 0.93
    cr.elements[1].color = (0.016, 0.016, 0.017, 1)
    e = cr.elements.new(0.985)
    e.color = (0.55, 0.55, 0.55, 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.22
    b.inputs["Coat Weight"].default_value = 0.15
    return m


def mat_sea(name="Mare"):
    """Mare visto da lontano: blu profondo, riflessi del cielo, onde fini."""
    m, nt, b = _nodes(name)
    b.inputs["Base Color"].default_value = (0.012, 0.045, 0.07, 1)
    b.inputs["Roughness"].default_value = 0.05
    b.inputs["Specular IOR Level"].default_value = 0.5
    b.inputs["IOR"].default_value = 1.333
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.25, 0.08, 0.25)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 3.0
    n.inputs["Detail"].default_value = 8
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.25
    nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_water(name="Acqua"):
    m, nt, b = _nodes(name)
    b.inputs["Base Color"].default_value = (0.75, 0.92, 0.93, 1)
    b.inputs["Roughness"].default_value = 0.02
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.333
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 1.8
    n.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.12
    nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


# ---------------------------------------------------------------- geometria

def _link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, bm, material, bevel=0.0, segments=2, smooth=False, collection=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    if isinstance(material, (list, tuple)):
        for mt in material:
            ob.data.materials.append(mt)
    elif material:
        ob.data.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    if bevel > 0:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        mod.harden_normals = False
    return _link(ob, collection)


def box(name, x0, x1, y0, y1, z0, z1, material, bevel=0.003, segments=2, collection=None):
    """Parallelepipedo in coordinate villa (x, y quota, z sud)."""
    bm = bmesh.new()
    c = [B(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    v = [bm.verts.new(p) for p in c]
    # indici: (x,y,z) bit 4,2,1
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in faces:
        try:
            bm.faces.new([v[i] for i in f])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, material, bevel, segments, collection=collection)


def prism(name, poly, y0, y1, material, bevel=0.0, collection=None):
    """Prisma verticale da un poligono in pianta [(x, z), ...]."""
    bm = bmesh.new()
    bottom = [bm.verts.new(B(x, y0, z)) for x, z in poly]
    f = bm.faces.new(bottom)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=Vector((0, 0, y1 - y0)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, material, bevel, collection=collection)


def beam(name, p0, p1, w, h, material, bevel=0.002, collection=None):
    """Trave a sezione rettangolare tra due punti 3D (coordinate villa)."""
    a = B(*p0)
    b = B(*p1)
    d = b - a
    length = d.length
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((length, w, h)), verts=bm.verts)
    ob = mesh_obj(name, bm, material, bevel, collection=collection)
    ob.location = (a + b) / 2
    ob.rotation_euler = d.to_track_quat("X", "Z").to_euler()
    return ob


def rounded_block(name, x0, x1, y0, y1, z0, z1, material, radius=0.06, segments=5, collection=None):
    """Blocco con spigoli molto arrotondati (cuscini, imbottiti)."""
    ob = box(name, x0, x1, y0, y1, z0, z1, material, bevel=radius, segments=segments, collection=collection)
    ob.modifiers["Bevel"].limit_method = "NONE"
    ob.modifiers["Bevel"].profile = 0.6
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cushion(name, x0, x1, y0, y1, z0, z1, material, puff=0.025, radius=0.05, collection=None):
    """Cuscino: blocco arrotondato, suddiviso e leggermente gonfio al centro delle facce."""
    ob = rounded_block(name, x0, x1, y0, y1, z0, z1, material, radius=radius, segments=4, collection=collection)
    sub = ob.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    cast = ob.modifiers.new("Gonfio", "CAST")
    cast.cast_type = "SPHERE"
    cast.factor = puff
    return ob


def cylinder(name, cx, cz, y0, y1, r, material, segments=48, bevel=0.004, collection=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r, depth=y1 - y0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=B(cx, (y0 + y1) / 2, cz))
    ob = mesh_obj(name, bm, material, bevel, smooth=True, collection=collection)
    return ob


def area_light(name, pos, size, strength, color=(1.0, 0.82, 0.62), direction=(0, -1, 0), shape="RECTANGLE", size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = strength
    data.color = color
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = B(*pos)
    d = B(*direction) - B(0, 0, 0)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    ob.visible_glossy = False  # la sorgente non si vede nei riflessi (vetri, marmo)
    ob.visible_camera = False
    return ob


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- dettagli e post-produzione

def pillow(name, cx, cy, cz, w, h, t, material, rot=(0, 0, 0), collection=None):
    """Cuscino decorativo con angoli pizzicati (cubo suddiviso e gonfiato). cx, cy, cz = centro."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)
    for v in bm.verts:
        x, y, z = v.co
        # gonfio al centro, sottile ai bordi
        k = (1 - (2 * x) ** 2) * (1 - (2 * z) ** 2)
        v.co = Vector((x * w, y * t * (0.25 + 0.75 * max(0.0, k)), z * h))
    ob = mesh_obj(name, bm, material, smooth=True, collection=collection)
    sub = ob.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    ob.location = B(cx, cy, cz)
    ob.rotation_euler = rot
    return ob


def wrinkles(ob, strength=0.006, scale=0.12):
    """Grinze leggere del tessuto: Displace con rumore."""
    tex = bpy.data.textures.new(f"{ob.name}_grinze", "CLOUDS")
    tex.noise_scale = scale
    tex.noise_depth = 2
    d = ob.modifiers.new("Grinze", "DISPLACE")
    d.texture = tex
    d.strength = strength
    d.mid_level = 0.5
    return d


def append_model(asset_id, pos, rot_deg=0.0, scale=1.0, collection=None):
    """Importa un modello Poly Haven scaricato con fetch_assets.py e lo posiziona (coordinate villa)."""
    d = ASSETS / "models" / asset_id
    blend = next(d.glob("*.blend"))
    with bpy.data.libraries.load(str(blend), link=False) as (src, dst):
        dst.objects = list(src.objects)
    root = bpy.data.objects.new(f"{asset_id}_root", None)
    _link(root, collection)
    for ob in dst.objects:
        if ob is None:
            continue
        _link(ob, collection)
        if ob.parent is None:
            ob.parent = root
    root.location = B(*pos)
    root.rotation_euler = (0, 0, math.radians(rot_deg))
    root.scale = (scale, scale, scale)
    return root


def post(glare=0.04, dispersion=0.012, vignette=0.28):
    """Resa fotografica: bagliore delle luci forti, leggera dispersione dell'obiettivo, vignettatura."""
    sc = bpy.context.scene
    sc.render.compositor_device = "CPU"  # nessuna GPU/OpenGL necessaria
    ng = bpy.data.node_groups.new("Post", "CompositorNodeTree")
    sc.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    out = ng.nodes.new("NodeGroupOutput")
    rl = ng.nodes.new("CompositorNodeRLayers")
    g = ng.nodes.new("CompositorNodeGlare")
    g.inputs["Type"].default_value = "Fog Glow"
    g.inputs["Threshold"].default_value = 1.2
    g.inputs["Strength"].default_value = glare
    g.inputs["Size"].default_value = 0.6
    ng.links.new(rl.outputs["Image"], g.inputs["Image"])
    lens = ng.nodes.new("CompositorNodeLensdist")
    lens.inputs["Dispersion"].default_value = dispersion
    lens.inputs["Distortion"].default_value = 0.0
    ng.links.new(g.outputs["Image"], lens.inputs["Image"])
    el = ng.nodes.new("CompositorNodeEllipseMask")
    el.inputs["Size"].default_value = (0.95, 0.95)
    bl = ng.nodes.new("CompositorNodeBlur")
    bl.inputs["Size"].default_value = (300, 300)
    ng.links.new(el.outputs["Mask"], bl.inputs["Image"])
    mx = ng.nodes.new("ShaderNodeMix")
    mx.data_type = "RGBA"
    mx.blend_type = "MULTIPLY"
    mx.inputs["Factor"].default_value = vignette
    ng.links.new(lens.outputs["Image"], mx.inputs["A"])
    inv = ng.nodes.new("ShaderNodeMix")
    inv.data_type = "RGBA"
    inv.inputs["Factor"].default_value = 1.0
    inv.inputs["A"].default_value = (0, 0, 0, 1)
    ng.links.new(bl.outputs["Image"], inv.inputs["B"])
    ng.links.new(inv.outputs["Result"], mx.inputs["B"])
    # dove la maschera vale 1 il fattore di moltiplicazione deve lasciare l'immagine invariata
    mx2 = ng.nodes.new("ShaderNodeMix")
    mx2.data_type = "RGBA"
    mx2.inputs["Factor"].default_value = vignette
    ng.links.new(lens.outputs["Image"], mx2.inputs["A"])
    mul = ng.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    ng.links.new(lens.outputs["Image"], mul.inputs["A"])
    ng.links.new(bl.outputs["Image"], mul.inputs["B"])
    ng.links.new(mul.outputs["Result"], mx2.inputs["B"])
    ng.links.new(mx2.outputs["Result"], out.inputs["Image"])
    for n in (mx, inv):
        ng.nodes.remove(n)
    return ng
