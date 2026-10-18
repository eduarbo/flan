"""Case outline rule shared by revI and the Flan variants (left half, KiCad mm, y down).

Column plateaus sit MARGIN beyond each column's top and pinky-bottom switch cut, step at
each column change and drop to the electronics bay; the bay's outer flank is a straight
LCD-aligned face; the thumb faces are offset parallel to each thumb key and joined by
their intersections; a recess runs under the middle columns. Every corner is then a
locally bounded tangent round (rounded()). Fasteners are deliberately not inputs.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import math

# K32's unchanged hot-swap pad reaches 9.575 mm from its center:
# 9.575 - 7 + 1.65 PCB inset + .5 copper rule = 4.725 mm minimum.
MARGIN = 4.75
THUMB_MARGIN = 4.75
CORNER_RADIUS = 2.4
CONCAVE_RADIUS = 1.3
FLANK_X = 135          # the LCD flank, independent of fasteners and key transforms
BAY_TOP = 11
BAY_BOTTOM = 67

def intersect(a,b,c,d):
    u=[b[i]-a[i] for i in (0,1)];v=[d[i]-c[i] for i in (0,1)]
    w=[c[i]-a[i] for i in (0,1)]
    t=(w[0]*v[1]-w[1]*v[0])/(u[0]*v[1]-u[1]*v[0])
    return [a[i]+t*u[i] for i in (0,1)]

def rounded(points,radius):
    corners=[]
    radii=[radius]*len(points) if isinstance(radius,(int,float)) else list(radius)
    trims=[]
    for i,v in enumerate(points):
        a=points[i-1];b=points[(i+1)%len(points)]
        u=[v[j]-a[j] for j in (0,1)];w=[b[j]-v[j] for j in (0,1)]
        turn=math.atan2(u[0]*w[1]-u[1]*w[0],sum(x*y for x,y in zip(u,w)))
        trims.append(radii[i]*math.tan(abs(turn)/2))
    # Bound adjacent trims together: short column steps retain a straight face.
    for i,v in enumerate(points):
        length=math.dist(v,points[i-1])
        if trims[i]+trims[i-1]>length-.05:
            scale=(length-.05)/(trims[i]+trims[i-1])
            for j in (i,i-1):trims[j]*=scale;radii[j]*=scale
    for i,v in enumerate(points):
        a=points[i-1];b=points[(i+1)%len(points)]
        u=[v[j]-a[j] for j in (0,1)];w=[b[j]-v[j] for j in (0,1)]
        lu=math.hypot(*u);lw=math.hypot(*w);u=[x/lu for x in u];w=[x/lw for x in w]
        turn=math.atan2(u[0]*w[1]-u[1]*w[0],sum(x*y for x,y in zip(u,w)))
        radius=radii[i];t=trims[i]
        start=[v[j]-u[j]*t for j in (0,1)];end=[v[j]+w[j]*t for j in (0,1)]
        sign=1 if turn>0 else -1
        center=[start[0]-u[1]*radius*sign,start[1]+u[0]*radius*sign]
        angle=math.atan2(start[1]-center[1],start[0]-center[0])
        at=lambda f:[center[0]+radius*math.cos(angle+turn*f),center[1]+radius*math.sin(angle+turn*f)]
        corners.append({'start':start,'mid':at(.5),'end':end,'samples':[at(j/16) for j in range(17)]})
    outline=[p for c in corners for p in c['samples']]
    return outline,[{'start':c['start'],'mid':c['mid'],'end':c['end']} for c in corners]

def control_outline(keys, margin=MARGIN):
    """Control vertices and corner radii of a left half from its keys.

    Finger columns are every non-thumb column; a column's top is its highest key (the
    number row when present) and the pinky columns (col <= 1) keep their own bottom faces.
    Returns (points, radii) with the revI corner rule: 2.4 mm convex, 1.3 mm concave, 35 mm
    at the shallow thumb joins, 3 and 4 mm where the recess meets the thumb and pinky faces."""
    d=7+margin;key={k['ref']:k for k in keys}
    cols=sorted({k['col'] for k in keys if k['row']!=3})
    top=[key.get(f'K4{c}',key[f'K0{c}']) for c in cols]
    bottom=[key[f'K2{c}'] for c in cols if c<=1][::-1]          # col 1, then the outer column
    tags={}
    points=[[top[0]['x']-d,top[0]['y']-d]]
    for a,b in zip(top,top[1:]):
        if a['y']==b['y']:
            continue
        x=b['x']-d if b['y']<a['y'] else a['x']+d
        points.extend([[x,a['y']-d],[x,b['y']-d]])
    points += [[top[-1]['x']+d,top[-1]['y']-d],[top[-1]['x']+d,BAY_TOP],[FLANK_X,BAY_TOP],[FLANK_X,BAY_BOTTOM]]
    thumbs=[]
    for k in [key[f'K3{c}'] for c in range(3)]:
        t=7+THUMB_MARGIN
        a=-math.radians(k['angle'])
        thumbs.append([[k['x']+x*math.cos(a)-y*math.sin(a),
                        k['y']+x*math.sin(a)+y*math.cos(a)]
                       for x,y in [(t,-t),(t,t),(-t,t),(-t,-t)]])
    south=[intersect(a[1],a[2],b[1],b[2]) for a,b in zip(thumbs,thumbs[1:])]
    recess=key['K22']['y']+7+THUMB_MARGIN
    # the outer thumb corner lands on the LCD flank; the bay's lower corner becomes collinear
    points[-1]=intersect(thumbs[2][0],thumbs[2][1],[FLANK_X,0],[FLANK_X,150])
    n=len(points)
    tags.update({n+1:'thumb join',n+2:'thumb join',n+4:'recess at thumb',n+5:'recess at pinky'})
    points += [thumbs[2][1],south[1],south[0],thumbs[0][2],
               intersect(thumbs[0][2],thumbs[0][3],[0,recess],[160,recess]),
               [bottom[0]['x']+d,recess],[bottom[0]['x']+d,bottom[0]['y']+d]]
    for a,b in zip(bottom,bottom[1:]):
        if a['y']==b['y']:
            continue
        x=a['x']-d if b['y']<a['y'] else b['x']+d
        points.extend([[x,a['y']+d],[x,b['y']+d]])
    points.append([bottom[-1]['x']-d,bottom[-1]['y']+d])
    radii=[]
    for i,v in enumerate(points):
        a=points[i-1];b=points[(i+1)%len(points)]
        turn=(v[0]-a[0])*(b[1]-v[1])-(v[1]-a[1])*(b[0]-v[0])
        radii.append(CORNER_RADIUS if turn>0 else CONCAVE_RADIUS)
    for i,tag in tags.items():
        radii[i]={'thumb join':35,'recess at thumb':3,'recess at pinky':4}[tag]
    return points,radii
