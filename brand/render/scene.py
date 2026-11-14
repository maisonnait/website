#!/usr/bin/env python3
"""
Maison N'Ait -- signature flacon packshot scene, path traced with Blender Cycles (bpy module).

  python3 scene.py --liquid arabisant --bg light --comp hero --samples 200 --out hero-light.jpg
  python3 scene.py --liquid hommes --bg dark --comp packshot --out bottle-hommes-dark.jpg
  python3 scene.py --comp alpha --transparent --out bottle-alpha.png
  python3 scene.py --comp hero --scale 0.24 --samples 48 --out draft.jpg      (quick draft)

The film is always rendered transparent; unless --transparent is given, the frame is then
composited (in this script) over the exact page background (light: #FFFFFF -> #F7F3EA,
dark: #0B0B0C), so the background colour is guaranteed and costs no samples.
Units: 1 Blender unit = 10 cm.  Profile tables below are in centimetres.
"""
import argparse, math, os, sys, time, tempfile

COMPS = {  # name: (W, H, flacon height / H, flacon centre x / W, base y / H measured from the bottom)
    'hero':     (2000, 1300, 0.70, 0.725, 0.135),
    'hero-rtl': (2000, 1300, 0.70, 0.275, 0.135),   # the same picture with the flacon on the left, for right-to-left pages
    'portrait': (1200, 1600, 0.555, 0.50, 0.375),   # flacon in the upper two thirds, calm lower third
    'packshot': (1200, 1500, 0.72, 0.50, 0.125),
    'sizes':    (1600, 1000, 0.62, 0.50, 0.16),
    'alpha':    (1200, 1600, 0.80, 0.50, 0.09),
    'layer':    (1400, 1600, 0.675, 0.50, 0.19),   # RGBA master at packshot scale, see --save-layer / --use-layer
}
LIQUIDS = {  # absorption colour (what survives) and density per Blender unit (10 cm)
    'arabisant': ((0.90, 0.68, 0.05), 9.0),   # deep amber gold
    'femmes':    ((0.98, 0.64, 0.56), 2.8),  # soft blush rose-gold
    'hommes':    ((0.24, 0.40, 0.57), 6.5),   # smoky dark blue-grey
    'unisexe':   ((0.955, 0.84, 0.52), 2.6),  # pale champagne
}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--liquid', default='arabisant', help='collection name (%s) or r,g,b' % ', '.join(LIQUIDS))
ap.add_argument('--density', type=float, default=None, help='override absorption density')
ap.add_argument('--fill', type=float, default=0.70, help='fill level, 0..1 of the cavity height')
ap.add_argument('--bg', choices=['light', 'dark'], default='light')
ap.add_argument('--comp', choices=list(COMPS), default='packshot')
ap.add_argument('--res', default=None, help='WxH override (keep the aspect of the composition)')
ap.add_argument('--scale', type=float, default=1.0, help='resolution multiplier, e.g. 0.24 for drafts')
ap.add_argument('--samples', type=int, default=200)
ap.add_argument('--noise', type=float, default=0.01, help='adaptive sampling noise threshold')
ap.add_argument('--transparent', action='store_true', help='keep the transparent film (RGBA PNG, glass transparent in alpha)')
ap.add_argument('--out', default=None)
ap.add_argument('--bgcolor', default=None, help='flat background colour "#rrggbb" (overrides the dark #0B0B0C / the light gradient)')
ap.add_argument('--save-layer', default=None, help='also keep the raw path-traced RGBA frame (PNG)')
ap.add_argument('--use-layer', default=None, help='do not render: compose --comp from an RGBA frame rendered with --comp layer')
ap.add_argument('--no-webp', action='store_true')
ap.add_argument('--threads', type=int, default=2)
ap.add_argument('--exposure', type=float, default=0.0)
ap.add_argument('--look', default='AgX - Medium High Contrast')
ap.add_argument('--reflect', type=float, default=None, help='ground mirror fraction (default 0.10 light, 0.16 dark)')
ap.add_argument('--seed', type=int, default=0)
ap.add_argument('--turn-seq', default=None, help='render several turns in one run: comma-separated degrees; --save-layer must then contain %%d (frame index)')
ap.add_argument('--turn', type=float, default=0.0, help='turn the flacon about its vertical axis, in degrees (frames of the turning hero). Multiples of 2.8125 (one lathe segment) keep the glass mesh identical, so only the print and the stopper change between frames')
ap.add_argument('--logo', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'logo-mark.svg'), help='house mark (SVG or PNG with alpha) printed in gold on the belly; "none" for the 3D drop emblem')
ap.add_argument('--logo-height', type=float, default=4.0, help='height of the printed mark in cm (belly is about 7.5 cm)')
ap.add_argument('--design', choices=['arabisant', 'femmes', 'hommes', 'unisexe'], default='arabisant', help='flacon design: arabisant = crowned amphora (default), femmes = slender hourglass with a rose-gold sphere, hommes = bevelled block with a gunmetal cap, unisexe = straight cylinder with a low champagne drum. Independent of --liquid')
args = ap.parse_args()

import numpy as np
import bpy
from mathutils import Vector
from PIL import Image

