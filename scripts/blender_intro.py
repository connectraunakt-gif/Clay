import bpy, math, os, sys
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'.renders','clay');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=False
scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.render.fps=24;scene.frame_start=1;scene.frame_end=156
scene.world.color=(.7,.7,.7);scene.view_settings.view_transform='AgX'
def mat(name,color,rough=.45):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;return m
ink=mat('Graphite clay',(.055,.078,.10));floor=mat('Soft studio',(.92,.94,.96));colors=[mat('Block '+str(i),c) for i,c in enumerate([(.39,.53,.66),(.76,.40,.29),(.69,.72,.62),(.86,.69,.39),(.60,.68,.74),(.78,.57,.44),(.38,.49,.47),(.71,.76,.79),(.47,.57,.65)])]
def sphere(name,loc,r,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=r,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);bpy.ops.object.shade_smooth();return o
def rod(name,a,b,r=.075):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(ink);be=o.modifiers.new('Soft edges','BEVEL');be.width=.06;be.segments=3;bpy.ops.object.shade_smooth();return o
def pose(o,a,b,frame):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.scale.z=(b-a).length/o['length'];o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_euler',frame=frame);o.keyframe_insert('scale',frame=frame)
def animated_rod(name,a,b):
 o=rod(name,a,b);o['length']=(Vector(b)-Vector(a)).length;return o
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='Seamless floor';bpy.context.object.data.materials.append(floor)
# Nine chunky toy bricks, each with two studs, form a single 3 x 3 rectangle.
blocks=[]
for i in range(9):
 row,col=divmod(i,3);target=Vector((-.25+col*.81,0,.29+row*.57))
 bpy.ops.mesh.primitive_cube_add(size=1,location=target);o=bpy.context.object;o.name='Brick %02d'%(i+1);o.dimensions=(.78,.62,.51);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(colors[i]);bev=o.modifiers.new('Rounded toy edges','BEVEL');bev.width=.065;bev.segments=3;bpy.ops.object.shade_smooth_by_angle()
 for dx in [-.2,.2]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.10,depth=.055,location=target+Vector((dx,0,.28)));stud=bpy.context.object;stud.name='Brick stud';stud.data.materials.append(colors[i]);stud.parent=o;stud.matrix_parent_inverse=o.matrix_world.inverted();be=stud.modifiers.new('Rounded stud','BEVEL');be.width=.02;be.segments=2
 start=6+i*8;finish=start+7
 for f,loc,scale in [(1,(-2.1,-.1,.75),.001),(start-1,(-2.1,-.1,.75),.001),(start,(-2.1,-.1,.75),1),(start+3,(-1,-.05,2.15+row*.22),1),(finish,target,1),(94,target,1)]:
  o.location=loc;o.scale=(scale,)*3;o.keyframe_insert('location',frame=f);o.keyframe_insert('scale',frame=f)
 for f in range(95,157,2):
  t=(f-95)/24;vx=(col-1)*2.2+.9;vy=(i%3-1)*1.1+.25;vz=2.8+(i%2)*.65
  z=target.z+vz*t-4.9*t*t
  if z<.27:z=.27+abs(z+.1)*math.exp(-3*t)*.25
  o.location=(target.x+vx*t,target.y+vy*t,max(.27,z));o.rotation_euler=(t*(i+1)*.9,t*.8,t*(i-4)*.4);s=1 if f<125 else max(.001,(151-f)/26);o.scale=(s,s,s);o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f);o.keyframe_insert('scale',frame=f)
 blocks.append(o)
# A recognisable stick figure with a round head, slim body and articulated arms.
head=sphere('Head',(-2.5,0,2.25),.22,ink);torso=rod('Body',(-2.5,0,1),(-2.5,0,2));leg1=rod('Left leg',(-2.5,0,1),(-2.88,-.06,.13));leg2=rod('Right leg',(-2.5,0,1),(-2.15,.08,.13));left=animated_rod('Resting arm',(-2.5,0,1.8),(-2.85,0,1.18));upper=animated_rod('Upper working arm',(-2.5,0,1.8),(-2.15,-.05,1.45));lower=animated_rod('Lower working arm',(-2.15,-.05,1.45),(-1.9,-.05,1.35));hand=sphere('Hand',(-1.9,-.05,1.35),.09,ink)
for f in range(1,157):
 if f<79:
  i=min(8,max(0,(f-6)//8));row=i//3;u=max(0,min(1,(f-(6+i*8))/7));tip=Vector((-2.1*(1-u)+(-.25+(i%3)*.81)*u,-.38,.8*(1-u)+(.5+row*.57)*u+math.sin(u*math.pi)*1.2))
 elif f<89:tip=Vector((-1.65,-.1,1.35))
 elif f<94:tip=Vector((-3.05,-.05,2.05))
 elif f<102:tip=Vector((-.2,-.35,1.6))
 else:tip=Vector((-2.0,-.1,1.2))
 shoulder=Vector((-2.5,0,1.8));elbow=(shoulder+tip)/2+Vector((0,-.15,-.18));pose(upper,shoulder,elbow,f);pose(lower,elbow,tip,f);hand.location=tip;hand.keyframe_insert('location',frame=f)
for o in [head,torso,leg1,leg2,left,upper,lower,hand]:
 for f,s in [(1,1),(113,1),(132,.001),(156,.001)]:o.scale=(s,s,s);o.keyframe_insert('scale',frame=f)
# The supplied logo emerges behind the falling bricks; the background is made transparent in the material.
image=bpy.data.images.load(os.path.join(ROOT,'assets','logo.png'));image.pack()
m=bpy.data.materials.new('Original Clay logo');m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');mix=nodes.new('ShaderNodeMixShader');transparent=nodes.new('ShaderNodeBsdfTransparent');solid=nodes.new('ShaderNodeBsdfPrincipled');solid.inputs['Base Color'].default_value=(.055,.078,.10,1);solid.inputs['Roughness'].default_value=.4;tex=nodes.new('ShaderNodeTexImage');tex.image=image;gray=nodes.new('ShaderNodeRGBToBW');mask=nodes.new('ShaderNodeMath');mask.operation='GREATER_THAN';mask.inputs[1].default_value=.55
links=m.node_tree.links;links.new(tex.outputs['Color'],gray.inputs[0]);links.new(gray.outputs[0],mask.inputs[0]);links.new(mask.outputs[0],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(solid.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,1.65));logo=bpy.context.object;logo.name='Clay supplied logo';logo.data.materials.append(m)
bpy.ops.object.camera_add(location=(5,-11,5.4));cam=bpy.context.object;cam.rotation_euler=(Vector((-.15,0,1.2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=8.3;scene.camera=cam
logo.rotation_euler=(cam.location-logo.location).to_track_quat('Z','Y').to_euler()
for f,s in [(1,.001),(105,.001),(128,1),(156,1)]:logo.scale=(4.4*s,2.475*s,s);logo.keyframe_insert('scale',frame=f)
for name,loc,power,size in [('Large softbox',(-3,-4,7),400,5),('Fill',(5,-1,6),250,4),('Rim',(0,5,6),350,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(OUT,'frame_');scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'animation','clay-intro.blend'),compress=True)
if '--preview' in sys.argv:
 for f in [40,80,135]:scene.frame_set(f);scene.render.filepath=os.path.join(OUT,'preview-%03d.png'%f);bpy.ops.render.render(write_still=True)
else:
 scene.render.filepath=os.path.join(OUT,'frame_');bpy.ops.render.render(animation=True)
