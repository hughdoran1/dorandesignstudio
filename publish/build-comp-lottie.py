#!/usr/bin/env python3
"""Finish Competition.json -> CompetitionLottie.json + .js (Pairwise tournament, DDS home 1x1 card).
Re-run after re-exporting Competition.json from AE: python3 publish/build-comp-lottie.py, then regenerate the .js (see below).

Story (fr=30, op=180):
  0-58    bracket builds in (staggered node pops + connector draw-ons)
  62-70   quarter-finals resolve  (winner fills+grows, loser shrinks+dims)
  78-86   semi-finals resolve
  94-102  final resolves
  106-118 tree dims back, trophy pops centre stage (+sparkle ticks)
  118-172 hold
  172-180 global fade out (loop point)
"""
import json, copy

SRC = '/Users/dorandesignstudio/Test/Competition.json'
DST = '/Users/dorandesignstudio/Test/CompetitionLottie.json'

BLUE = [0.20000000298, 0.40000000596, 1, 1]
OP = 180
Q, S, F, T = 62, 78, 94, 106          # resolution beats
FADE0, FADE1 = 172, 180

QTR_WIN,  QTR_LOSE  = [26, 24, 21, 19], [25, 23, 22, 20]
SEMI_WIN, SEMI_LOSE = [13, 8], [14, 9]
FIN_WIN,  FIN_LOSE  = [1], [2]
NODES = QTR_WIN + QTR_LOSE + SEMI_WIN + SEMI_LOSE + FIN_WIN + FIN_LOSE
CONNECTORS = [3, 4, 5, 6, 7, 10, 11, 12, 15, 16, 17, 18]
CHAIN = [19, 16, 8, 5, 1]             # champion's path: qtr -> con -> semi -> con -> final

def ease(n=1):
    return {'i': {'x': [0.35] * n, 'y': [1] * n}, 'o': {'x': [0.45] * n, 'y': [0] * n}}

def kf(t, vals):
    n = len(vals)
    return {**copy.deepcopy(ease(n)), 't': t, 's': vals}

def anim(frames):                      # frames: list of (t, [vals])
    return {'a': 1, 'k': [kf(t, v) for t, v in frames]}

def scale_track(pop_t, beats):
    """beats: list of (t, target) applied after the pop-in."""
    fr = [(pop_t, [0, 0, 100]), (pop_t + 6, [112, 112, 100]), (pop_t + 9, [100, 100, 100])]
    cur = 100
    for t, target in beats:
        fr.append((t, [cur, cur, 100]))
        if target > cur:               # win: overshoot
            fr.append((t + 5, [target + 8, target + 8, 100]))
            fr.append((t + 8, [target, target, 100]))
        else:                          # lose: settle down
            fr.append((t + 6, [target, target, 100]))
        cur = target
    return anim(fr)

def opacity_track(segments):
    """segments: list of (t, value); adds the global fade tail."""
    fr = [(t, [v]) for t, v in segments]
    last = segments[-1][1] if segments else 100
    fr.append((FADE0, [last]))
    fr.append((FADE1, [0]))
    return anim(fr)

def win_fill(beat):
    return {'ty': 'fl', 'c': {'a': 0, 'k': BLUE, 'ix': 4},
            'o': anim([(0, [0]), (beat, [0]), (beat + 7, [100])]),
            'r': 1, 'bm': 0, 'nm': 'WinFill', 'mn': 'ADBE Vector Graphic - Fill', 'hd': False}

def draw_on(ip):
    return {'ty': 'tm', 's': {'a': 0, 'k': 0, 'ix': 1},
            'e': anim([(ip, [0]), (ip + 9, [100])]),
            'o': {'a': 0, 'k': 0, 'ix': 3}, 'm': 1, 'nm': 'DrawOn', 'mn': 'ADBE Vector Filter - Trim', 'hd': False}

def group_items(layer):
    for sh in layer.get('shapes', []):
        if sh.get('ty') == 'gr':
            return sh['it']
    return None

with open(SRC) as f:
    d = json.load(f)

d['nm'] = 'Pairwise Tournament'
d['op'] = OP

for l in d['layers']:
    ind, ip = l['ind'], l['ip']
    l['op'] = OP
    items = group_items(l)

    if ind in NODES:
        beats, ops = [], [(0, 100)]
        if ind in QTR_WIN:    beats.append((Q, 112))
        if ind in QTR_LOSE:   beats.append((Q, 84)); ops.append((Q, 100)); ops.append((Q + 6, 45))
        if ind in SEMI_WIN:   beats.append((S, 112))
        if ind in SEMI_LOSE:  beats.append((S, 84)); ops.append((S, 100)); ops.append((S + 6, 45))
        if ind in FIN_WIN:    beats.append((F, 122))
        if ind in FIN_LOSE:   beats.append((F, 84)); ops.append((F, 100)); ops.append((F + 6, 45))
        # trophy beat: the cup takes the stage — champion chain keeps a readable glow, the rest recedes
        last = ops[-1][1]
        ops.append((T, last)); ops.append((T + 10, 55 if ind in CHAIN else 26))
        l['ks']['s'] = scale_track(ip, beats)
        l['ks']['o'] = opacity_track(ops)
        # fills for round winners
        if items is not None:
            beat = Q if ind in QTR_WIN else S if ind in SEMI_WIN else F if ind in FIN_WIN else None
            if beat is not None:
                st_i = next((i for i, it in enumerate(items) if it.get('ty') == 'st'), len(items))
                items.insert(st_i, win_fill(beat))

    elif ind in CONNECTORS:
        if items is not None:
            st_i = next((i for i, it in enumerate(items) if it.get('ty') == 'st'), len(items))
            items.insert(st_i, draw_on(ip))
        ops = [(0, 100), (T, 100), (T + 10, 55 if ind in CHAIN else 26)]
        l['ks']['o'] = opacity_track(ops)