T0 = time.time()
CM = 0.1
NSEG = 128


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def catmull(P, per=12, alpha=0.5):
    P = np.asarray(P, float)
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** alpha
        t2 = t1 + np.linalg.norm(p2 - p1) ** alpha
        t3 = t2 + np.linalg.norm(p3 - p2) ** alpha
        t = np.linspace(t1, t2, per, endpoint=False)[:, None]
        A1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        A2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        A3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2
        B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3
        out.append((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2)
    out.append(P[-2][None])
    return np.vstack(out)


def resample(P, n):
    P = np.asarray(P, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    s = np.linspace(0, d[-1], n)
    return np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]


def fillet(pts, rad, n=5):
    pts = [np.array(p, float) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        la, lc = np.linalg.norm(a - b), np.linalg.norm(c - b)
        d = min(rad, 0.45 * la, 0.45 * lc)
        p0, p1 = b + (a - b) / la * d, b + (c - b) / lc * d
        for t in np.linspace(0, 1, n):
            out.append((1 - t) ** 2 * p0 + 2 * t * (1 - t) * b + t * t * p1)
    out.append(pts[-1])
    return np.array(out)


# ----------------------------------------------------------------------------- profiles (cm)
# Outer glass silhouette, after the logo: narrow neck, concave shoulder, round belly, waist, foot plate.
OUTER_PTS = [(0.92, 9.90), (0.92, 9.50), (0.925, 9.15), (0.98, 8.86), (1.20, 8.52), (1.62, 8.10),
             (2.20, 7.60), (2.80, 6.95), (3.22, 6.20), (3.40, 5.45), (3.38, 4.70), (3.14, 3.85),
             (2.66, 2.95), (2.14, 2.15), (1.76, 1.50), (1.56, 1.02), (1.52, 0.80), (1.60, 0.62),
             (1.86, 0.52), (2.06, 0.46), (2.14, 0.36), (2.14, 0.12), (2.09, 0.035), (1.98, 0.0)]
BOTTOM_PTS = [(1.98, 0.0), (1.70, 0.0), (1.45, 0.03), (1.00, 0.09), (0.50, 0.115), (0.0, 0.12)]
WALL = 0.36          # glass wall thickness
CAV_FLOOR = 1.86     # thick glass base: the cavity starts this high
NECK_REF = 8.9       # "100 % full" reference height
MENISCUS_H, MENISCUS_L = 0.13, 0.085


def glass_profiles():
    outer = resample(catmull(OUTER_PTS, 14), 250)
    d = np.gradient(outer, axis=0)
    tang = d / np.linalg.norm(d, axis=1)[:, None]
    nrm = np.c_[-tang[:, 1], tang[:, 0]]            # left of travel (going down) = outward
    off = outer - WALL * nrm
    keep = off[outer[:, 1] >= 3.3][::7]
    ctrl = np.vstack([[0.92 - WALL, 9.90], keep[1:], [2.20, 2.92], [1.75, 2.40], [1.15, 2.05],
                      [0.55, 1.90], [0.0, CAV_FLOOR]])
    inner = resample(catmull(ctrl, 12), 210)
    inner[0] = (0.92 - WALL, 9.90)
    inner[-1] = (0.0, CAV_FLOOR)
    inner[:, 0] = np.maximum(inner[:, 0], 0.0)
    bottom = resample(catmull(BOTTOM_PTS, 8), 18)
    bottom[-1, 0] = 0.0
    return outer, inner, bottom


def grid_mesh(name, R, Z, fmat_ring=None, scale=1.0, loc=(0, 0, 0), theta0=0.0):
    """Surface from rings (R[i, j], Z[i, j]); rings of zero radius are poles.
    Normals point to the left of the direction of travel in the (r, z) half plane."""
    R = np.asarray(R, float); Z = np.asarray(Z, float)
    nr, ns = R.shape
    th = theta0 + np.arange(ns) * 2 * np.pi / ns
    c, s = np.cos(th), np.sin(th)
    verts, start, pole = [], [], []
    for i in range(nr):
        start.append(len(verts))
        if R[i].max() < 1e-7:
            pole.append(True)
            verts.append((0.0, 0.0, float(Z[i].mean())))
        else:
            pole.append(False)
            verts.extend(zip(R[i] * c, R[i] * s, Z[i]))
    faces, fmat = [], []
    for i in range(nr - 1):
        a, b = start[i], start[i + 1]
        if pole[i] and pole[i + 1]:
            continue
        m = int(fmat_ring[i]) if fmat_ring is not None else 0
        for j in range(ns):
            j2 = (j + 1) % ns
            if pole[i]:
                faces.append((a, b + j, b + j2))
            elif pole[i + 1]:
                faces.append((a + j, b, a + j2))
            else:
                faces.append((a + j, b + j, b + j2, a + j2))
            fmat.append(m)
    k = CM * scale
    verts = [(x * k + loc[0], y * k + loc[1], z * k + loc[2]) for x, y, z in verts]
    return make_object(name, verts, faces, fmat)


def make_object(name, verts, faces, fmat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if fmat is not None:
        me.polygons.foreach_set('material_index', fmat)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def lathe(name, prof, fmat_ring=None, nseg=NSEG, **kw):
    prof = np.asarray(prof, float)
    R = np.repeat(prof[:, 0:1], nseg, axis=1)
    Z = np.repeat(prof[:, 1:2], nseg, axis=1)
    return grid_mesh(name, R, Z, fmat_ring, **kw)


def stopper_rings(nseg=240):
    """Gold stopper: a flared, fluted cup with five gentle scallops around a dome and a small finial."""
    th = np.arange(nseg) * 2 * np.pi / nseg
    one = np.ones_like(th)
    z0, rb, rt, H, A, t, fd = 10.035, 1.18, 1.62, 1.44, 0.28, 0.13, 0.055
    sc = (0.5 + 0.5 * np.cos(5 * (th + np.pi / 2))) ** 1.5       # a peak faces the camera
    Hr = z0 + H + A * sc
    g = (0.5 - 0.5 * np.cos(20 * (th + np.pi / 2))) ** 0.8
    rin, zf, Dm = rt - t - 0.08, z0 + H - 0.18, 0.58
    rs, rn, st = 0.20, 0.10, 1.15
    zd = zf + Dm * math.cos(math.pi / 2 * (0.11 / rin)) ** 0.9
    zc = zd + 0.06 + st * math.sqrt(rs * rs - rn * rn)
    rings = []
    for a in np.linspace(0, math.pi - math.asin(rn / rs), 16):   # finial
        rings.append((rs * math.sin(a) * one, (zc + st * rs * math.cos(a)) * one))
    rings.append((0.11 * one, zd * one))
    for rho in np.linspace(0.11 / rin, 1.0, 26)[1:]:              # dome
        rings.append((rin * rho * one, (zf + Dm * max(math.cos(math.pi / 2 * rho), 0.0) ** 0.9) * one))
    for u in np.linspace(0, 1, 10)[1:]:                           # inner wall, up to the rim
        rings.append(((rin + (rt - t - rin) * u ** 0.7) * one, zf + (Hr - zf) * u))
    for a in np.linspace(math.pi, 0, 9)[1:-1]:                    # rounded lip
        rings.append(((rt - t / 2 + t / 2 * math.cos(a)) * one, Hr + t / 2 * math.sin(a)))
    for u in np.linspace(1, 0, 44):                               # fluted outer wall, going down
        w = float(smoothstep(0.05, 0.20, u) * (1 - smoothstep(0.78, 0.92, u)))
        rings.append((rb + (rt - rb) * (0.2 * u + 0.8 * u * u) - fd * g * w, (z0 + 0.06) + u * (Hr - (z0 + 0.06))))
    rings.append(((rb - 0.02) * one, (z0 + 0.02) * one))
    rings.append(((rb - 0.06) * one, z0 * one))
    rings.append((0 * one, z0 * one))
    R = np.array([r for r, z in rings]); Z = np.array([z for r, z in rings])
    return R, Z, zc + st * rs


COLLAR_PTS = [(0.0, 10.02), (1.52, 10.02), (1.52, 9.74), (1.04, 9.74), (1.04, 9.56), (1.27, 9.56),
              (1.30, 9.32), (1.27, 9.08), (0.96, 9.08), (0.96, 9.975), (0.0, 9.975)]


def emblem(name, outer, scale, loc):
    """Small raised gold drop on the front of the belly (wrapped on the glass surface)."""
    ze, b, a, T0e = 4.72, 0.69, 0.555, 0.08
    zs, rs_ = outer[::-1, 1], outer[::-1, 0]
    R0 = float(np.interp(ze, zs, rs_))
    nt, nr = 96, 14
    t = np.arange(nt) * 2 * np.pi / nt
    ox = a * np.sin(t) * np.sin(t / 2)
    oy = b * np.cos(t)
    cy = -0.22 * b
    verts, faces = [], []

    def place(x, y, thick):
        z = ze + y
        r = float(np.interp(z, zs, rs_)) + thick - 0.004
        phi = x / R0
        return (r * math.sin(phi), -r * math.cos(phi), z)

    verts.append(place(0, cy, T0e))
    for i in range(1, nr + 1):
        rho = i / nr
        th_ = T0e * (1 - rho ** 2.4) ** 0.55
        for j in range(nt):
            verts.append(place(rho * ox[j], cy + rho * (oy[j] - cy), th_))
    for j in range(nt):
        faces.append((0, 1 + j, 1 + (j + 1) % nt))
    for i in range(nr - 1):
        a0, b0 = 1 + i * nt, 1 + (i + 1) * nt
        for j in range(nt):
            j2 = (j + 1) % nt
            faces.append((a0 + j, b0 + j, b0 + j2, a0 + j2))
    k = CM * scale
    verts = [(x * k + loc[0], y * k + loc[1], z * k + loc[2]) for x, y, z in verts]
    return make_object(name, verts, faces)


def logo_decal(name, outer, scale, loc, mat, aspect, h):
    """Gold print of the house mark: a thin shell just outside the glass, UVs projected from the camera side
    (planar along Y), so the mark is neither mirrored nor stretched by the curvature."""
    zs, rs_ = outer[::-1, 1], outer[::-1, 0]
    w, zc_ = h * aspect, 4.7
    nx, nz = 28, 56
    verts, faces, uvs = [], [], []
    for iz in range(nz + 1):
        z = zc_ - h / 2 + h * iz / nz
        r = float(np.interp(z, zs, rs_)) + 0.004
        for ix in range(nx + 1):
            x = -w / 2 + w * ix / nx
            verts.append((x, -math.sqrt(r * r - x * x), z)); uvs.append((ix / nx, iz / nz))
    for iz in range(nz):
        for ix in range(nx):
            a0 = iz * (nx + 1) + ix
            faces.append((a0, a0 + 1, a0 + nx + 2, a0 + nx + 1))
    k = CM * scale
    ob = make_object(name, [(x * k + loc[0], y * k + loc[1], z * k + loc[2]) for x, y, z in verts], faces)
    uv = ob.data.uv_layers.new(name='UVMap')
    for lp in ob.data.loops:
        uv.data[lp.index].uv = uvs[lp.vertex_index]
    ob.data.materials.append(mat)
    ob.visible_shadow = False
    return ob


def mat_logo(path):
    if path.lower().endswith('.svg'):
        import subprocess
        png = os.path.join(tempfile.gettempdir(), 'nait_logo_%d.png' % os.getpid())
        subprocess.run(['rsvg-convert', '-h', '2048', path, '-o', png], check=True)
        path = png
    pim = Image.open(path).convert('RGBA')
    al = np.asarray(pim)[..., 3]
    ys, xs = np.nonzero(al > 8)                      # crop to the ink, keep a small clear margin
    pim = pim.crop((xs.min() - 8, ys.min() - 8, xs.max() + 9, ys.max() + 9))
    crop = os.path.join(tempfile.gettempdir(), 'nait_logo_crop_%d.png' % os.getpid()); pim.save(crop)
    return bpy.data.images.load(crop), pim.size[0] / pim.size[1]


# ----------------------------------------------------------------------------- materials
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    m.node_tree.nodes.clear()
    return m, m.node_tree.nodes, m.node_tree.links


def mat_glass(name, ior, shadow_col=0.92, volume=None, logo=None):
    """Glass interface. Shadow rays see it as (almost) clear, so light gets through without caustics noise."""
    m, N, L = new_mat(name)
    out = N.new('ShaderNodeOutputMaterial')
    g = N.new('ShaderNodeBsdfGlass'); g.inputs['Roughness'].default_value = 0.0
    g.inputs['IOR'].default_value = ior
    g.inputs['Color'].default_value = (1, 1, 1, 1)
    tr = N.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (shadow_col,) * 3 + (1,)
    lp = N.new('ShaderNodeLightPath'); mix = N.new('ShaderNodeMixShader')
    L.new(lp.outputs['Is Shadow Ray'], mix.inputs[0]); L.new(g.outputs[0], mix.inputs[1]); L.new(tr.outputs[0], mix.inputs[2])
    surf = mix.outputs[0]
    if logo is not None:   # hot-foil print of the house mark: a material mix on the glass itself, projected along Y
        img, aspect, h, zc_, k = logo
        w = h * aspect
        tc = N.new('ShaderNodeTexCoord'); sp = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs[0])
        mu_ = N.new('ShaderNodeMath'); mu_.operation = 'MULTIPLY_ADD'; L.new(sp.outputs[0], mu_.inputs[0])
        mu_.inputs[1].default_value = 1.0 / (w * k); mu_.inputs[2].default_value = 0.5
        mv_ = N.new('ShaderNodeMath'); mv_.operation = 'MULTIPLY_ADD'; L.new(sp.outputs[2], mv_.inputs[0])
        mv_.inputs[1].default_value = 1.0 / (h * k); mv_.inputs[2].default_value = -(zc_ - h / 2) / h
        cb = N.new('ShaderNodeCombineXYZ'); L.new(mu_.outputs[0], cb.inputs[0]); L.new(mv_.outputs[0], cb.inputs[1])
        tex = N.new('ShaderNodeTexImage'); tex.image = img; tex.extension = 'CLIP'; tex.interpolation = 'Cubic'
        L.new(cb.outputs[0], tex.inputs['Vector'])
        fr = N.new('ShaderNodeMath'); fr.operation = 'LESS_THAN'; L.new(sp.outputs[1], fr.inputs[0]); fr.inputs[1].default_value = 0.0
        fa = N.new('ShaderNodeMath'); fa.operation = 'MULTIPLY'; L.new(tex.outputs['Alpha'], fa.inputs[0]); L.new(fr.outputs[0], fa.inputs[1])
        pg = N.new('ShaderNodeBsdfPrincipled'); pg.inputs['Base Color'].default_value = (0.55, 0.30, 0.05, 1)
        pg.inputs['Metallic'].default_value = 1.0; pg.inputs['Roughness'].default_value = 0.18
        mx = N.new('ShaderNodeMixShader'); L.new(fa.outputs[0], mx.inputs[0]); L.new(mix.outputs[0], mx.inputs[1]); L.new(pg.outputs[0], mx.inputs[2])
        surf = mx.outputs[0]
    L.new(surf, out.inputs['Surface'])
    if volume is not None:
        col, dens = volume
        va = N.new('ShaderNodeVolumeAbsorption')
        va.inputs['Color'].default_value = tuple(col) + (1,)
        va.inputs['Density'].default_value = dens
        L.new(va.outputs[0], out.inputs['Volume'])
    return m


def mat_gold(name='gold', rough=0.11):
    m, N, L = new_mat(name)
    out = N.new('ShaderNodeOutputMaterial'); p = N.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (1.0, 0.68, 0.24, 1)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Roughness'].default_value = rough
    L.new(p.outputs[0], out.inputs['Surface'])
    return m


def mat_softbox(name, strength, color, soft):
    m, N, L = new_mat(name)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = tuple(color) + (1,)
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['UV'], sep.inputs[0])

    def edge(sock):
        pp = N.new('ShaderNodeMath'); pp.operation = 'PINGPONG'; L.new(sock, pp.inputs[0]); pp.inputs[1].default_value = 0.5
        mr = N.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
        L.new(pp.outputs[0], mr.inputs['Value'])
        mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = max(soft, 1e-3)
        mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 1.0
        return mr.outputs['Result']
    mu = N.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'
    L.new(edge(sep.outputs[0]), mu.inputs[0]); L.new(edge(sep.outputs[1]), mu.inputs[1])
    geo = N.new('ShaderNodeNewGeometry')
    fr = N.new('ShaderNodeMath'); fr.operation = 'SUBTRACT'; fr.inputs[0].default_value = 1.0; L.new(geo.outputs['Backfacing'], fr.inputs[1])
    m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; L.new(mu.outputs[0], m2.inputs[0]); L.new(fr.outputs[0], m2.inputs[1])
    m3 = N.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'; L.new(m2.outputs[0], m3.inputs[0]); m3.inputs[1].default_value = strength
    L.new(m3.outputs[0], em.inputs['Strength']); L.new(em.outputs[0], out.inputs['Surface'])
    return m


def softbox(name, loc, target, sx, sy, strength, color=(1, 1, 1), soft=0.2, glossy=True, trans=True, diffuse=True, shadow=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-sx / 2, -sy / 2, 0), (sx / 2, -sy / 2, 0), (sx / 2, sy / 2, 0), (-sx / 2, sy / 2, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = c
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('Z', 'Y').to_euler()
    me.materials.append(mat_softbox(name, strength, color, soft))
    ob.visible_camera = False; ob.visible_glossy = glossy; ob.visible_transmission = trans
    ob.visible_diffuse = diffuse; ob.visible_shadow = shadow
    return ob


def ground(dark, reflect, transparent_glass):
    S = bpy.context.scene
    if not dark:   # shadow catcher: soft contact shadow in the alpha channel
        me = bpy.data.meshes.new('floor'); me.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new('floor', me); S.collection.objects.link(ob); ob.location = (0, 0, -0.0006)
        m, N, L = new_mat('floor'); out = N.new('ShaderNodeOutputMaterial'); d = N.new('ShaderNodeBsdfDiffuse')
        d.inputs['Color'].default_value = (0.86, 0.855, 0.84, 1); L.new(d.outputs[0], out.inputs['Surface'])
        me.materials.append(m); ob.is_shadow_catcher = True
    if reflect > 0:  # faint mirror, fading with the distance to the flacon
        me = bpy.data.meshes.new('mirror'); me.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new('mirror', me); S.collection.objects.link(ob); ob.location = (0, 0, -0.0003)
        m, N, L = new_mat('mirror'); out = N.new('ShaderNodeOutputMaterial')
        p = N.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = (1, 1, 1, 1)
        p.inputs['Metallic'].default_value = 1.0; p.inputs['Roughness'].default_value = 0.09
        tr = N.new('ShaderNodeBsdfTransparent'); mix = N.new('ShaderNodeMixShader')
        tc = N.new('ShaderNodeTexCoord'); ln = N.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
        L.new(tc.outputs['Object'], ln.inputs[0])
        mr = N.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'; L.new(ln.outputs['Value'], mr.inputs['Value'])
        mr.inputs['From Min'].default_value = 0.6; mr.inputs['From Max'].default_value = 2.6
        mr.inputs['To Min'].default_value = reflect; mr.inputs['To Max'].default_value = 0.0
        L.new(mr.outputs['Result'], mix.inputs[0]); L.new(tr.outputs[0], mix.inputs[1]); L.new(p.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs['Surface'])
        me.materials.append(m)
        ob.visible_shadow = False; ob.visible_diffuse = False; ob.visible_glossy = False; ob.visible_transmission = False


# ----------------------------------------------------------------------------- flacon
def build_flacon(tag, scale, loc, mats, fill):
    outer, inner, bottom = glass_profiles()
    zL = CAV_FLOOR + fill * (NECK_REF - CAV_FLOOR)
    zc = zL + MENISCUS_H
    rc = float(np.interp(zc, inner[::-1, 1], inner[::-1, 0]))
    contact = np.array([[rc, zc]])
    up = inner[inner[:, 1] > zc + 0.02][::-1]         # air side of the cavity wall, travelling up
    down = inner[inner[:, 1] < zc - 0.02]             # wetted wall, travelling down
    lip = np.array([[0.62, 9.94], [0.74, 9.955], [0.86, 9.94]])
    gprof = np.vstack([contact, up, lip, outer, bottom[1:]])
    gm = mats['glass']
    if mats.get('logo'):
        gm = mat_glass('glass_print' + tag, IOR_G, 0.78, logo=(mats['logo'][0], mats['logo'][1], args.logo_height, 4.7, CM * scale))
    g = lathe('glass' + tag, gprof, scale=scale, loc=(0, 0, 0)); g.location = loc; g.data.materials.append(gm)
    s = np.linspace(0, 1, 34)
    rr = rc * (1 - (1 - s) ** 2.2)
    top = np.c_[rr, zL + MENISCUS_H * np.exp(-(rc - rr) / MENISCUS_L)]
    top[-1] = (rc, zc)
    lprof = np.vstack([top, down])
    lprof[0, 0] = 0.0; lprof[-1, 0] = 0.0
    ids = [0] * (len(top) - 1) + [1] * len(down)
    lq = lathe('liquid' + tag, lprof, ids, scale=scale, loc=loc)
    lq.data.materials.append(mats['liq_top']); lq.data.materials.append(mats['liq_wall'])
    col = lathe('collar' + tag, fillet(COLLAR_PTS, 0.05, 5), scale=scale, loc=loc); col.data.materials.append(mats['gold'])
    R, Z, ztop = stopper_rings()
    stp = grid_mesh('stopper' + tag, R, Z, scale=scale, loc=loc); stp.data.materials.append(mats['gold'])
    if not mats.get('logo'):
        em = emblem('emblem' + tag, outer, scale, loc); em.data.materials.append(mats['gold'])
    return ztop * CM * scale



# ----------------------------------------------------------------------------- the other designs (--design)
# All are drawn at the same scale as the amphora (the camera keeps the amphora's framing), base on the same line.
DESIGN_LOGO = {'femmes': (2.9, 3.0), 'hommes': (3.6, 3.85), 'unisexe': (3.6, 4.55)}   # print height and centre height, cm


def fillet_v(pts, dists, n=9):
    """Like fillet(), with one tangent distance per inner corner."""
    pts = [np.array(p, float) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        la, lc = np.linalg.norm(a - b), np.linalg.norm(c - b)
        d = min(dists[i - 1], 0.45 * la, 0.45 * lc)
        p0, p1 = b + (a - b) / la * d, b + (c - b) / lc * d
        for t in np.linspace(0, 1, n):
            out.append((1 - t) ** 2 * p0 + 2 * t * (1 - t) * b + t * t * p1)
    out.append(pts[-1])
    return np.array(out)


def densify(P, maxlen=0.12):
    """Split long straight runs, so that the smooth shading of a rounded edge does not leak over a flat face."""
    P = np.asarray(P, float)
    out = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / maxlen)))
        out.extend(a + (b - a) * k / n for k in range(1, n + 1))
    return np.array(out)


