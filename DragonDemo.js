// Dragon Demo - This is the main file for the dragon animation. This could also be just a base to test various systems(particles, simulation)
// and have the real animation be in a different file for the final.

import {tiny, defs} from './examples/common.js';
import {Hermit_spline, Curve_Shape }from './hermit.js';
import {SpringMass }from './simulation.js';
import { Fabrik } from './fabrik.js'; // Forward And Backward Reaching Inverse Kinematics just for testing 
import { SpringMassDragon, FabrikDragon } from './Dragon.js'; // Import dragon types???
import { Particle } from './Particles.js';
import { VectorField } from './VectorField.js';
import { ThermoBox } from './MeltingBox.js'


// Pull these names into this module's scope for convenience:
// const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;
const { vec3, vec4, color, Mat4, Shape, Shader, Texture, Component } = tiny;

const {Renderer, Entity, Camera, Light, Material} = defs

export
const DragonDemoBase = defs.DragonDemoBase =
    class DragonDemoBase extends Component
    {                                          
      init()
      {
        console.log("init")

        // constructor(): 
        this.hover = this.swarm = false;

        this._debug_fire = false;
        
        
        //  ----- Set the Settings ----
        this.settings.backgroundColor = [0.0, 0.41, 0.58, 1]; // vec4 (0.0, 0.41, 0.58, 1.0)
        this.settings.LightColor = [0.95, 0.7, 0.45, 1];
        this.settings.FOV = 45;
        
        // Debug
        this._debug_precision = 1;
        this.move_direction = vec3(0, 0, 0);
        this.is_moving = 0;
        this.wiggle_factor = 0;

        const row_operation_2    = (s,p)   => vec3(    -1,2*s-1,Math.random()/2 );
        const column_operation_2 = (t,p,s) => vec3( 2*t-1,2*s-1,Math.random()/2 );

//         const rows = 100;
//         const columns = 100;
//         const heightScale = 50; // Adjust for height

// // 1. Generate Raw Random Heights
// const rawHeights = [];
// for (let i = 0; i < rows; i++) {
//     rawHeights[i] = [];
//     for (let j = 0; j < columns; j++) {
//         rawHeights[i][j] = Math.random() * heightScale;
//     }
// }

// // 2. Apply Moving Average
// const smoothedHeights = [];
// for (let i = 0; i < rows; i++) {
//     smoothedHeights[i] = [];
//     for (let j = 0; j < columns; j++) {
//         let sum = 0;
//         let count = 0;

//         // Collect neighboring heights
//         for (let ni = i - 1; ni <= i + 1; ni++) {
//             for (let nj = j - 1; nj <= j + 1; nj++) {
//                 if (ni >= 0 && ni < rows && nj >= 0 && nj < columns) {
//                     sum += rawHeights[ni][nj];
//                     count++;
//                 }
//             }
//         }

//         smoothedHeights[i][j] = sum / count;
//     }
// }

// const row_operation_2 = (s, p) => {
//     const x = 2 * s - 1;
//     const i = Math.floor(s * (rows - 1)); // Map s to row index
//     const j = 0; //First column
//     const y = smoothedHeights[i][j];
//     const z = 0;

//     return vec3(x, y, z);
// };

// const column_operation_2 = (t, p, s) => {
//     const x = 2 * t - 1;
//     const i = Math.floor(s * (rows - 1)); // Map s to row index.
//     const j = Math.floor(t * (columns - 1)); //map t to column index.
//     const y = smoothedHeights[i][j];
//     const z = 0;

//     return vec3(x, y, z);
// };
        
        // *** Shapes: ***At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.
        this.shapes = {
          'box'  : new defs.Cube(),
          'square'  : new defs.Square(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows(),
          'cylinder' : new defs.Cylindrical_Tube(), // these dragon models are temporary!!!!!
          'body' : new defs.Shape_From_File("assets/dragon_body.obj"), // these dragon models are temporary!!!!!
          'head' : new defs.Shape_From_File("assets/dragon.obj"),
          'leg' : new defs.Shape_From_File("assets/dragon_leg.obj"),
          'tail' : new defs.Shape_From_File("assets/dragon_tail.obj"),
          'teapot' : new defs.Shape_From_File("assets/teapot.obj"),
          'sky' : new defs.Shape_From_File("assets/sky_dome.obj"),
          'clouds' : new defs.Shape_From_File("assets/sky_dome_cloud.obj"),
          'LargeRock1' : new defs.Shape_From_File("assets/LargeRock1.obj"),
          'island' : new defs.Shape_From_File("assets/island.obj"),
          'terrain': new defs.terrain(10, 10, 50, 0.1),
          'sheet2': new defs.Grid_Patch( 100, 100, row_operation_2, column_operation_2 ),
        };

        // *** Materials: ***  Basic_Shader() Phong_Shader() Textured_Phong() Fake_Bump_Map()
        this.materials = {
          // Colors
          plastic : { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) },
          metal   : { shader: new defs.Phong_Shader2(), ambient: .2, diffusivity: 1, specularity:  0.1, colors: color( .9,.5,.9,1 ) },
          // Textures
          rgb : { shader: new defs.Fake_Bump_Map(), ambient: .1, texture: new Texture( "assets/rgb.jpg" ) },
          grid : { shader: new defs.Fake_Bump_Map(), ambient: .1, texture: new Texture( "assets/grid.png" ) },
          sky : { shader: new defs.SkyShader(), ambient: 1, texture: new Texture( "assets/doom_sky.jpeg" ), 
            distort: new Texture( "assets/T_noise_01_normal.PNG" ), 
          },
          // sky : { shader: new defs.SkyShader(), ambient: 0.9, texture: new Texture( "assets/doom_sky.jpeg" ), 
          //   distort: new Texture( "assets/T_noise_01_normal.PNG" ), 
          // },
          // sky : { shader: new defs.Fake_Bump_Map(), ambient: 0.9, texture: new Texture( "assets/doom_sky.png" ) },
          clouds : { shader: new defs.Clouds(), ambient: 2, texture: new Texture( "assets/Clouds.png" ) },
          grass : { shader: new defs.Grass(), ambient: .5, diffusivity: 1, specularity: 0.1, texture: new Texture( "assets/grass.jpg" ) },
          water : { shader: new defs.Scroll_Fog_Shader(), ambient: .5, diffusivity: 0.6, specularity: 2, 
                  texture: new Texture( "assets/water.png" ), 
                  distort: new Texture( "assets/T_noise_01_normal.PNG" ), 
                },
          dragon : { shader: new defs.Fog_Shader(), ambient: .5, texture: new Texture( "assets/EDragon_Body.png" ) },
          gold : { shader: new defs.PhongNShader(), ambient: 0.5, 
                  albedoMap: new Texture( "assets/T_Metal_Gold_D.PNG" ), 
                  normalMap: new Texture( "assets/EDragon_Body.png" ), 
                },
          Brick : { shader: new defs.PhongNShader(), ambient: 0.5, 
                  albedoMap: new Texture( "assets/T_Brick_Cut_Stone_D.PNG" ), 
                  normalMap: new Texture( "assets/T_Brick_Cut_Stone_N.PNG" ), 
                },
          LargeRock1 : { shader: new defs.PhongNShader(), ambient: 0.5, 
                  albedoMap: new Texture( "assets/LargeRock1_Bake1_pbr_diffuse.PNG" ), 
                  normalMap: new Texture( "assets/LargeRock1_Bake1_pbr_normal.PNG" ), 
                },
          Rock : { shader: new defs.PhongNShader(), ambient: .2, diffusivity: 1, specularity: 0.5,
                  albedoMap: new Texture( "assets/MaterialGrassMat_diffuse.PNG" ), 
                  normalMap: new Texture( "assets/MaterialRockMat_normal.PNG" ), 
                },
          grass2 : { shader: new defs.Grass2(), ambient: .5, diffusivity: 1, specularity: 0.1,
                  albedoMap: new Texture( "assets/MaterialGrassMat_diffuse.PNG" ), 
                  normalMap: new Texture( "assets/MaterialGrassMat_diffuse.PNG" ), 
                },
          island : { shader: new defs.PhongNShader(), ambient: .5, diffusivity: 1, specularity: 0.5,
                  albedoMap: new Texture( "assets/island_baseColor.jpeg" ), 
                  normalMap: new Texture( "assets/island_normal.png" ), 
                },

          dust : { shader: new defs.Textured_Phong(), ambient: .5, texture: new Texture( "assets/T_Dust_Particle_D.PNG" ) },
          explosion : { shader: new defs.AnimatedShader(), ambient: 1, speed: 100.0, rows: 6.0, cols: 6.0,
                  texture: new Texture( "assets/T_Explosion_SubUV.PNG" )},
          smoke : { shader: new defs.AnimatedShader(), ambient: 1, speed: 10.0, rows: 8.0, cols: 8.0,
                  texture: new Texture( "assets/T_Smoke_SubUV.PNG" )},
          fire : { shader: new defs.FireShader(), ambient: 2, speed: 50.0, 
                  textured: new Texture( "assets/T_Fire_SubUV.PNG" ), 
                  texturea: new Texture( "assets/T_Fire_Tiled_D.PNG" ),
                  distort: new Texture( "assets/T_noise_01_normal.PNG" ), 
                },
          // Debug/shows silhouette but not model 
          invisible : { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color( 0, 0, 0, 0 ) },

        };

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // Spline
        const controlPoints = [
          { x: -50, y: 10, z: 0 }, 
          { x: -50, y: 10, z: 50 }, 
          { x: 50, y: 4, z: 50 }, 
          { x: 50, y: 6, z: 0 },  
          { x: 0, y: 7, z: -50 },
          { x: -50, y: 10, z: 0 }, 
      ];
      
      const tangents = [
          { sx: -29, sy: 0, sz: 29 },
          { sx: 29, sy: 0, sz: 29 },  
          { sx: 29, sy: 0, sz: -29 }, 
          { sx: -29, sy: 0, sz: -29 }, 
          { sx: -29, sy: 0, sz: 29 },
          { sx: -29, sy: 0, sz: 29 },  
      ];

        this.spline = new Hermit_spline(controlPoints, tangents);
        this.curve_fn = (t) => this.spline.computePoint(t)
        this.sample_cnt = 1000;
        this.curve = new Curve_Shape(this.curve_fn, this.sample_cnt);
        const point = this.spline.computePoint(0.5);
        // console.log(point); // { x: 0.5, y: 0.5, z: 0.5 }

        /************************************* Particle Spring dragon implementation ****************************************/
        // this.dragon1 = new SpringMassDragon(this.shapes, this.materials);

        /************************************* Fabrik dragon implementation ****************************************/
        // Suppose you want a chain starting at (0, 10, 0) with 10 segments:
        this.dragon2 = new FabrikDragon(this.shapes, this.materials);

        // World particles from fire
        this.max_num_particles = 500;
        // this.fire_particles = Array(this.max_num_particles);
        this.fire_particles = []

        this.thermo_box = new ThermoBox(100);
        // this.thermo_box = new ThermoBox(0.0000000000001);
        // this.thermo_box.U[0][1][1] = 100;
        // this.thermo_box.U[1][0][1] = 100;
        // this.thermo_box.U[1][1][0] = 100;
        

        this.d_t = 0.01;
        this.gravity = 9.8
        this.gks = 100;
        this.gkd = 10;
        this.particle_lifetime = 0.7; // In seconds.
        this.start = false;
      }

      // // Mass distribution: Heavier in the middle, tapering at both ends.
      // computeMass(i, numParticles) {
      //   // Using a quadratic curve centered on the middle of the chain.
      //   let mid = (numParticles - 1) / 2;
      //   let distance = Math.abs(i - mid);
      //   // Maximum mass at the center, lower at the ends.
      //   const maxMass = 100;
      //   const minMass = 7000;
      //   // Interpolate: when distance = 0 -> maxMass, when distance = mid -> minMass.
      //   return maxMass - (maxMass - minMass) * (distance / mid);
      // }

      // // Spring properties: Stiffer in the middle, softer at the tail.
      // computeSpringConstants(i, numParticles) {
      //   // We'll vary based on the link index (0 to numParticles-2)
      //   const ksStart = 1000; // near head
      //   const ksMid = 900;   // stiffer midsection (for a solid body)
      //   const ksEnd = 500;   // softer tail
      //   const kdStart = 1000;
      //   const kdMid = 1000;
      //   const kdEnd = 500;
        
      //   let t;
      //   let ks, kd;
      //   if(i < numParticles / 2) {
      //     // Interpolate from head to midsection:
      //     t = i / (numParticles / 2);
      //     ks = ksStart * (1 - t) + ksMid * t;
      //     kd = kdStart * (1 - t) + kdMid * t;
      //   } else {
      //     // Interpolate from midsection to tail:
      //     t = (i - numParticles / 2) / (numParticles / 2);
      //     ks = ksMid * (1 - t) + ksEnd * t;
      //     kd = kdMid * (1 - t) + kdEnd * t;
      //   }
      //   return { ks, kd };
      // }


      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Assignment2, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls ){ 
          this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          this.animated_children.push( caller.debug = new defs.Debug_Info( { uniforms: this.uniforms } ) );
          // { this.animated_children.push( caller.controls = new defs.Movement_Controls_2( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          // TODO: you can change the camera as needed.
          Shader.assign_camera( Mat4.look_at (vec3 (0, 20, 0), vec3 (0, 20, 30), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( this.settings.FOV * Math.PI/180, caller.width/caller.height, 1, 1000 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20, 20, 20, 1.0);
        const light_color = color(this.settings.LightColor[0], this.settings.LightColor[1], this.settings.LightColor[2], this.settings.LightColor[3])
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, light_color, 1000000 ) ];
        // this.shapes.ball.draw( caller, this.uniforms, Mat4.translation(20, 20, 20), this.materials.water);

        this.uniforms.lights.push(defs.Phong_Shader.light_source( vec4(20 + Math.sin(t), 10+ Math.sin(t), 30+ Math.sin(t), 0.0), color( 0.1,1,1,1 ), 1000 ) )
        // this.shapes.head.draw( caller, this.uniforms, Mat4.translation(20, 10, 30), this.materials.water);

        // this._debug_fps = caller.fps;

        // draw axis arrows.
        // this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


export class DragonDemo extends DragonDemoBase
{    
  // See the other piece, My_Demo_Base, if you need to see the setup code.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.
    // console.log(caller);
    // Call the setup code that we left inside the base class:
    super.render_animation( caller );
    this.move_direction = this.animated_children[0].thrust;
    // console.log(this.move_direction);
    this.is_moving = this.move_direction.norm() > 0;

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 ), red = color(1, 0, 0, 1);
    const fire_orange = color(1, 0.25098039215, 0, 1);
    const smokey = color(0.23137254902, 0.23137254902, 0.21960784313, 1);
    let color_dir = smokey.minus(fire_orange);

    const t = this.t = this.uniforms.animation_time/1000.0;
    this.uniforms.projection_transform = Mat4.perspective( this.settings.FOV * Math.PI/180, caller.width/caller.height, 1, 1000 );

    // !!! Draw ground
    // let floor_transform = Mat4.translation(150, 1, 0).times(Mat4.scale(50, 0.01, 50));
    let floor_transform = Mat4.translation(1, 1, 150).times(Mat4.scale(100, 0.01, 100));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, this.materials.water);
    this.shapes.box.draw( caller, this.uniforms, Mat4.translation(0, 0, 0).times(Mat4.scale(1000, 0.01, 1000)), this.materials.grass);

    this.shapes.island.draw( caller, this.uniforms, Mat4.translation(-50, 1, 150).times(Mat4.scale(100, 200, 100)), this.materials.island);

    this.shapes.sheet2.draw( caller, this.uniforms, Mat4.translation(0, 0, 0).times(Mat4.rotation(1.5, 1, 0, 0)).times(Mat4.scale(1000,1000, 10)), this.materials.Rock);



    const sky_pos = Mat4.extractPositionFromMatrix(this.uniforms.camera_transform);
    // this.shapes.box.draw( caller, this.uniforms, Mat4.translation(0, 1, 0).times(Mat4.scale(1, 1, 1)), this.materials.Brick );
    // this.shapes.box.draw( caller, this.uniforms, Mat4.translation(-3, 1, -3).times(Mat4.scale(50, 10, 1)), this.materials.gold );

    this.shapes.sky.draw( caller, this.uniforms, Mat4.translation(sky_pos[0], sky_pos[1]+300, sky_pos[2]).times(Mat4.scale(400, 400, 400)), this.materials.sky );
    
    // this.shapes.sky.draw( caller, this.uniforms, Mat4.translation(sky_pos[0], sky_pos[1], sky_pos[2]).times(Mat4.scale(400, 400, 400)), this.materials.grass );
    // this.shapes.clouds.draw( caller, this.uniforms, Mat4.translation(sky_pos[0], sky_pos[1], sky_pos[2]).times(Mat4.scale(100, 100, 100)), this.materials.clouds );
    // this.shapes.box.draw( caller, this.uniforms, Mat4.translation(-5, 10, -10).times(Mat4.scale(50, 20, 1)), this.materials.gold );
    // this.shapes.box.draw( caller, this.uniforms, Mat4.translation(-5, 1, 80).times(Mat4.scale(3, 2, 1)), this.materials.Brick );
    
    // texture testing
    // this.shapes.square.draw( caller, this.uniforms, Mat4.translation(6, 1, 0).times(Mat4.scale(1, 1, 1)), this.materials.explosion);
    this.shapes.LargeRock1.draw( caller, this.uniforms, Mat4.translation(106, 1, 0).times(Mat4.scale(20, 20, 20)), this.materials.Brick);
    this.shapes.LargeRock1.draw( caller, this.uniforms, Mat4.translation(150, 1, 20).times(Mat4.scale(30, 30, 30)), this.materials.Brick);
    this.shapes.LargeRock1.draw( caller, this.uniforms, Mat4.translation(180, 1, -40).times(Mat4.scale(40, 40, 40)), this.materials.Brick);


    const rocks = [
      { pos: [100, 1, 50], scale: 20, rot: Math.PI / 4 },
      { pos: [150, 1, 80], scale: 30, rot: Math.PI / 6 },
      { pos: [180, 1, -90], scale: 40, rot: Math.PI / 8 },
      { pos: [120, 2, -70], scale: 15, rot: Math.PI / 3 },
      { pos: [170, 1.5, 100], scale: 25, rot: Math.PI / 5 },
      { pos: [-200, 1, -20], scale: 18, rot: Math.PI / 7 },
      { pos: [-90, 1.2, 110], scale: 12, rot: Math.PI / 4 },
      { pos: [-140, 0.8, -130], scale: 22, rot: Math.PI / 6 },
      { pos: [160, 1.1, 115], scale: 35, rot: Math.PI / 9 },
      { pos: [-190, 2, -150], scale: 28, rot: Math.PI / 5 }
  ];

  rocks.forEach(rock => {
      this.shapes.LargeRock1.draw(
          caller, 
          this.uniforms, 
          Mat4.translation(...rock.pos)
              .times(Mat4.rotation(rock.rot, 0, 1, 0))
              .times(Mat4.scale(rock.scale, rock.scale, rock.scale)), 
          this.materials.Brick
      );
  });
    // this.shapes.square.draw( caller, this.uniforms, Mat4.translation(8, 1, 3).times(Mat4.scale(1, 1, 1)), this.materials.fire);
    // this.shapes.square.draw( caller, this.uniforms, Mat4.translation(7, 1, 0.1).times(Mat4.scale(1, 1, 1)), this.materials.dust);
    // this.shapes.square.draw( caller, this.uniforms, Mat4.translation(10, 1, 0.1).times(Mat4.scale(1, 1, 1)), this.materials.smoke);

    if(!this.start) {
      // Breathe fire listener
      let breathe_fire = (event) => {
        if(event.key == "b") {
          console.log(this.dragon2)
          this.dragon2.create_vector_field();
          this.dragon2.breatheFire(this.fire_particles, this.t);
        }
      };

      // We need to clear the vector field when done.
      let onTimerFinish = () => {
        this.dragon2.field = null;
      }
      let delete_field = (event) => {
        if(event.key == "b") 
          setTimeout(onTimerFinish, this.particle_lifetime);
      }

      document.addEventListener('keydown', breathe_fire);
      document.addEventListener('keyup', delete_field);
      this.start = true;
    }

    // this code is to attach an object to the front of the camera
    // linearly interpolate to wiggle when moving, put wiggle in the direction orthogonal to movement
    // ex this is wiggle for forward or backward movement
    /*
          if (this.move_direction[0] > 0) direction += "Left ";
      if (this.move_direction[0] < 0) direction += "Right ";
      if (this.move_direction[1] > 0) direction += "Down ";
      if (this.move_direction[1] < 0) direction += "Up ";
      if (this.move_direction[2] > 0) direction += "Forward ";
      if (this.move_direction[2] < 0) direction += "Backward ";
    */

    // Determine movement direction
    let move_x = this.move_direction[0]; // Left/Right
    let move_z = this.move_direction[2]; // Forward/Backward

    // Lerp wiggle_factor instead of instantly modifying it
    let target_wiggle = move_x || move_z ? 1 : 0; // 1 when moving, 0 when stopping
    this.wiggle_factor = this.wiggle_factor * 0.9 + target_wiggle * 0.1; // Smooth interpolation

    // Compute orthogonal sine motion
    let wiggle_x = move_z * Math.sin(7 * t) * this.wiggle_factor * 9; // Side-to-side when moving forward/back
    let wiggle_z = move_x * Math.sin(7 * t) * this.wiggle_factor * 9; // Forward/backward when moving left/right

    // Apply transformation with interpolated sine motion
    let base_transform_r = Mat4.identity()
        .times(Mat4.scale(0.2, 0.2, 0.2))
        .times(Mat4.translation(2.5 + wiggle_x, -20, -100 + wiggle_z));


    this.shapes.cylinder.draw(caller, this.uniforms, this.uniforms.camera_transform.times(base_transform_r), { ...this.materials.metal, color: yellow });
    let final_transform = this.uniforms.camera_transform.times(base_transform_r);
    let x = final_transform[0][3];
    let y = final_transform[1][3];
    let z = final_transform[2][3]; // could just use tovec3 to convert matrix to vector3
    const fabrik_target = vec3(x, y, z);

    // this.uniforms.lights.push(defs.Phong_Shader.light_source( vec4(x, y, z, 0.0), color( 1,1,1,1 ), 1000000 ) )

    // this.settings.FOV
    
    // Smoothly interpolate FOV
    let target_FOV = this.is_moving ? 70 : 50; // Increase FOV when moving, return to 75 when stopping
    let speed = 0.98; // Higher values slow it down
    this.settings.FOV = this.settings.FOV * speed + target_FOV * (1 - speed);

    // code for the delay startup (prevent wacky lag in the beginning destroying particles)
    let point; 
    let delay = 1;
    if (t < delay) {
        point = [0, 10, 0]; // Stay still for the first 5 seconds
    } else {
        let adjustedT = t - delay; // Start motion from t = 0 after 5 seconds
        point = [-adjustedT, 10 * Math.sin(adjustedT) + 10, 0];
    }

    let ball_transform2 = Mat4.translation(this.dragon2.mouth.position[0], this.dragon2.mouth.position[1] + 5, this.dragon2.mouth.position[2])
    .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    // this.shapes.ball.draw( caller, this.uniforms, ball_transform2, { ...this.materials.metal, color: yellow } );
    
    // this.curve.draw(caller, this.uniforms);

    point = this.spline.computePoint((t / 50) % 1); // Use the circular spline
    
    // this.particleSystem.setParticle(0, 1000, [x, y, z, 0, 0, 0]); // uncomment to make dragon follow camera
    
    // this.particleSystem.setParticle(0, 10, [point[0], point[1], point[2], 0, 0, 0]); // Dragon follows spline
    // this.particleSystem.draw(caller, this.uniforms, this.shapes, this.materials);
    this.dragon1.draw(caller, this.uniforms, point);

    // this.dragon1.draw(caller, this.uniforms, fabrik_target);

    // Pool and cull out dead particles
    let new_particles = Array();
    for(let p of this.fire_particles) {
      if(t - p.creation_t < this.particle_lifetime) new_particles.push(p);
    }
    this.fire_particles = new_particles

    // DRAW THERMOBOX
    if(this.thermo_box.hit_counter > 1000)
      this.thermo_box.heat_step(this.t);

    this.thermo_box.draw(caller, this.uniforms, this.materials, this.shapes);

    if(this.thermo_box.U[4][4][4] >= 60 && this.thermo_box.go_time) {
      this.thermo_box.init_temp = 0.000000001;
      this.thermo_box.set_dirichlet_boundary();
      // console.log(this.thermo_box.U)
      this.thermo_box.go_time = false;
    }
 
    // Fabrik Dragon test
    this.dragon2.draw(caller, this.uniforms, fabrik_target);
    // this.dragon2.draw(caller, this.uniforms, point);
    // // Set a target for the tail's tip (e.g., this could be animated over time)
    // this.dragonTail.setTarget(vec3(x, y, z)); // Follow camera
    // // this.dragonTail.setTarget(vec3(point2[0], point2[1], point2[2]));
    // this.dragonTail.update(10);  // Run several iterations to smooth out the IK solution
    // // In your draw routine, render the chain:
    // this.dragonTail.display(caller, this.uniforms, this.shapes, this.materials);
    let dt = 1.0 / 30.0;
    let t_sim = t;
    let t_next = t_sim + dt;
    for(; t_sim<=t_next; t_sim += this.d_t) {
      this.update_fire_breath_particles();
      for(let p of this.fire_particles) {
        let c = null;
        if(p.color[1] != 0) {
          c = fire_orange.plus(color_dir.times(1 / this.particle_lifetime * (this.t - p.creation_t)));
        }
        else c = red;
        this.shapes.ball.draw( caller, this.uniforms, p.particle_transform, { ...this.materials.metal, color: c } );
        // this.shapes.ball.draw( caller, this.uniforms, p.particle_transform, { ...this.materials.metal, color: blue } );
      }
    }

    // this.update_thermo_box_particles();
  }

  integrate(p) {
    p.velocity = p.velocity.plus(p.net_force.times(this.d_t / p.mass));
    p.position = p.position.plus(p.velocity.times(this.d_t));
  }

  update_thermo_box_particles() {
    // Iterating through all springs and updating forces.
    for(let s of this.thermo_box.springs){
      let p_i = this.thermo_box.particles[s.p_i];
      let p_j = this.thermo_box.particles[s.p_j];

      // Get distance between particles
      let d_ij = p_j.position.minus(p_i.position);
      let d_ij_mag = d_ij.norm();
      let d_ij_norm = d_ij.normalized();

      // Total force from spring
      let F_s = d_ij_norm.times(s.ks * (d_ij_mag - s.l));
      console.log("Spring force: ", F_s);

      // Total force from damper
      let F_d = d_ij_norm.times(-1.0 * s.kd * (p_j.velocity.minus(p_i.velocity)).dot(d_ij_norm));
      console.log("Damping force: ", F_d);

      // Net Force
      let F_net = F_s.minus(F_d);
      
      // Update bi-particle forces
      p_i.net_force = p_i.net_force.plus(F_net);
      p_j.net_force = p_j.net_force.minus(F_net);
      
      console.log("Spring force: ", F_s);
      console.log("Damping force: ", F_d);
      console.log("Total force: ", F_net);
    }

    // // Integration
    for(let p of this.thermo_box.particles) {
      this.integrate(p);
    }

    // // Collision Detection
    for(let p of this.thermo_box.particles) {
      // Particle has hit the ground
      let penetration = p.radius - p.position[1];
      if(penetration > 0.01) {
        let norm = vec3(0, 1, 0);
        let F_s = norm.times(this.gks * penetration);
        let F_d = norm.times(-1.0 * this.gkd * p.velocity.dot(norm));
        let F_net = F_s.plus(F_d);
        p.net_force = p.net_force.plus(F_net);
        this.integrate(p);  
        // console.log("Spring force: ", F_s);
        // console.log("Damping force: ", F_d);
      }

      // console.log("Particle 0 velocity ", this.particles[0].velocity);

      p.update_transform();
      p.net_force = vec3(0, -this.gravity, 0);
    }
  }

  update_fire_breath_particles(){
    // Updating particles for fire particles
    for(let p of this.fire_particles) {
      if(this.dragon2.field != null)
        this.dragon2.field.affect_particle(p);
      this.integrate(p);
      p.update_transform();

      let x = p.position[0];
      let y = p.position[1];
      let z = p.position[2];

      if(x > this.thermo_box.min_x && x < this.thermo_box.max_x &&
         y > this.thermo_box.min_y && y < this.thermo_box.max_y &&
         z > this.thermo_box.min_z && z < this.thermo_box.max_z){
          // console.log("NOICE.")
          this.thermo_box.go_time = true;
          this.thermo_box.hit_counter++;
      }

    }
  }

  render_controls()
  {                                 
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Dragon!!!!!!!!!";
    this.new_line();    


    // ----- Debug Controls -----
    this.new_line();
    // this.live_html("<h3>Debug Panel</h3>");
    // this.live_string(box => box.textContent = "FPS: " + this._debug_fps);

    // this.live_string(box => {
    //   let direction = "";
    //   if (this.move_direction[0] > 0) direction += "Left ";
    //   if (this.move_direction[0] < 0) direction += "Right ";
    //   if (this.move_direction[1] > 0) direction += "Down ";
    //   if (this.move_direction[1] < 0) direction += "Up ";
    //   if (this.move_direction[2] > 0) direction += "Forward ";
    //   if (this.move_direction[2] < 0) direction += "Backward ";
  
    //   box.textContent = this.is_moving ? `Moving: ${direction}` : "Stationary";
    // });

    // ----- Camera Controls -----
    this.live_html("<b>Camera Controls</b>");
    this.new_line();
    this.live_string(box => box.textContent = "FOV: " + this.settings.FOV);
    this.new_line();
    this.key_triggered_button("Inc FOV", ["Shift", "M"],
        () => this.settings.FOV += this._debug_precision);
    this.key_triggered_button("Dec FOV", ["Shift", "N"],
        () => this.settings.FOV -= this._debug_precision);
    this.new_line();
    this.key_triggered_button("fire?", ["g"],
        () => this.dragon2.shoot());
    this.new_line();

    // this.live_string(box => box.textContent = "light color: " + this.settings.LightColor);
    // this.new_line();
    // this.key_triggered_button("Inc FOV", ["Shift", "U"],
    //     () => this.settings.LightColor[0] += this._debug_precision);
    // this.key_triggered_button("Dec FOV", ["Shift", "I"],
    //     () => this.settings.LightColor[0] -= this._debug_precision);
    // this.new_line();
    // this.key_triggered_button("Inc FOV", ["Shift", "U"],
    //     () => this.settings.LightColor[1] += this._debug_precision);
    // this.key_triggered_button("Dec FOV", ["Shift", "I"],
    //     () => this.settings.LightColor[1] -= this._debug_precision);
    // this.new_line();
    // this.key_triggered_button("Inc FOV", ["Shift", "U"],
    //     () => this.settings.LightColor[2] += this._debug_precision);
    // this.key_triggered_button("Dec FOV", ["Shift", "I"],
    //     () => this.settings.LightColor[2] -= this._debug_precision);
    // this.new_line();
    // this.key_triggered_button("Inc FOV", ["Shift", "U"],
    //     () => this.settings.LightColor[3] += this._debug_precision);
    // this.key_triggered_button("Dec FOV", ["Shift", "I"],
    //     () => this.settings.LightColor[3] -= this._debug_precision);
    // this.new_line();

    // ----- Precision Settings -----
    this.live_html("<b>Precision Settings</b>"); 
    this.new_line();
    this.live_string(box => box.textContent = "Precision: " + this._debug_precision); 
    this.new_line();
    this.key_triggered_button("Inc Precision", ["Shift", "J"],
        () => this._debug_precision *= 2);
    this.key_triggered_button("Dec Precision", ["Shift", "K"],
        () => this._debug_precision /= 2);
    this.new_line();

    // ----- General Debug Options -----
    this.live_html("<b>General Debug Options</b>"); 
    this.new_line();
    this.key_triggered_button("Reset Settings", ["Shift", "R"], 
        () => this.reset_debug_settings());
    this.new_line();
  }

  // Example Reset Function
  reset_debug_settings() {
    this.settings.FOV = 45;  // Default value
    this._debug_precision = 1;
    console.log("Debug settings reset to default.");
  }

  render_explanation() { 
    this.document_region.innerHTML += `
        <p><strong>Dragon</strong></p>
        <p>Richard Nguyen | Patrick Dai | Delia Ivascu</p>
    `;
  }
}

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

// function generateHeightMap(width, height, scale) {
//   const heightMap = [];
//   for (let z = 0; z < height; z++) {
//       heightMap[z] = [];
//       for (let x = 0; x < width; x++) {
//           // Example: Sine wave pattern for simple hills
//           const elevation = Math.sin(x * scale) * Math.cos(z * scale) * 10; // Adjust for hill height
//           heightMap[z][x] = elevation;
//       }
//   }
//   return heightMap;
// }