# ---------------- Trophy (authored) ----------------
def v(x, y): return [x, y]

def shape_path(verts, closed, in_t=None, out_t=None):
    n = len(verts)
    return {'ty': 'sh', 'd': 1,
            'ks': {'a': 0, 'k': {'i': in_t or [[0, 0]] * n, 'o': out_t or [[0, 0]] * n,
                                 'v': verts, 'c': closed}, 'ix': 2},
            'nm': 'Path', 'mn': 'ADBE Vector Shape - Group', 'hd': False}

def fill():
    return {'ty': 'fl', 'c': {'a': 0, 'k': BLUE, 'ix': 4}, 'o': {'a': 0, 'k': 100, 'ix': 5},
            'r': 1, 'bm': 0, 'nm': 'Fill', 'mn': 'ADBE Vector Graphic - Fill', 'hd': False}

def stroke(w=6.672):
    return {'ty': 'st', 'c': {'a': 0, 'k': BLUE, 'ix': 3}, 'o': {'a': 0, 'k': 100, 'ix': 4},
            'w': {'a': 0, 'k': w, 'ix': 5}, 'lc': 2, 'lj': 2, 'ml': 10, 'bm': 0,
            'nm': 'Stroke', 'mn': 'ADBE Vector Graphic - Stroke', 'hd': False}

def tr():
    return {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0], 'ix': 2}, 'a': {'a': 0, 'k': [0, 0], 'ix': 1},
            's': {'a': 0, 'k': [100, 100], 'ix': 3}, 'r': {'a': 0, 'k': 0, 'ix': 6},
            'o': {'a': 0, 'k': 100, 'ix': 7}, 'sk': {'a': 0, 'k': 0, 'ix': 4},
            'sa': {'a': 0, 'k': 0, 'ix': 5}, 'nm': 'Transform'}

def grp(nm, its):
    return {'ty': 'gr', 'it': its + [tr()], 'nm': nm, 'np': len(its) + 1, 'cix': 2, 'bm': 0,
            'ix': 1, 'mn': 'ADBE Vector Group', 'hd': False}

# the trophy is the REAL Graffold asset (A_Trophy_DDSWebsite.c4d, project DDSWebsite) — its S3 render
# keyed off its black matte + cropped by this repo's files/trophy-graffold pipeline, embedded self-contained
import base64, struct
IMG = '/Users/dorandesignstudio/Test/files/trophy-graffold.webp'
with open(IMG, 'rb') as f:
    raw = f.read()
b64 = base64.b64encode(raw).decode()
IW, IH = 292, 440
d.setdefault('assets', []).append({'id': 'trophyimg', 'w': IW, 'h': IH, 'u': '', 'p': 'data:image/webp;base64,' + b64, 'e': 1})

trophy = {
    'ddd': 0, 'ind': 100, 'ty': 2, 'nm': 'Trophy', 'refId': 'trophyimg', 'sr': 1,
    'ks': {
        'o': anim([(T, [0]), (T + 4, [100]), (FADE0, [100]), (FADE1, [0])]),
        'r': {'a': 0, 'k': 0, 'ix': 10},
        'p': anim([(T, [540, 640, 0]), (T + 9, [540, 610, 0])]),
        'a': {'a': 0, 'k': [IW / 2, IH - 14, 0], 'ix': 1},   # bottom-centre of the plinth (12px crop margin + feather)
        's': anim([(T, [0, 0, 100]), (T + 7, [118, 118, 100]), (T + 11, [105, 105, 100])]),   # HERO scale — ~460px on canvas, the cup owns the card
    },
    'ao': 0,
    'ip': T, 'op': OP, 'st': 0, 'bm': 0,
}

# sparkle ticks: 4 short strokes radiating from the cup rim, flashing right after the pop
sparks = []
for i, (sx, sy, ex, ey) in enumerate([(-175, -395, -200, -428), (175, -395, 200, -428),
                                      (-112, -452, -126, -486), (112, -452, 126, -486)]):
    t0 = T + 6 + i
    sparks.append({
        'ddd': 0, 'ind': 110 + i, 'ty': 4, 'nm': f'Spark{i}', 'sr': 1,
        'ks': {
            'o': anim([(t0, [0]), (t0 + 3, [100]), (t0 + 10, [100]), (t0 + 15, [0])]),
            'r': {'a': 0, 'k': 0, 'ix': 10},
            'p': {'a': 0, 'k': [540, 610, 0], 'ix': 2},
            'a': {'a': 0, 'k': [0, 0, 0], 'ix': 1},
            's': {'a': 0, 'k': [100, 100, 100], 'ix': 6},
        },
        'ao': 0,
        'shapes': [grp('Tick', [shape_path([v(sx, sy), v(ex, ey)], False), stroke(7.5)])],
        'ip': t0, 'op': t0 + 16, 'st': 0, 'bm': 0,
    })

d['layers'] = [trophy] + sparks + d['layers']

with open(DST, 'w') as f:
    json.dump(d, f, separators=(',', ':'))
print('wrote', DST, len(json.dumps(d)) // 1024, 'KB,', len(d['layers']), 'layers')

# regenerate the deferred-script wrapper the site actually loads
with open(DST) as f:
    payload = f.read()
with open('/Users/dorandesignstudio/Test/CompetitionLottie.js', 'w') as f:
    f.write('window.COMP_LOTTIE=' + payload + ';\n')
print('wrote CompetitionLottie.js')