def mat_metal(name, base, rough, aniso=0.0):
    m, N, L = new_mat(name)
    out = N.new('ShaderNodeOutputMaterial'); p = N.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = tuple(base) + (1,)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Roughness'].default_value = rough
    if aniso:
        p.inputs['Anisotropic'].default_value = aniso
    L.new(p.outputs[0], out.inputs['Surface'])
    return m


def r_at_z(prof, z):
    for (r0, z0), (r1, z1) in zip(prof[:-1], prof[1:]):
        if z0 != z1 and (z0 - z) * (z1 - z) <= 0:
            return float(r0 + (r1 - r0) * (z0 - z) / (z0 - z1))
    raise ValueError('perfume level outside the cavity')


def design_logo(design):
    h, zc_ = DESIGN_LOGO[design]
    return h * args.logo_height / 4.0, zc_


def print_glass(mats, design):
    if not mats.get('logo'):
        return mats['glass']
    h, zc_ = design_logo(design)
    return mat_glass('glass_print', IOR_G, 0.78, logo=(mats['logo'][0], mats['logo'][1], h, zc_, CM))


def lathe_body(design, outer, inner, bottom, mats, fill, neck_ref):
    """Glass + perfume of a turned flacon: the same three-interface model as the amphora."""
    cav_floor = float(inner[-1, 1])
    zL = cav_floor + fill * (neck_ref - cav_floor)
    zc = zL + MENISCUS_H
    rc = r_at_z(inner, zc)
    up = inner[inner[:, 1] > zc + 0.02][::-1]
    down = inner[inner[:, 1] < zc - 0.02]
    ri, ro, zt = float(inner[0, 0]), float(outer[0, 0]), float(outer[0, 1])
    lip = np.array([[ri + 0.06, zt + 0.04], [(ri + ro) / 2, zt + 0.055], [ro - 0.06, zt + 0.04]])
    g = lathe('glass', np.vstack([[[rc, zc]], up, lip, outer, bottom[1:]])); g.data.materials.append(print_glass(mats, design))
    s = np.linspace(0, 1, 34)
    rr = rc * (1 - (1 - s) ** 2.2)
    top = np.c_[rr, zL + MENISCUS_H * np.exp(-(rc - rr) / MENISCUS_L)]
    top[-1] = (rc, zc)
    lprof = np.vstack([top, down]); lprof[0, 0] = 0.0; lprof[-1, 0] = 0.0
    lq = lathe('liquid', lprof, [0] * (len(top) - 1) + [1] * len(down))
    lq.data.materials.append(mats['liq_top']); lq.data.materials.append(mats['liq_wall'])


