// Dragon Demo - This is the main file for the dragon animation. This could also be just a base to test various systems(particles, simulation)
// and have the real animation be in a different file for the final.

import {tiny, defs} from './examples/common.js';
import {Hermit_spline, Curve_Shape }from './hermit.js';
import {SpringMass }from './simulation.js';
import { Fabrik } from './fabrik.js'; // Forward And Backward Reaching Inverse Kinematics just for testing 
import { SpringMassDragon, FabrikDragon } from './Dragon.js'; // Import dragon types???
import { Particle } from './Particles.js';


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
        
        
        //  ----- Set the Settings ----
        this.settings.backgroundColor = [0.7, 0.7, 0.7, 1];
        this.settings.LightColor = [0.95, 0.7, 0.45, 1];
        this.settings.FOV = 45;
        
        // Debug
        this._debug_precision = 1;


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
          'teapot' : new defs.Shape_From_File("assets/teapot.obj"),
          'traffic' : new defs.Shape_From_File("assets/traffic_box.obj"),
        };

        // *** Materials: ***  Basic_Shader() Phong_Shader() Textured_Phong() Fake_Bump_Map()
        this.materials = {
          // Colors
          plastic : { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) },
          metal   : { shader: new defs.Phong_Shader2(), ambient: .2, diffusivity: 1, specularity:  1, colors: color( .9,.5,.9,1 ) },
          // Textures
          rgb : { shader: new defs.Fake_Bump_Map(), ambient: .1, texture: new Texture( "assets/rgb.jpg" ) },
          grass : { shader: new defs.Fog_Shader(), ambient: .3, diffusivity: 10, specularity: 0.4, texture: new Texture( "assets/grass.jpg" ) },
          water : { shader: new defs.Scroll_Fog_Shader(), ambient: .5, diffusivity: 0.6, specularity: 2, texture: new Texture( "assets/water.png" ) },
          dragon : { shader: new defs.Fog_Shader(), ambient: .5, texture: new Texture( "assets/EDragon_Body.png" ) },
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
        this.dragon1 = new SpringMassDragon(this.shapes, this.materials);

        /************************************* Fabrik dragon implementation ****************************************/
        // Suppose you want a chain starting at (0, 10, 0) with 10 segments:
        this.dragon2 = new FabrikDragon(this.shapes, this.materials);

        // World particles from fire
        this.fire_particles = [];

        this.d_t = 0.01
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
          Shader.assign_camera( Mat4.look_at (vec3 (5, 8, 15), vec3 (0, 5, 0), vec3 (0, 1, 0)), this.uniforms );
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
        this.shapes.ball.draw( caller, this.uniforms, Mat4.translation(20, 20, 20), this.materials.water);
        this.uniforms.lights.push(defs.Phong_Shader.light_source( vec4(20, 10, 30, 1.0), color( 0.1,1,1,1 ), 1000 ) )
        this.shapes.head.draw( caller, this.uniforms, Mat4.translation(20, 10, 30), this.materials.water);

        // this._debug_fps = caller.fps;
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

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;
    this.uniforms.projection_transform = Mat4.perspective( this.settings.FOV * Math.PI/180, caller.width/caller.height, 1, 1000 );

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(100, 0.01, 100));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, this.materials.water);
    // Cube
    this.shapes.box.draw( caller, this.uniforms, Mat4.translation(0, 1, 0).times(Mat4.scale(1, 1, 1)), { ...this.materials.plastic, color: blue } );
    this.shapes.traffic.draw( caller, this.uniforms, Mat4.translation(4, 1, 0).times(Mat4.scale(1, 1, 1)), { ...this.materials.plastic, color: blue } );
    // this.shapes.square.draw( caller, this.uniforms, Mat4.translation(6, 1, 0).times(Mat4.scale(1, 1, 1)), this.materials.basic);

    if(!this.start) {
      let breathe_fire = debounce((event) => {
        if(event.key == "b") {
          this.dragon2.breatheFire(this.fire_particles);
        }
      }, 100);
      document.addEventListener('keydown', breathe_fire);    // Add listener
      this.start = true;
    }

    // this code is to attach an object to the front of the camera
    let base_transform_r = Mat4.identity().times(Mat4.scale(0.2,0.2,0.2).times(Mat4.translation(2.5,-1.5,-100)));
    this.shapes.cylinder.draw(caller, this.uniforms, this.uniforms.camera_transform.times(base_transform_r), { ...this.materials.metal, color: yellow });
    let final_transform = this.uniforms.camera_transform.times(base_transform_r);
    let x = final_transform[0][3];
    let y = final_transform[1][3];
    let z = final_transform[2][3]; // could just use tovec3 to convert matrix to vector3
    const fabrik_target = vec3(x, y, z);
    

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
    this.shapes.ball.draw( caller, this.uniforms, ball_transform2, { ...this.materials.metal, color: blue } );
    
    this.curve.draw(caller, this.uniforms);

    point = this.spline.computePoint((t / 50) % 1); // Use the circular spline
    
    // this.particleSystem.setParticle(0, 1000, [x, y, z, 0, 0, 0]); // uncomment to make dragon follow camera
    
    // this.particleSystem.setParticle(0, 10, [point[0], point[1], point[2], 0, 0, 0]); // Dragon follows spline
    // this.particleSystem.draw(caller, this.uniforms, this.shapes, this.materials);
    this.dragon1.draw(caller, this.uniforms, point);
 
    // Fabrik Dragon test
    this.dragon2.draw(caller, this.uniforms, fabrik_target);
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
      this.update_particles();
      for(let p of this.fire_particles) {
        this.shapes.ball.draw( caller, this.uniforms, p.particle_transform, { ...this.materials.metal, color: blue } );
      }
    }

  }

  integrate(p) {
    p.velocity = p.velocity.plus(p.net_force.times(this.d_t / p.mass));
    p.position = p.position.plus(p.velocity.times(this.d_t));
  }

  update_particles(){
    // Integration
    for(let p of this.fire_particles) {
      this.integrate(p);
      p.update_transform();
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