def design_femmes(mats, fill):
    """Slender hourglass: narrow foot, rounded hips, drawn-in waist, fine shoulders, slim neck; thin glass;
    polished rose-gold sphere on a slim rose-gold collar."""
    zt = 10.90
    pts = [(0.70, zt), (0.70, 10.50), (0.71, 10.15), (0.80, 9.85), (1.02, 9.55), (1.36, 9.22), (1.62, 8.80),
           (1.74, 8.30), (1.72, 7.75), (1.60, 7.15), (1.48, 6.55), (1.44, 6.00), (1.50, 5.45), (1.70, 4.80),
           (2.02, 4.05), (2.34, 3.30), (2.50, 2.60), (2.46, 1.95), (2.24, 1.35), (1.90, 0.82), (1.58, 0.42),
           (1.42, 0.16), (1.37, 0.04), (1.28, 0.0)]
    wall = 0.22
    outer = resample(catmull(pts, 14), 260)
    d = np.gradient(outer, axis=0)
    tang = d / np.linalg.norm(d, axis=1)[:, None]
    off = outer - wall * np.c_[-tang[:, 1], tang[:, 0]]
    keep = off[outer[:, 1] >= 2.2][::7]
    ctrl = np.vstack([[0.70 - wall, zt], keep[1:], [2.04, 1.62], [1.60, 1.12], [0.90, 0.86], [0.0, 0.80]])
    inner = resample(catmull(ctrl, 12), 220)
    inner[0] = (0.70 - wall, zt); inner[-1] = (0.0, 0.80); inner[:, 0] = np.maximum(inner[:, 0], 0.0)
    bottom = resample(catmull([(1.28, 0.0), (1.06, 0.0), (0.86, 0.03), (0.50, 0.075), (0.0, 0.085)], 8), 16)
    bottom[-1, 0] = 0.0
    lathe_body('femmes', outer, inner, bottom, mats, fill, zt - 0.9)
    rose = mat_metal('rose_gold', (0.96, 0.53, 0.42), 0.09)
    col = lathe('collar', fillet([(0.0, zt + 0.14), (0.97, zt + 0.14), (0.97, zt - 0.62), (0.745, zt - 0.62), (0.745, zt + 0.09), (0.0, zt + 0.09)], 0.05, 5))
    col.data.materials.append(rose)
    R_, rs_, zb = 1.02, 0.46, zt + 0.245
    zc_ = zb + math.sqrt(R_ * R_ - rs_ * rs_)
    a = np.linspace(0, math.pi - math.asin(rs_ / R_), 44)
    prof = np.vstack([np.c_[R_ * np.sin(a), zc_ + R_ * np.cos(a)], [[rs_, zt + 0.175], [rs_ - 0.03, zt + 0.145], [0.0, zt + 0.145]]])
    prof[0, 0] = 0.0
    stp = lathe('stopper', prof); stp.data.materials.append(rose)
    return (zc_ + R_) * CM


def design_unisexe(mats, fill):
    """Minimal straight cylinder, crisp flat shoulder, short neck, thick flat base; low wide drum in brushed champagne metal."""
    outer = densify(fillet_v([(0.90, 10.20), (0.90, 9.40), (2.80, 9.40), (2.80, 0.0), (2.20, 0.0)], [0.10, 0.16, 0.10]))
    inner = densify(fillet_v([(0.56, 10.20), (0.56, 9.04), (2.44, 9.04), (2.44, 1.50), (0.0, 1.50)], [0.10, 0.22, 0.28]))
    inner[-1, 0] = 0.0
    bottom = resample(catmull([(2.20, 0.0), (1.90, 0.0), (1.60, 0.035), (0.80, 0.095), (0.0, 0.105)], 8), 14)
    bottom[-1, 0] = 0.0
    lathe_body('unisexe', outer, inner, bottom, mats, fill, 9.04)
    champ = mat_metal('champagne', (0.93, 0.80, 0.58), 0.22, 0.5)
    cap = lathe('stopper', densify(fillet_v([(0.0, 11.25), (1.95, 11.25), (1.95, 9.95), (0.94, 9.95), (0.94, 10.29), (0.0, 10.29)],
                                            [0.07, 0.05, 0.03, 0.03]), 0.15))
    cap.data.materials.append(champ)
    return 11.25 * CM


def rrect(a, b, c, nc=12, hold=0.03):
    """Rounded rectangle outline, counter-clockwise: half extents a (x) and b (y), corner radius c.
    Three points per side, two of them right next to the corners (holding edges: the flat sides stay flat)."""
    c = max(min(c, a - 1e-4, b - 1e-4), 1e-4)
    ctr = [(a - c, b - c, 0.0), (-(a - c), b - c, 0.5 * math.pi), (-(a - c), -(b - c), math.pi), (a - c, -(b - c), 1.5 * math.pi)]
    P = []
    for i, (cx, cy, a0) in enumerate(ctr):
        arc = [(cx + c * math.cos(a0 + 0.5 * math.pi * k / nc), cy + c * math.sin(a0 + 0.5 * math.pi * k / nc)) for k in range(nc + 1)]
        P.extend(arc)
        nx_, ny_, _ = ctr[(i + 1) % 4]
        a1 = a0 + 0.5 * math.pi
        e0, e1 = arc[-1], (nx_ + c * math.cos(a1), ny_ + c * math.sin(a1))
        L_ = math.hypot(e1[0] - e0[0], e1[1] - e0[1])
        h = min(hold, 0.25 * L_) / max(L_, 1e-9)
        for t in (h, 0.5, 1 - h):
            P.append((e0[0] + (e1[0] - e0[0]) * t, e0[1] + (e1[1] - e0[1]) * t))
    return np.array(P)


def loft(name, rings, fmat_ring=None):
    """Surface through a list of rings (outline (N, 2) or None for a pole, z), same winding rule as grid_mesh()."""
    verts, start, pole = [], [], []
    for xy, z in rings:
        start.append(len(verts))
        if xy is None:
            pole.append(True); verts.append((0.0, 0.0, z * CM))
        else:
            pole.append(False); verts.extend((float(x) * CM, float(y) * CM, z * CM) for x, y in xy)
    ns = next(len(xy) for xy, z in rings if xy is not None)
    faces, fmat = [], []
    for i in range(len(rings) - 1):
        a, b = start[i], start[i + 1]
        if pole[i] and pole[i + 1]:
            continue
        m = int(fmat_ring[i]) if fmat_ring is not None else 0
        for j in range(ns):
            j2 = (j + 1) % ns
            if pole[i]:
                faces.append((a, b + j, b + j2))
            elif pole[i + 1]:
                faces.append((a + j, b, a + j2))
            else:
                faces.append((a + j, b + j, b + j2, a + j2))
            fmat.append(m)
    return make_object(name, verts, faces, fmat)


def design_hommes(mats, fill):
    """Architectural block: rectangular glass with square shoulders, softly bevelled edges, a heavy base and a flat
    front face for the print; inner cavity box for the perfume; tall gunmetal cylinder cap with one thin gold ring.
    A bevelled box mesh built ring by ring, so that the perfume shares the cavity wall exactly."""
    A, B, C, Zt, eh, el = 3.20, 1.75, 0.50, 8.30, 0.30, 0.22      # outer half width, half depth, edge radii, height
    a, b, c, zf, zt, e = 2.75, 1.30, 0.26, 1.70, 7.75, 0.24       # cavity: thick walls, 1.7 cm base
    hold = 0.03

    def face(a_, b_, c_, z, inward):      # flat face between its rim and the centre
        sc = [1 - hold / b_, 0.85, 0.6, 0.3]
        rg = [(rrect(a_ * s, b_ * s, c_ * s), z) for s in (sc if inward else sc[::-1])]
        return rg + [(None, z)] if inward else [(None, z)] + rg

    def arc(a_, b_, c_, zc_, r, p0, p1):  # rounded horizontal edge of radius r
        out = []
        for psi in np.linspace(p0, p1, 9):
            d = r * (1 - math.cos(psi))
            out.append((rrect(a_ - d, b_ - d, max(c_ - d, 0.04)), zc_ + r * math.sin(psi)))
        return out

    rings = face(A - eh, B - eh, max(C - eh, 0.04), Zt, False) + arc(A, B, C, Zt - eh, eh, math.pi / 2, 0)
    rings += [(rrect(A, B, C), Zt - eh - hold), (rrect(A, B, C), el + hold)]
    rings += arc(A, B, C, el, el, 0, -math.pi / 2) + face(A - el, B - el, max(C - el, 0.04), 0.0, True)
    g = loft('glass', rings); g.data.materials.append(print_glass(mats, 'hommes'))

    zL = zf + fill * (zt - zf)
    zc = zL + MENISCUS_H
    ring_c = (rrect(a, b, c), zc)
    up = [ring_c, (rrect(a, b, c), zt - e - hold)] + arc(a, b, c, zt - e, e, 0, math.pi / 2) + face(a - e, b - e, max(c - e, 0.04), zt, True)
    gi = loft('glass.cav', up); gi.data.materials.append(mats['glass'])      # air side of the cavity
    d0 = 0.9
    top = [(None, zL)] + [(rrect((a - d0) * s, (b - d0) * s, 0.04 * s), zL) for s in (0.33, 0.66)]
    for d in (0.9, 0.6, 0.4, 0.28, 0.19, 0.13, 0.085, 0.05, 0.025):
        top.append((rrect(a - d, b - d, max(c - d, 0.04)), zL + MENISCUS_H * math.exp(-d / MENISCUS_L)))
    top.append(ring_c)
    wall = [(rrect(a, b, c), zf + e + hold)] + arc(a, b, c, zf + e, e, 0, -math.pi / 2) + face(a - e, b - e, max(c - e, 0.04), zf, True)
    lq = loft('liquid', top + wall, [0] * (len(top) - 1) + [1] * len(wall))
    lq.data.materials.append(mats['liq_top']); lq.data.materials.append(mats['liq_wall'])

    ring = lathe('collar', densify(fillet_v([(0.0, 8.52), (1.35, 8.52), (1.35, 8.32), (0.0, 8.32)], [0.03, 0.03]), 0.2))
    ring.data.materials.append(mats['gold'])
    cap = lathe('stopper', densify(fillet_v([(0.0, 11.20), (1.30, 11.20), (1.30, 8.53), (0.0, 8.53)], [0.08, 0.02]), 0.2))
    cap.data.materials.append(mat_metal('gunmetal', (0.13, 0.14, 0.165), 0.2))
    return 11.20 * CM


DESIGNS = {'femmes': design_femmes, 'hommes': design_hommes, 'unisexe': design_unisexe}


# ----------------------------------------------------------------------------- composition over the page background
def compose(im, src_comp, W, H, hfrac, cxfrac, basefrac, dark, out, webp=True):
    """Place an RGBA frame (framed as COMPS[src_comp]) into a W x H frame over the exact background."""
    WL, HL = im.size
    _, _, hL, cxL, bL = COMPS[src_comp]
    s = (hfrac * H) / (hL * HL)
    a = np.asarray(im.convert('RGBA'), np.float32) / 255.0
    same = abs(s - 1) < 1e-4 and (WL, HL) == (W, H) and abs(cxL - cxfrac) < 1e-6 and abs(bL - basefrac) < 1e-6
    if not same:   # feather the borders of the layer so that no seam can show
        xi = np.arange(WL); yi = np.arange(HL)
        fx = smoothstep(0, 0.08 * WL, np.minimum(xi, WL - 1 - xi)); fy = smoothstep(0, 0.07 * HL, HL - 1 - yi)
        a[..., 3] *= (fy[:, None] * fx[None, :]).astype(np.float32)
    pm = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    if abs(s - 1) > 1e-4:
        nw, nh = int(round(WL * s)), int(round(HL * s))
        pm = np.dstack([np.asarray(Image.fromarray(pm[..., k], 'F').resize((nw, nh), Image.LANCZOS)) for k in range(4)])
    nh, nw = pm.shape[:2]
    x0 = int(round(cxfrac * W - cxL * nw)); y0 = int(round(H - (basefrac * H - bL * nh) - nh))
    fg = np.zeros((H, W, 4), np.float32)
    xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + nw, W), min(y0 + nh, H)
    fg[ya:yb, xa:xb] = pm[ya - y0:yb - y0, xa - x0:xb - x0]
    if args.bgcolor or dark:
        hx = (args.bgcolor or '#0B0B0C').lstrip('#')
        bg = np.ones((H, W, 3), np.float32) * (np.array([int(hx[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0)
    else:
        t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        t = t * t * (3 - 2 * t)
        bg = (1 - t) * np.array([1, 1, 1], np.float32) + t * (np.array([247, 243, 234], np.float32) / 255.0)
    res = np.clip(fg[..., :3], 0, 1) + bg * (1 - np.clip(fg[..., 3:4], 0, 1))
    rng = np.random.default_rng(1)
    res = np.clip(res * 255.0 + rng.uniform(-0.5, 0.5, res.shape), 0, 255).round().astype(np.uint8)
    img = Image.fromarray(res, 'RGB')
    out = os.path.abspath(out); os.makedirs(os.path.dirname(out), exist_ok=True)
    base, ext = os.path.splitext(out)
    if ext.lower() in ('.jpg', '.jpeg'):
        img.save(out, quality=88, optimize=True, progressive=True)
    else:
        img.save(out)
    if webp:
        img.save(base + '.webp', quality=86, method=5)
    print('wrote %s %dx%d' % (out, W, H))


def frame_size():
    W, H, hfrac, cxfrac, basefrac = COMPS[args.comp]
    if args.res:
        W, H = (int(v) for v in args.res.lower().split('x'))
    return int(round(W * args.scale)), int(round(H * args.scale)), hfrac, cxfrac, basefrac


if args.use_layer:
    W, H, hfrac, cxfrac, basefrac = frame_size()
    compose(Image.open(args.use_layer), 'layer', W, H, hfrac, cxfrac, basefrac, args.bg == 'dark', args.out or 'out.jpg', not args.no_webp)
    sys.exit(0)

# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
dark = args.bg == 'dark'
if args.liquid in LIQUIDS:
    lcol, ldens = LIQUIDS[args.liquid]
else:
    lcol, ldens = tuple(float(v) for v in args.liquid.split(',')), 3.0
if args.density is not None:
    ldens = args.density

IOR_G, IOR_L = 1.52, 1.36
mats = {
    'glass': mat_glass('glass', IOR_G, 0.78),
    'liq_top': mat_glass('liq_top', IOR_L, 0.97, (lcol, ldens)),
    'liq_wall': mat_glass('liq_wall', IOR_L / IOR_G, 1.0, (lcol, ldens)),   # glass/perfume interface
    'gold': mat_gold(),
}

if args.logo.lower() != 'none':
    mats['logo'] = mat_logo(args.logo)
W, H, hfrac, cxfrac, basefrac = frame_size()

if args.comp == 'sizes':
    sc = [(50 / 100) ** (1 / 3), (75 / 100) ** (1 / 3), 1.0]
    wd = [0.68 * s for s in sc]; gap = 0.36
    xs = [-(wd[1] / 2 + gap + wd[0] / 2), 0.0, wd[1] / 2 + gap + wd[2] / 2]
    ztop = 0
    for i, (s_, x_) in enumerate(zip(sc, xs)):
        ztop = max(ztop, build_flacon('_%d' % i, s_, (x_, 0, 0), mats, args.fill))
    group_cx = ((xs[0] - wd[0] / 2) + (xs[2] + wd[2] / 2)) / 2
else:
    if args.design == 'arabisant':
        ztop = build_flacon('', 1.0, (0, 0, 0), mats, args.fill)
    else:
        DESIGNS[args.design](mats, args.fill)
        ztop = stopper_rings()[2] * CM      # keep the amphora's framing: all designs at one scale, on one base line
    group_cx = 0.0
    if args.turn:
        for ob in bpy.data.objects:
            if ob.name.split('.')[0] in ('glass', 'liquid', 'collar', 'stopper', 'emblem'):
                ob.rotation_euler = (0.0, 0.0, math.radians(args.turn))

# lights (emission cards, invisible to the camera)
tgt = (0, 0, 0.62)
warm = (1.0, 0.985, 0.955)
if not dark:
    if not args.transparent:
        softbox('backdrop', (0, 6.0, 2.2), (0, 0, 2.2), 7.6, 7.0, 3.0, warm, soft=0.14)
    else:  # alpha version: only a small glow behind the perfume, the rest of the glass stays see-through
        softbox('glow', (0, 1.5, 0.34), (0, -9.5, 1.8), 1.3, 0.75, 2.4, warm, soft=0.45, glossy=False, diffuse=False)
    softbox('key_left', (-4.3, -2.7, 2.5), tgt, 2.4, 4.8, 18.0, (1, 0.99, 0.975), soft=0.22)
    softbox('strip_right', (4.5, -1.3, 2.3), tgt, 0.95, 4.6, 24.0, (1, 0.995, 0.985), soft=0.25)
    softbox('top', (0, -0.4, 4.9), (0, 0, 0.6), 3.2, 3.2, 9.0, (1, 0.99, 0.975), soft=0.25)
    softbox('front_fill', (0, -11.5, 3.2), tgt, 9.0, 6.0, 0.8, warm, soft=0.2)
    world_strength = 0.035
else:
    softbox('rim_left', (-3.6, 3.3, 2.0), tgt, 1.2, 4.6, 42.0, (1, 0.98, 0.95), soft=0.22)
    softbox('rim_right', (3.6, 3.3, 2.0), tgt, 1.2, 4.6, 42.0, (1, 0.98, 0.95), soft=0.22)
    softbox('hair', (0, 2.2, 4.6), (0, 0, 1.1), 2.4, 1.4, 14.0, (1, 0.97, 0.93), soft=0.3)
    softbox('front_fill', (0, -11.5, 2.4), tgt, 10.0, 7.0, 1.3, (1, 0.97, 0.93), soft=0.2)
    softbox('floor_bounce', (0, -3.0, -0.6), (0, -3.0, 5.0), 9.0, 7.0, 2.2, (1, 0.97, 0.93), soft=0.3, trans=False, diffuse=False)
    softbox('top', (0, -0.6, 4.9), (0, 0, 0.9), 2.6, 2.6, 3.0, (1, 0.97, 0.93), soft=0.3)
    softbox('fill_left', (-4.4, -3.2, 2.6), tgt, 2.0, 4.6, 6.0, (1, 0.98, 0.95), soft=0.25)
    softbox('strip_right', (4.7, -1.7, 2.3), tgt, 0.6, 4.2, 9.0, (1, 0.98, 0.95), soft=0.25)
    softbox('glow', (0, 1.5, 0.34), (0, -9.5, 1.8), 1.5, 0.85, 3.2, (1, 0.97, 0.92), soft=0.45, glossy=False, diffuse=False)
    world_strength = 0.002

wld = bpy.data.worlds.new('world'); S.world = wld
try:
    wld.use_nodes = True
except Exception:
    pass
wld.node_tree.nodes.clear()
wo = wld.node_tree.nodes.new('ShaderNodeOutputWorld'); wb = wld.node_tree.nodes.new('ShaderNodeBackground')
wb.inputs['Color'].default_value = (1, 1, 1, 1); wb.inputs['Strength'].default_value = world_strength
wld.node_tree.links.new(wb.outputs[0], wo.inputs['Surface'])

reflect = args.reflect if args.reflect is not None else (0.16 if dark else 0.10)
ground(dark, reflect, args.transparent)

# camera: horizontal optical axis + lens shift (parallel verticals), seen from 7 degrees above
D, ELEV = 9.5, math.radians(7.0)
zc_cam = 0.62 + D * math.tan(ELEV)
M = max(W, H)
h_px = hfrac * H
focal = h_px * 36.0 * D / (ztop * M)
cam = bpy.data.cameras.new('cam'); cam.lens = focal; cam.sensor_width = 36.0; cam.sensor_fit = 'AUTO'
cam.clip_start = 0.5; cam.clip_end = 300
cam.shift_x = -(cxfrac - 0.5) * W / M
cam.shift_y = (-zc_cam / D) * (focal / 36.0) - (basefrac - 0.5) * H / M
co = bpy.data.objects.new('cam', cam); S.collection.objects.link(co); S.camera = co
co.location = (group_cx, -D, zc_cam); co.rotation_euler = (math.pi / 2, 0, 0)

# render settings
S.render.engine = 'CYCLES'
c = S.cycles
c.device = 'CPU'; c.samples = args.samples; c.seed = args.seed
c.use_adaptive_sampling = True; c.adaptive_threshold = args.noise
c.use_denoising = True; c.denoiser = 'OPENIMAGEDENOISE'
c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
try:
    c.denoising_prefilter = 'ACCURATE'
except Exception:
    pass
c.max_bounces = 12; c.diffuse_bounces = 3; c.glossy_bounces = 8; c.transmission_bounces = 12
c.volume_bounces = 0; c.transparent_max_bounces = 16
c.caustics_reflective = False; c.caustics_refractive = False
c.blur_glossy = 0.5; c.sample_clamp_indirect = 12.0; c.sample_clamp_direct = 0.0
S.render.film_transparent = True
c.film_transparent_glass = bool(args.transparent)
S.render.threads_mode = 'FIXED'; S.render.threads = args.threads
S.render.resolution_x = W; S.render.resolution_y = H; S.render.resolution_percentage = 100
S.view_settings.view_transform = 'AgX'
try:
    S.view_settings.look = args.look
except Exception as e:
    print('look not available:', e)
S.view_settings.exposure = args.exposure
S.render.image_settings.file_format = 'PNG'
S.render.image_settings.color_mode = 'RGBA'
S.render.image_settings.color_depth = '8'
tmp = os.path.join(tempfile.gettempdir(), 'nait_%d.png' % os.getpid())
S.render.filepath = tmp
print('scene built in %.1fs  %dx%d  focal %.0fmm  liquid/glass ior %.3f' % (
    time.time() - T0, W, H, focal, mats['liq_wall'].node_tree.nodes['Glass BSDF'].inputs['IOR'].default_value))
if args.turn_seq:          # the frames of the turning flacon: same scene, only the flacon's angle changes
    angles = [float(v) for v in args.turn_seq.split(',')]
    parts = [ob for ob in bpy.data.objects if ob.name.split('.')[0] in ('glass', 'liquid', 'collar', 'stopper', 'emblem')]
    os.makedirs(os.path.dirname(os.path.abspath(args.save_layer % 0)), exist_ok=True)
    for i, ang in enumerate(angles):
        t_ = time.time()
        for ob in parts:
            ob.rotation_euler = (0.0, 0.0, math.radians(ang))
        bpy.ops.render.render(write_still=True)
        Image.open(tmp).convert('RGBA').save(os.path.abspath(args.save_layer % i))
        print('frame %d  turn %+.4f  %.1fs' % (i, ang, time.time() - t_), flush=True)
    os.remove(tmp)
    sys.exit(0)
T1 = time.time()
bpy.ops.render.render(write_still=True)
print('render %.1fs' % (time.time() - T1))

# ----------------------------------------------------------------------------- output
im = Image.open(tmp).convert('RGBA')
if args.save_layer:
    lp_ = os.path.abspath(args.save_layer); os.makedirs(os.path.dirname(lp_), exist_ok=True)
    im.save(lp_); print('layer', lp_)
if args.out:
    if args.transparent:
        o = os.path.abspath(args.out); os.makedirs(os.path.dirname(o), exist_ok=True)
        im.save(os.path.splitext(o)[0] + '.png', optimize=True); print('wrote', os.path.splitext(o)[0] + '.png')
    else:
        compose(im, args.comp, W, H, hfrac, cxfrac, basefrac, dark, args.out, not args.no_webp)
os.remove(tmp)
print('total %.1fs' % (time.time() - T0))
